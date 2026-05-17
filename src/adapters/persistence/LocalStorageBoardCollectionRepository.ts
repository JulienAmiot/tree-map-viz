import type {
  BoardCollectionRepository,
  BoardCollectionSnapshot,
  Board,
} from "../../application/ports/BoardCollectionRepository.js";
import type { TreeCodec } from "../../application/ports/TreeCodec.js";
import type { Clock } from "../../domain/capabilities/Clock.js";
import { buildShowcaseBoard } from "../showcaseSeed.js";

/**
 * §17.107 — `BoardCollectionRepository` adapter backed by `Storage`
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
 * §17.112 Phase F v3 sweep — the v3-fallback decode shim retired. The
 * §17.107 shim composed v3 `jsonCodec` + `v4TreeFromV3Root` bridge to
 * read `v: 1` envelopes (pre-§17.110 cutover) AND to recover corrupted
 * `v: 2` trees as belt-and-braces; with the v3 source files all gone
 * the chain has no implementation left to fall back to. Any operator
 * install that booted a §17.110+ build has already silently re-emitted
 * its envelope as `v: 2` (the LSR's `save()` writes `v: 2` regardless
 * of the load path's version), so the migration window closed.
 * `v: 1` envelopes (or anything else not matching `v: 2`) now surface
 * a clean load error instead of silently bridging. Belt-and-braces
 * recovery is gone too: a corrupted `v: 2` tree throws verbatim from
 * the §17.106b codec.
 */
export class StorageFullError extends Error {
  constructor(cause?: unknown) {
    super("Local storage quota exceeded — cannot persist the v4 board collection.");
    this.name = "StorageFullError";
    if (cause !== undefined) (this as unknown as { cause: unknown }).cause = cause;
  }
}

export const STORAGE_KEY = "tree-map-viz/board-collection/v1";

const ENVELOPE_VERSION = 2;

type WireBoard = { id: string; name: string; tree: unknown };
type WireEnvelope = { v: number; currentBoardId: string; boards: WireBoard[] };

export type LocalStorageBoardCollectionRepositoryOptions = {
  storage: Storage;
  codec: TreeCodec;
  clock: Clock;
  key?: string;
  seed?: () => BoardCollectionSnapshot;
};

export class LocalStorageBoardCollectionRepository implements BoardCollectionRepository {
  private readonly storage: Storage;
  private readonly codec: TreeCodec;
  private readonly clock: Clock;
  private readonly key: string;
  private readonly buildSeed: () => BoardCollectionSnapshot;

  constructor(opts: LocalStorageBoardCollectionRepositoryOptions) {
    this.storage = opts.storage;
    this.codec = opts.codec;
    this.clock = opts.clock;
    this.key = opts.key ?? STORAGE_KEY;
    this.buildSeed = opts.seed ?? (() => defaultSeed(this.clock));
  }

  async load(): Promise<BoardCollectionSnapshot> {
    const raw = this.storage.getItem(this.key);
    if (raw === null) {
      const seeded = this.buildSeed();
      this.storage.setItem(this.key, this.serialize(seeded));
      return seeded;
    }
    return this.envelopeToSnapshot(this.parseEnvelope(raw));
  }

  async save(snapshot: BoardCollectionSnapshot): Promise<void> {
    try {
      this.storage.setItem(this.key, this.serialize(snapshot));
    } catch (err) {
      if (isQuotaExceeded(err)) throw new StorageFullError(err);
      throw err;
    }
  }

  private serialize(snapshot: BoardCollectionSnapshot): string {
    const envelope: WireEnvelope = {
      v: ENVELOPE_VERSION,
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
      throw new Error(`LocalStorageBoardCollectionRepository: stored payload is not valid JSON (${(err as Error).message})`);
    }
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("LocalStorageBoardCollectionRepository: stored payload is not an object");
    }
    const env = parsed as Partial<WireEnvelope>;
    if (typeof env.currentBoardId !== "string" || !Array.isArray(env.boards)) {
      throw new Error("LocalStorageBoardCollectionRepository: stored payload is missing required fields");
    }
    return env as WireEnvelope;
  }

  private envelopeToSnapshot(env: WireEnvelope): BoardCollectionSnapshot {
    if (env.v !== ENVELOPE_VERSION) {
      throw new Error(
        `LocalStorageBoardCollectionRepository: unsupported envelope version "v: ${String(env.v)}" — expected "v: ${String(ENVELOPE_VERSION)}" (pre-§17.110 v: 1 envelopes are no longer migrated; reset storage to recover)`,
      );
    }
    const boards: Board[] = env.boards.map((b) => ({
      id: b.id,
      name: b.name,
      tree: this.codec.decode(JSON.stringify(b.tree)),
    }));
    return { boards, currentBoardId: env.currentBoardId };
  }
}

function defaultSeed(clock: Clock): BoardCollectionSnapshot {
  const board = buildShowcaseBoard(clock);
  return { boards: [board], currentBoardId: board.id };
}

function isQuotaExceeded(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;
  const e = err as { name?: string; code?: number };
  return e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22 || e.code === 1014;
}
