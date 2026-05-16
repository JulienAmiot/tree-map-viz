import type {
  BoardCollectionRepositoryV4,
  BoardCollectionSnapshotV4,
  BoardV4,
} from "../../application/ports/BoardCollectionRepositoryV4.js";
import type { TreeCodecV4 } from "../../application/ports/TreeCodecV4.js";
import type { Clock } from "../../domain/capabilities/Clock.js";
import { v4TreeFromV3Root } from "../../domain/v3Bridge/v4TreeFromV3Root.js";
import { buildShowcaseBoardV4 } from "../showcaseSeedV4.js";

import { decode as decodeV3 } from "./jsonCodec.js";
import { JsonCodecV4DecodeError } from "./jsonCodecV4.js";

/**
 * §17.107 — `BoardCollectionRepositoryV4` adapter backed by `Storage`
 * (typically `localStorage`). v4 successor to v3's §17.31
 * `LocalStorageBoardCollectionRepository`, consuming the §17.106b
 * v4-native codec on the read AND write side.
 *
 * **Wire envelope `v: 2`** — top-level
 * `{ v: 2, currentBoardId, boards: [{id, name, tree}] }`; each board's
 * `tree` is the §17.106a "v4.0" wire object (NOT a string — embedded
 * directly so the whole envelope round-trips through a single
 * `JSON.parse`/`JSON.stringify` pair).
 *
 * **v3-fallback decode shim** — `load()` recognises `v: 1` envelopes
 * (the v3 adapter's wire shape; written by builds pre-§17.110 cutover)
 * and decodes each board's `tree` via the v3 `jsonCodec` then lifts it
 * to the v4 `Tree` container through the §17.81/§17.88 `v4TreeFromV3Root`
 * bridge. The §17.99c polymorphic substitution (`computed:true` → CBSN)
 * + §17.99b disabled migration + §17.100.5 cards-sidecar build all
 * surface through the bridge unchanged. On the next `save()` the
 * envelope re-emits as `v: 2` v4-native, completing the silent
 * one-way migration. **Belt-and-braces**: if a `v: 2` board's tree
 * fails to decode through the v4 codec with `JsonCodecV4DecodeError`
 * (corrupted post-cutover payload), the adapter falls back to the v3
 * path on that single tree too — the §17.106b codec is strict, but a
 * forgiving load path keeps the kiosk recoverable.
 *
 * Deliberately scoped: this strand ships the codec-migration adapter
 * only. The §17.86 runtime version-mismatch surface, the §17.86b
 * read-only mode toggle, the §17.63 legacy-key migration, and the
 * §17.42 `freshDateColor` discard are all v3-adapter features that
 * stay live on the v3 side until §17.110 Phase E cutover; if any are
 * still needed post-cutover they port over in a follow-on strand.
 */
export class StorageFullErrorV4 extends Error {
  constructor(cause?: unknown) {
    super("Local storage quota exceeded — cannot persist the v4 board collection.");
    this.name = "StorageFullErrorV4";
    if (cause !== undefined) (this as unknown as { cause: unknown }).cause = cause;
  }
}

export const STORAGE_KEY_V4 = "tree-map-viz/board-collection/v1";

const ENVELOPE_VERSION_V4 = 2;

type WireBoard = { id: string; name: string; tree: unknown };
type WireEnvelope = { v: number; currentBoardId: string; boards: WireBoard[] };

export type LocalStorageBoardCollectionRepositoryV4Options = {
  storage: Storage;
  codec: TreeCodecV4;
  clock: Clock;
  key?: string;
  seed?: () => BoardCollectionSnapshotV4;
};

export class LocalStorageBoardCollectionRepositoryV4 implements BoardCollectionRepositoryV4 {
  private readonly storage: Storage;
  private readonly codec: TreeCodecV4;
  private readonly clock: Clock;
  private readonly key: string;
  private readonly buildSeed: () => BoardCollectionSnapshotV4;

  constructor(opts: LocalStorageBoardCollectionRepositoryV4Options) {
    this.storage = opts.storage;
    this.codec = opts.codec;
    this.clock = opts.clock;
    this.key = opts.key ?? STORAGE_KEY_V4;
    this.buildSeed = opts.seed ?? (() => defaultSeed(this.clock));
  }

  async load(): Promise<BoardCollectionSnapshotV4> {
    const raw = this.storage.getItem(this.key);
    if (raw === null) {
      const seeded = this.buildSeed();
      this.storage.setItem(this.key, this.serialize(seeded));
      return seeded;
    }
    return this.envelopeToSnapshot(this.parseEnvelope(raw));
  }

  async save(snapshot: BoardCollectionSnapshotV4): Promise<void> {
    try {
      this.storage.setItem(this.key, this.serialize(snapshot));
    } catch (err) {
      if (isQuotaExceeded(err)) throw new StorageFullErrorV4(err);
      throw err;
    }
  }

  private serialize(snapshot: BoardCollectionSnapshotV4): string {
    const envelope: WireEnvelope = {
      v: ENVELOPE_VERSION_V4,
      currentBoardId: snapshot.currentBoardId,
      boards: snapshot.boards.map((b) => ({
        id: b.id,
        name: b.name,
        tree: JSON.parse(this.codec.encode(b.tree)) as unknown,
      })),
    };
    return JSON.stringify(envelope);
  }

  private parseEnvelope(raw: string): WireEnvelope {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch (err) {
      throw new Error(`LocalStorageBoardCollectionRepositoryV4: stored payload is not valid JSON (${(err as Error).message})`);
    }
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("LocalStorageBoardCollectionRepositoryV4: stored payload is not an object");
    }
    const env = parsed as Partial<WireEnvelope>;
    if (typeof env.currentBoardId !== "string" || !Array.isArray(env.boards)) {
      throw new Error("LocalStorageBoardCollectionRepositoryV4: stored payload is missing required fields");
    }
    return env as WireEnvelope;
  }

  private envelopeToSnapshot(env: WireEnvelope): BoardCollectionSnapshotV4 {
    const isLegacyV3 = env.v === 1;
    const boards: BoardV4[] = env.boards.map((b) => ({
      id: b.id,
      name: b.name,
      tree: this.decodeTree(b.tree, isLegacyV3),
    }));
    return { boards, currentBoardId: env.currentBoardId };
  }

  private decodeTree(treeBlob: unknown, isLegacyV3: boolean) {
    const treeText = JSON.stringify(treeBlob);
    if (isLegacyV3) return v4TreeFromV3Root(decodeV3(treeText), this.clock);
    try {
      return this.codec.decode(treeText);
    } catch (err) {
      if (err instanceof JsonCodecV4DecodeError) {
        return v4TreeFromV3Root(decodeV3(treeText), this.clock);
      }
      throw err;
    }
  }
}

function defaultSeed(clock: Clock): BoardCollectionSnapshotV4 {
  const board = buildShowcaseBoardV4(clock);
  return { boards: [board], currentBoardId: board.id };
}

function isQuotaExceeded(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;
  const e = err as { name?: string; code?: number };
  return e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22 || e.code === 1014;
}
