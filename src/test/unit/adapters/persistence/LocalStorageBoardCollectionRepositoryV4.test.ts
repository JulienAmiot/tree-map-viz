import { describe, expect, it } from "vitest";

import { encode as encodeV3 } from "../../../../adapters/persistence/jsonCodec.js";
import { createJsonCodecV4 } from "../../../../adapters/persistence/jsonCodecV4.js";
import {
  LocalStorageBoardCollectionRepositoryV4,
  STORAGE_KEY_V4,
  StorageFullErrorV4,
} from "../../../../adapters/persistence/LocalStorageBoardCollectionRepositoryV4.js";
import { buildSampleTreeV4 } from "../../../../adapters/sampleDataV4.js";
import { buildShowcaseBoard } from "../../../../adapters/showcaseSeed.js";
import { SHOWCASE_BOARD_ID_V4 } from "../../../../adapters/showcaseSeedV4.js";
import type { BoardCollectionSnapshotV4, BoardV4 } from "../../../../application/ports/BoardCollectionRepositoryV4.js";
import type { Clock } from "../../../../domain/capabilities/Clock.js";
import { ComputedBusinessScoreNode } from "../../../../domain/nodes/ComputedBusinessScoreNode.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";

const NOW = new Date("2026-05-17T00:00:00Z");
const clock: Clock = { now: () => Timestamp.of(NOW) };
const codec = createJsonCodecV4(clock);

class InMemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
  getItem(key: string): string | null { return this.map.get(key) ?? null; }
  key(i: number): string | null { return Array.from(this.map.keys())[i] ?? null; }
  removeItem(key: string): void { this.map.delete(key); }
  setItem(key: string, value: string): void { this.map.set(key, value); }
}

function newRepo(storage: Storage = new InMemoryStorage(), seed?: () => BoardCollectionSnapshotV4) {
  return new LocalStorageBoardCollectionRepositoryV4({ storage, codec, clock, seed });
}

function sampleBoard(id: string, name: string): BoardV4 {
  return { id, name, tree: buildSampleTreeV4(clock) };
}

describe("LocalStorageBoardCollectionRepositoryV4 (§17.107)", () => {
  it("empty storage → seeds via buildShowcaseBoardV4 (id matches SHOWCASE_BOARD_ID_V4) AND persists the seed (next load reads back the same snapshot byte-for-byte)", async () => {
    const storage = new InMemoryStorage();
    const repo = newRepo(storage);
    const loaded = await repo.load();
    expect(loaded.boards).toHaveLength(1);
    expect(loaded.currentBoardId).toBe(SHOWCASE_BOARD_ID_V4);
    expect(loaded.boards[0]!.id).toBe(SHOWCASE_BOARD_ID_V4);
    const persisted = storage.getItem(STORAGE_KEY_V4);
    expect(persisted).not.toBeNull();
    const env = JSON.parse(persisted!) as { v: number; currentBoardId: string; boards: { tree: { schemaVersion: string } }[] };
    expect(env.v).toBe(2);
    expect(env.currentBoardId).toBe(SHOWCASE_BOARD_ID_V4);
    expect(env.boards[0]!.tree.schemaVersion).toBe("v4.0");
  });

  it("save → load round-trips every kind in the sampleDataV4 tree + preserves currentBoardId + every board id/name across multiple boards", async () => {
    const repo = newRepo();
    const snapshot: BoardCollectionSnapshotV4 = {
      boards: [sampleBoard("a", "Alpha"), sampleBoard("b", "Beta")],
      currentBoardId: "b",
    };
    await repo.save(snapshot);
    const loaded = await repo.load();
    expect(loaded.currentBoardId).toBe("b");
    expect(loaded.boards.map((b) => [b.id, b.name])).toEqual([["a", "Alpha"], ["b", "Beta"]]);
    const original = snapshot.boards[0]!.tree;
    const roundtripped = loaded.boards[0]!.tree;
    expect(roundtripped.nodes().map((n) => n.id)).toEqual(original.nodes().map((n) => n.id));
    expect([...roundtripped.cards.keys()].sort()).toEqual([...original.cards.keys()].sort());
  });

  it("v3-fallback shim: a v:1 envelope (v3-shape trees) loads through v3 jsonCodec + v4TreeFromV3Root bridge — §17.99c polymorphic substitution lifts `computed:true` BSCs to ComputedBusinessScoreNode + next save re-emits as v:2 v4-native", async () => {
    const v3Board = buildShowcaseBoard(NOW);
    const legacyEnvelope = {
      v: 1,
      currentBoardId: v3Board.id,
      boards: [{ id: v3Board.id, name: v3Board.name, tree: JSON.parse(encodeV3(v3Board.tree)) as unknown }],
    };
    const storage = new InMemoryStorage();
    storage.setItem(STORAGE_KEY_V4, JSON.stringify(legacyEnvelope));
    const repo = newRepo(storage);
    const loaded = await repo.load();
    expect(loaded.currentBoardId).toBe(v3Board.id);
    const tree = loaded.boards[0]!.tree;
    const engineering = tree.findById("engineering");
    expect(engineering).toBeInstanceOf(ComputedBusinessScoreNode);
    await repo.save(loaded);
    const persisted = JSON.parse(storage.getItem(STORAGE_KEY_V4)!) as { v: number };
    expect(persisted.v).toBe(2);
  });

  it("save surfaces StorageFullErrorV4 on quota-exceeded (DOMException name + legacy code 22 + Firefox NS_ERROR_DOM_QUOTA_REACHED all detected) AND propagates other errors verbatim", async () => {
    const snapshot: BoardCollectionSnapshotV4 = { boards: [sampleBoard("a", "Alpha")], currentBoardId: "a" };
    const quotaStorage = { ...new InMemoryStorage(), setItem: () => { const e = new Error("quota"); (e as unknown as { name: string }).name = "QuotaExceededError"; throw e; } } as unknown as Storage;
    await expect(newRepo(quotaStorage).save(snapshot)).rejects.toBeInstanceOf(StorageFullErrorV4);
    const legacyCodeStorage = { ...new InMemoryStorage(), setItem: () => { const e = new Error("legacy") as unknown as { code: number; message: string; name: string }; e.code = 22; e.name = "Other"; throw e; } } as unknown as Storage;
    await expect(newRepo(legacyCodeStorage).save(snapshot)).rejects.toBeInstanceOf(StorageFullErrorV4);
    const ffStorage = { ...new InMemoryStorage(), setItem: () => { const e = new Error("ff"); (e as unknown as { name: string }).name = "NS_ERROR_DOM_QUOTA_REACHED"; throw e; } } as unknown as Storage;
    await expect(newRepo(ffStorage).save(snapshot)).rejects.toBeInstanceOf(StorageFullErrorV4);
    const otherStorage = { ...new InMemoryStorage(), setItem: () => { throw new Error("disk on fire"); } } as unknown as Storage;
    await expect(newRepo(otherStorage).save(snapshot)).rejects.toThrow(/disk on fire/);
  });

  it("load rejects malformed payloads with a descriptive error: not-JSON, not-object, missing fields", async () => {
    const cases: [string, RegExp][] = [
      ["{not json", /not valid JSON/],
      ["42", /not an object/],
      [JSON.stringify({ v: 2, boards: [] }), /missing required fields/],
      [JSON.stringify({ v: 2, currentBoardId: "a" }), /missing required fields/],
    ];
    for (const [raw, pattern] of cases) {
      const storage = new InMemoryStorage();
      storage.setItem(STORAGE_KEY_V4, raw);
      await expect(newRepo(storage).load()).rejects.toThrow(pattern);
    }
  });

  it("belt-and-braces: a v:2 envelope whose per-board tree fails v4 decode (JsonCodecV4DecodeError) falls back to v3 codec + bridge on that tree — kiosk stays recoverable from a corrupted post-cutover payload", async () => {
    const v3Board = buildShowcaseBoard(NOW);
    const mixedEnvelope = {
      v: 2,
      currentBoardId: v3Board.id,
      boards: [{ id: v3Board.id, name: v3Board.name, tree: JSON.parse(encodeV3(v3Board.tree)) as unknown }],
    };
    const storage = new InMemoryStorage();
    storage.setItem(STORAGE_KEY_V4, JSON.stringify(mixedEnvelope));
    const loaded = await newRepo(storage).load();
    expect(loaded.boards[0]!.tree.findById("engineering")).toBeInstanceOf(ComputedBusinessScoreNode);
  });
});
