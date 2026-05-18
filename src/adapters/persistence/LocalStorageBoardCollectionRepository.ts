import type {
  BoardCollectionRepository,
  BoardCollectionSnapshot,
  Board,
} from "../../application/ports/BoardCollectionRepository.js";
import type { TreeCodec } from "../../application/ports/TreeCodec.js";
import type { Clock } from "../../domain/capabilities/Clock.js";
import {
  DEFAULT_WORKFLOW_STATUSES,
  InvalidWorkflowStatusError,
  WorkflowStatus,
} from "../../domain/values/WorkflowStatus.js";
import { buildShowcaseBoard } from "../showcaseSeed.js";

/**
 * §17.107 — `BoardCollectionRepository` adapter backed by `Storage`
 * (typically `localStorage`). v4 successor to v3's §17.31
 * `LocalStorageBoardCollectionRepository`, consuming the §17.106b
 * v4-native codec on the read AND write side.
 *
 * **Wire envelope `v: 3`** — top-level
 * `{ v: 3, currentBoardId, boards: [{id, name, tree, workflowStatuses}] }`;
 * each board's `tree` is the §17.106a "v4.0" wire object (NOT a string
 * — embedded directly so the whole envelope round-trips through a
 * single `JSON.parse`/`JSON.stringify` pair). `workflowStatuses` is
 * the §17.117 board-level lookup table (`[{id, label, color}, …]`)
 * referenced by every `WorkflowNode.statusId`; deserialised back into
 * `WorkflowStatus` value objects on read so the application layer
 * never sees the wire shape.
 *
 * **v: 2 → v: 3 auto-migration on read** — boards in an older `v: 2`
 * envelope (pre-§17.117 — every install that booted a §17.110+ build
 * before this strand landed) had no workflow-status table. The reader
 * fills in `DEFAULT_WORKFLOW_STATUSES` (PDCA seed) for every legacy
 * board and writes the upgraded `v: 3` envelope back on the next
 * `save()`. The migration is silent and one-way (we never emit `v: 2`
 * again); operator-visible behaviour: a fresh PDCA badge becomes
 * available on every existing board, no other surface changes.
 *
 * §17.112 Phase F v3 sweep — the v3-fallback decode shim retired. The
 * §17.107 shim composed v3 `jsonCodec` + `v4TreeFromV3Root` bridge to
 * read `v: 1` envelopes (pre-§17.110 cutover) AND to recover corrupted
 * `v: 2` trees as belt-and-braces; with the v3 source files all gone
 * the chain has no implementation left to fall back to. Any operator
 * install that booted a §17.110+ build has already silently re-emitted
 * its envelope as `v: 2` (the LSR's `save()` writes the current
 * envelope version regardless of the load path's version), so the
 * `v: 1` migration window closed. `v: 1` envelopes (or anything not
 * matching the §17.117 read set `{ 2, 3 }`) now surface a clean load
 * error instead of silently bridging. Belt-and-braces recovery is
 * gone too: a corrupted `v: 2 | 3` tree throws verbatim from the
 * §17.106b codec.
 */
export class StorageFullError extends Error {
  constructor(cause?: unknown) {
    super("Local storage quota exceeded — cannot persist the v4 board collection.");
    this.name = "StorageFullError";
    if (cause !== undefined) (this as unknown as { cause: unknown }).cause = cause;
  }
}

export const STORAGE_KEY = "tree-map-viz/board-collection/v1";

const ENVELOPE_VERSION = 3;
const SUPPORTED_ENVELOPE_VERSIONS: readonly number[] = [2, 3];

type WireWorkflowStatus = { id: string; label: string; color: string };
type WireBoard = {
  id: string;
  name: string;
  tree: unknown;
  /** §17.117 — present on `v: 3` envelopes; missing on `v: 2` (filled with PDCA defaults at load). */
  workflowStatuses?: WireWorkflowStatus[];
};
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
        // §17.117 — write the workflow-status table inline next to the
        // tree so the envelope stays single-JSON.parse-friendly. The
        // wire shape is the same `{id, label, color}` triple the
        // `WorkflowStatus.of` factory accepts on the read side.
        workflowStatuses: b.workflowStatuses.map((s) => ({
          id: s.id,
          label: s.label,
          color: s.color,
        })),
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
    if (!SUPPORTED_ENVELOPE_VERSIONS.includes(env.v)) {
      throw new Error(
        `LocalStorageBoardCollectionRepository: unsupported envelope version "v: ${String(env.v)}" — expected one of ${JSON.stringify(SUPPORTED_ENVELOPE_VERSIONS)} (pre-§17.110 v: 1 envelopes are no longer migrated; reset storage to recover)`,
      );
    }
    const boards: Board[] = env.boards.map((b) => ({
      id: b.id,
      name: b.name,
      tree: this.codec.decode(JSON.stringify(b.tree)),
      // §17.117 — v: 3 envelopes carry workflowStatuses inline; v: 2
      // envelopes pre-date the strand and are auto-migrated to the
      // PDCA defaults. The next persist() upgrades the envelope to
      // v: 3 so the legacy shape never goes back to disk.
      workflowStatuses: decodeWorkflowStatuses(b.workflowStatuses),
    }));
    return { boards, currentBoardId: env.currentBoardId };
  }
}

function decodeWorkflowStatuses(
  wire: WireWorkflowStatus[] | undefined,
): readonly WorkflowStatus[] {
  if (wire === undefined) return DEFAULT_WORKFLOW_STATUSES;
  if (!Array.isArray(wire)) {
    throw new Error(
      "LocalStorageBoardCollectionRepository: workflowStatuses must be an array of {id,label,color}",
    );
  }
  // An EMPTY persisted array is honoured verbatim — a future settings
  // strand may let an operator clear the table; we do NOT silently
  // refill the defaults in that case (would mask their intent).
  return wire.map((s, i) => {
    if (typeof s !== "object" || s === null) {
      throw new Error(`LocalStorageBoardCollectionRepository: workflowStatuses[${i}] must be an object`);
    }
    try {
      return WorkflowStatus.of(s.id, s.label, s.color);
    } catch (err) {
      if (err instanceof InvalidWorkflowStatusError) {
        throw new Error(
          `LocalStorageBoardCollectionRepository: workflowStatuses[${i}] is invalid: ${err.message}`,
        );
      }
      throw err;
    }
  });
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
