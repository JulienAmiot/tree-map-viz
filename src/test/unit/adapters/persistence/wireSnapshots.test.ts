/**
 * SPEC §17.85 — Schema snapshot guard (vitest half).
 *
 * Two byte-equality snapshots gate the persisted JSON shapes:
 *   - `wire-tree.snap.json`     — the per-tree wire shape emitted by
 *                                 `jsonCodec.encode`.
 *   - `wire-envelope.snap.json` — the collection-envelope wire shape
 *                                 emitted by
 *                                 `LocalStorageBoardCollectionRepository.save`.
 *
 * On any drift, the assertion message reminds the operator of the §17.82
 * X-bump rule. The matching CI half lives at `bin/check-version-bump.mjs`
 * and fails the PR if a snapshot is changed without bumping
 * `package.json#version`'s major component.
 *
 * Regeneration: `npm run snapshot:update` re-runs this file with
 * `SNAPSHOT_UPDATE=1` set. Under that flag the test WRITES the snapshot
 * files (and still asserts true) instead of reading + comparing — so
 * intentional shape changes ship in one commit alongside the matching X-bump.
 *
 * Why we observe through `save()` rather than calling `serialize` directly:
 * the §17.85 plan (SPEC Open Question O1) recommended widening
 * `serialize` to public. We picked the smaller-surface alternative:
 * call the public `save()` contract against an in-memory `Storage`,
 * then read the bytes back out. The output is identical by construction
 * (`save` is a 1-liner over `serialize`) and the production API stays
 * unchanged.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { encode } from "../../../../adapters/persistence/jsonCodec.js";
import {
  LocalStorageBoardCollectionRepository,
  STORAGE_KEY,
} from "../../../../adapters/persistence/LocalStorageBoardCollectionRepository.js";

import { buildSnapshotEnvelope, buildSnapshotTree } from "../../../snapshots/treeFixture.js";

const SHOULD_UPDATE = process.env["SNAPSHOT_UPDATE"] === "1";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SNAPSHOT_DIR = resolve(__dirname, "../../../snapshots");
const TREE_SNAPSHOT_PATH = resolve(SNAPSHOT_DIR, "wire-tree.snap.json");
const ENVELOPE_SNAPSHOT_PATH = resolve(SNAPSHOT_DIR, "wire-envelope.snap.json");

/**
 * Pretty-print so the snapshot files diff readably in git. The codec
 * itself emits compact JSON (`JSON.stringify` with no spacing); we
 * parse-and-reformat for the snapshot file only — the byte-equality
 * assertion compares pretty-printed strings to pretty-printed files.
 */
function prettyJson(compact: string): string {
  return `${JSON.stringify(JSON.parse(compact), null, 2)}\n`;
}

/**
 * Storage-shaped in-memory fake. Mirrors the same fake used in
 * `LocalStorageBoardCollectionRepository.test.ts` — we don't share it
 * across test files because the existing one is co-located with that
 * test and re-exporting would couple two otherwise-independent tests.
 */
class InMemoryStorage implements Storage {
  private readonly map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const DRIFT_HINT =
  "Wire shape changed. If intentional, run `npm run snapshot:update` AND " +
  "bump `package.json#version`'s X (per SPEC §17.82 / §17.85).";

function assertSnapshot(actualPretty: string, snapshotPath: string): void {
  if (SHOULD_UPDATE) {
    writeFileSync(snapshotPath, actualPretty, { encoding: "utf-8" });
    return;
  }
  const expected = readFileSync(snapshotPath, { encoding: "utf-8" });
  expect(actualPretty, DRIFT_HINT).toBe(expected);
}

describe("§17.85 wire snapshot guards", () => {
  it("per-tree wire shape matches `wire-tree.snap.json` byte-for-byte", () => {
    const tree = buildSnapshotTree();
    const compact = encode(tree);
    const pretty = prettyJson(compact);
    assertSnapshot(pretty, TREE_SNAPSHOT_PATH);
  });

  it("collection-envelope wire shape matches `wire-envelope.snap.json` byte-for-byte", async () => {
    const storage = new InMemoryStorage();
    const repo = new LocalStorageBoardCollectionRepository({ storage });
    await repo.save(buildSnapshotEnvelope());
    const compact = storage.getItem(STORAGE_KEY);
    expect(compact, "repo did not write to the default storage key").not.toBeNull();
    const pretty = prettyJson(compact!);
    assertSnapshot(pretty, ENVELOPE_SNAPSHOT_PATH);
  });
});
