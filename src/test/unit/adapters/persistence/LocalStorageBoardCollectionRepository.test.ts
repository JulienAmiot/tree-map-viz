import { describe, expect, it } from "vitest";

import { createJsonCodec } from "../../../../adapters/persistence/jsonCodec.js";
import {
  LocalStorageBoardCollectionRepository,
  STORAGE_KEY,
  StorageFullError,
} from "../../../../adapters/persistence/LocalStorageBoardCollectionRepository.js";
import { buildSampleTree } from "../../../../adapters/sampleData.js";
import { SHOWCASE_BOARD_ID } from "../../../../adapters/showcaseSeed.js";
import type { BoardCollectionSnapshot, Board } from "../../../../application/ports/BoardCollectionRepository.js";
import type { Clock } from "../../../../domain/capabilities/Clock.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";

const NOW = new Date("2026-05-17T00:00:00Z");
const clock: Clock = { now: () => Timestamp.of(NOW) };
const codec = createJsonCodec(clock);

class InMemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
  getItem(key: string): string | null { return this.map.get(key) ?? null; }
  key(i: number): string | null { return Array.from(this.map.keys())[i] ?? null; }
  removeItem(key: string): void { this.map.delete(key); }
  setItem(key: string, value: string): void { this.map.set(key, value); }
}

function newRepo(storage: Storage = new InMemoryStorage(), seed?: () => BoardCollectionSnapshot) {
  return new LocalStorageBoardCollectionRepository({ storage, codec, clock, seed });
}

function sampleBoard(id: string, name: string): Board {
  return { id, name, tree: buildSampleTree(clock) };
}

describe("LocalStorageBoardCollectionRepository (§17.107)", () => {
  it("empty storage → seeds via buildShowcaseBoard (id matches SHOWCASE_BOARD_ID) AND persists the seed (next load reads back the same snapshot byte-for-byte)", async () => {
    const storage = new InMemoryStorage();
    const repo = newRepo(storage);
    const loaded = await repo.load();
    expect(loaded.boards).toHaveLength(1);
    expect(loaded.currentBoardId).toBe(SHOWCASE_BOARD_ID);
    expect(loaded.boards[0]!.id).toBe(SHOWCASE_BOARD_ID);
    const persisted = storage.getItem(STORAGE_KEY);
    expect(persisted).not.toBeNull();
    const env = JSON.parse(persisted!) as { v: number; currentBoardId: string; boards: { tree: { schemaVersion: string } }[] };
    expect(env.v).toBe(2);
    expect(env.currentBoardId).toBe(SHOWCASE_BOARD_ID);
    expect(env.boards[0]!.tree.schemaVersion).toBe("v4.0");
  });

  it("save → load round-trips every kind in the sampleDataV4 tree + preserves currentBoardId + every board id/name across multiple boards", async () => {
    const repo = newRepo();
    const snapshot: BoardCollectionSnapshot = {
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

  it("§17.112 v3 sweep: a v:1 envelope (pre-§17.110 cutover wire) surfaces a clean unsupported-version error — the v3-fallback shim retired with the v3 source files", async () => {
    const legacyEnvelope = {
      v: 1,
      currentBoardId: "any",
      boards: [{ id: "any", name: "Any", tree: { nodeType: "TextNode", id: "any", title: "Any", description: "", weight: 1, historizedValues: [], childrenNodes: [] } }],
    };
    const storage = new InMemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(legacyEnvelope));
    await expect(newRepo(storage).load()).rejects.toThrow(/unsupported envelope version "v: 1"/);
  });

  it("save surfaces StorageFullError on quota-exceeded (DOMException name + legacy code 22 + Firefox NS_ERROR_DOM_QUOTA_REACHED all detected) AND propagates other errors verbatim", async () => {
    const snapshot: BoardCollectionSnapshot = { boards: [sampleBoard("a", "Alpha")], currentBoardId: "a" };
    const quotaStorage = { ...new InMemoryStorage(), setItem: () => { const e = new Error("quota"); (e as unknown as { name: string }).name = "QuotaExceededError"; throw e; } } as unknown as Storage;
    await expect(newRepo(quotaStorage).save(snapshot)).rejects.toBeInstanceOf(StorageFullError);
    const legacyCodeStorage = { ...new InMemoryStorage(), setItem: () => { const e = new Error("legacy") as unknown as { code: number; message: string; name: string }; e.code = 22; e.name = "Other"; throw e; } } as unknown as Storage;
    await expect(newRepo(legacyCodeStorage).save(snapshot)).rejects.toBeInstanceOf(StorageFullError);
    const ffStorage = { ...new InMemoryStorage(), setItem: () => { const e = new Error("ff"); (e as unknown as { name: string }).name = "NS_ERROR_DOM_QUOTA_REACHED"; throw e; } } as unknown as Storage;
    await expect(newRepo(ffStorage).save(snapshot)).rejects.toBeInstanceOf(StorageFullError);
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
      storage.setItem(STORAGE_KEY, raw);
      await expect(newRepo(storage).load()).rejects.toThrow(pattern);
    }
  });

  it("§17.112 v3 sweep: a v:2 envelope whose per-board tree fails v4 decode now throws verbatim — belt-and-braces v3 recovery retired with the v3 source files", async () => {
    const corruptedEnvelope = {
      v: 2,
      currentBoardId: "any",
      boards: [{ id: "any", name: "Any", tree: { schemaVersion: "v3.0", root: {}, cards: [] } }],
    };
    const storage = new InMemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(corruptedEnvelope));
    await expect(newRepo(storage).load()).rejects.toThrow(/v4\.0/);
  });
});
