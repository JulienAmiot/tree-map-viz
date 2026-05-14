/**
 * `BoardCollectionRepository` adapter backed by `Storage` (typically the
 * browser's `localStorage`). Per SPEC §11 line 334:
 *
 *  - `load()` empty → seed (returns a non-empty snapshot, also persists it
 *    so subsequent loads are stable).
 *  - `save()` writes to a single key.
 *  - Storage quota faults are translated to a typed `StorageFullError`.
 *
 * The wire envelope:
 * ```json
 * {
 *   "v": 1,
 *   "appMajor": 0,
 *   "currentBoardId": "...",
 *   "boards": [
 *     { "id": "...", "name": "...", "tree": <jsonCodec wire shape> }
 *   ]
 * }
 * ```
 *
 * Each board's `tree` re-uses the per-tree wire format produced by
 * `src/adapters/persistence/jsonCodec.ts`. The double parse/stringify across
 * the codec boundary is intentional: it keeps the codec's contract
 * (string ↔ tree) untouched while letting this adapter store the whole
 * collection as a single JSON document.
 *
 * §17.86 — Runtime version-mismatch handling. The envelope gains an
 * `appMajor: number` field at write time (sourced from {@link APP_MAJOR});
 * `load()` compares it against the running major and classifies into:
 *   - **equal** — load normally (hot path).
 *   - **lower** — try the migrator registry; on miss / failure invoke the
 *     `onVersionMismatch` callback with `{ kind: "migration-failed" }` and
 *     load with default tolerance (§17.42 forward-compat semantics).
 *   - **higher** — future data the running build can't safely consume;
 *     invoke `onVersionMismatch` with `{ kind: "future-data" }` and seed
 *     a fresh snapshot (caller surfaces the banner; the kiosk operator
 *     picks "Continue read-only" or "Reset and lose data" via §17.86b).
 *   - **legacy** (envelope predates §17.86, no `appMajor` field at all) —
 *     silently load (matches §17.42 / §17.14 / §17.63 tolerance pattern;
 *     first boot after upgrade should "just work").
 * The migrator registry ships empty in §17.86; the registry SHAPE is in
 * place for the Phase E codec migration (§17.97-ish) to slot a `v3 → v4`
 * migrator into.
 */

import type {
  Board,
  BoardCollectionRepository,
  BoardCollectionSnapshot,
} from "../../application/ports/BoardCollectionRepository.js";
import type { TreeNode } from "../../domain/nodes/TreeNode.js";
import { APP_MAJOR } from "../../version.js";
import { buildShowcaseBoard } from "../showcaseSeed.js";

import { decode, encode } from "./jsonCodec.js";

/** Default storage key. Versioned (`v1`) so future migrations can rename without collisions. */
export const STORAGE_KEY = "tree-map-viz/board-collection/v1";

/**
 * Legacy storage key — pre-§17.63 builds wrote the board collection here
 * (project was named `tree-graph-viz`; renamed to `tree-map-viz` in §17.63).
 * Retained as a read-side migration hook in {@link LocalStorageBoardCollectionRepository.load};
 * never written to. See SPEC §17.4 / §17.63.
 */
export const LEGACY_STORAGE_KEY = "tree-graph-viz/board-collection/v1";

const ENVELOPE_VERSION = 1;

/** Typed storage-quota error surfaced from `save()`; UI maps it to a user-friendly message. */
export class StorageFullError extends Error {
  constructor(cause?: unknown) {
    super("Local storage quota exceeded — cannot persist the board collection.");
    this.name = "StorageFullError";
    if (cause !== undefined) {
      (this as unknown as { cause: unknown }).cause = cause;
    }
  }
}

type WireBoard = {
  id: string;
  name: string;
  tree: unknown;
  /**
   * SPEC §17.42 — `freshDateColor` was retired with the per-board
   * fresh-date-colour theming hint (§17.21 / §17.31). New writes never
   * emit the field; legacy reads tolerate and discard any leftover
   * value so the kiosk doesn't reject a perfectly good stored payload
   * just because the operator's previous build wrote one. Typed as
   * `unknown` so a hostile / corrupted value can't slip through.
   */
  freshDateColor?: unknown;
};
type WireEnvelope = {
  v: number;
  /**
   * SPEC §17.86 — running app's MAJOR component at write time. Optional
   * on read so envelopes from pre-§17.86 builds load cleanly via the
   * "legacy" branch in {@link LocalStorageBoardCollectionRepository.load}.
   */
  appMajor?: number;
  currentBoardId: string;
  boards: WireBoard[];
};

/**
 * §17.86 — surfaced to the composition root when {@link load} detects a
 * persisted `appMajor` that doesn't match the running build. The kiosk
 * UI displays a banner (§17.86b); the kind discriminates "we tried to
 * migrate but failed" from "this data is from a future release".
 */
export type VersionMismatchInfo =
  | { kind: "migration-failed"; persistedMajor: number; runningMajor: number }
  | { kind: "future-data"; persistedMajor: number; runningMajor: number };

/**
 * §17.86 — migrator function applied when the persisted major is lower
 * than the running major. Returns the new envelope on success, or
 * `undefined` to signal "I can't handle this jump" (the next migrator
 * in the chain tries, or the chain falls through to "migration-failed").
 * The registry ships empty; Phase E (§17.97-ish) registers the first
 * concrete migrator (v3 → v4 codec).
 */
export type EnvelopeMigrator = (
  envelope: WireEnvelope,
  from: number,
  to: number,
) => WireEnvelope | undefined;

export type LocalStorageBoardCollectionRepositoryOptions = {
  /** The Storage to read/write. Inject jsdom's `localStorage` in app code, in-memory fakes in tests. */
  storage: Storage;
  /** Storage key. Defaults to {@link STORAGE_KEY}. */
  key?: string;
  /** Factory used by `load()` when storage is empty. Defaults to a single empty TextNode root. */
  seed?: () => BoardCollectionSnapshot;
  /**
   * §17.86 — running app's MAJOR component. Defaults to {@link APP_MAJOR}
   * imported from `src/version.ts`. Tests inject a fixed value to
   * exercise the mismatch branches without rebuilding the bundle.
   */
  appMajor?: number;
  /**
   * §17.86 — invoked by `load()` when the persisted envelope's
   * `appMajor` doesn't match the running build's major (and a migrator
   * either isn't registered or fails). Composition root surfaces the
   * banner; persistence stays UI-agnostic.
   */
  onVersionMismatch?: (info: VersionMismatchInfo) => void;
  /**
   * §17.86 — ordered list of migrators tried when the persisted major is
   * lower than the running major. Empty by default — Phase E codec
   * migration is the first expected consumer.
   */
  migrators?: readonly EnvelopeMigrator[];
};

export class LocalStorageBoardCollectionRepository implements BoardCollectionRepository {
  private readonly storage: Storage;
  private readonly key: string;
  private readonly buildSeed: () => BoardCollectionSnapshot;
  private readonly appMajor: number;
  private readonly onVersionMismatch: (info: VersionMismatchInfo) => void;
  private readonly migrators: readonly EnvelopeMigrator[];

  constructor(opts: LocalStorageBoardCollectionRepositoryOptions) {
    this.storage = opts.storage;
    this.key = opts.key ?? STORAGE_KEY;
    this.buildSeed = opts.seed ?? defaultSeed;
    this.appMajor = opts.appMajor ?? APP_MAJOR;
    this.onVersionMismatch = opts.onVersionMismatch ?? noop;
    this.migrators = opts.migrators ?? [];
  }

  async load(): Promise<BoardCollectionSnapshot> {
    this.migrateLegacyKeyIfNeeded();
    const raw = this.storage.getItem(this.key);
    if (raw === null) {
      const seeded = this.buildSeed();
      this.storage.setItem(this.key, this.serialize(seeded));
      return seeded;
    }
    const envelope = JSON.parse(raw) as WireEnvelope;
    const compatible = this.classifyAndMaybeMigrate(envelope);
    if (compatible === null) {
      // §17.86 future-data path: persisted major is HIGHER than running.
      // The banner caller drives the kiosk operator's choice between
      // "Continue read-only" and "Reset and lose data" via §17.86b.
      // For now we seed (the safest fallback) and re-persist so the
      // next load is stable; the original payload is overwritten on
      // the seed write. If the operator picks "read-only" before the
      // first save fires, they keep the seeded snapshot in memory.
      const seeded = this.buildSeed();
      this.storage.setItem(this.key, this.serialize(seeded));
      return seeded;
    }
    return this.envelopeToSnapshot(compatible);
  }

  /**
   * §17.86 — version-mismatch classifier. Returns the envelope to decode
   * (possibly migrated) when load should proceed; returns `null` when
   * load should refuse and seed (future-data case). Side-effects: fires
   * the `onVersionMismatch` callback on the migration-failed + future
   * paths.
   */
  private classifyAndMaybeMigrate(envelope: WireEnvelope): WireEnvelope | null {
    const persistedMajor = envelope.appMajor;
    // Legacy envelope (pre-§17.86) — no `appMajor` field at all. Silent
    // tolerance per §17.42 / §17.14 / §17.63: first boot after upgrade
    // should just work. Subsequent saves will stamp the current major.
    if (typeof persistedMajor !== "number") {
      return envelope;
    }
    if (persistedMajor === this.appMajor) {
      return envelope;
    }
    if (persistedMajor < this.appMajor) {
      for (const migrate of this.migrators) {
        const migrated = migrate(envelope, persistedMajor, this.appMajor);
        if (migrated !== undefined) {
          return migrated;
        }
      }
      this.onVersionMismatch({
        kind: "migration-failed",
        persistedMajor,
        runningMajor: this.appMajor,
      });
      // Best-effort load with default tolerance — same as today's §17.42
      // behaviour. The banner caller may surface a non-blocking warning.
      return envelope;
    }
    // persistedMajor > this.appMajor: future data.
    this.onVersionMismatch({
      kind: "future-data",
      persistedMajor,
      runningMajor: this.appMajor,
    });
    return null;
  }

  /**
   * SPEC §17.63 — silent project-rename migration. The §17.4 storage-key
   * prefix flipped from `tree-graph-viz/...` to `tree-map-viz/...` at the
   * project level (npm package + Sonar key + repo all renamed alongside it).
   * Operators upgrading from a pre-§17.63 build still have their boards
   * under the {@link LEGACY_STORAGE_KEY}; on first load AFTER the upgrade
   * we copy the legacy payload byte-for-byte into the new key and delete
   * the legacy entry. No UI surface, no operator interaction — the rename
   * is invisible to the kiosk. The envelope version stays at `v1`: only
   * the key prefix changed, not the wire shape, so a copy-and-delete is
   * the minimum-risk migration (no decode → re-encode round-trip that
   * could surface a subtle wire-shape bug at the worst possible moment).
   *
   * Guards:
   *   - only fires when the consumer is using the default {@link STORAGE_KEY}
   *     (a custom-key caller has its own storage discipline and migration
   *     policy; we don't reach across it);
   *   - never overwrites an existing new-key payload (idempotent across
   *     repeat boots — a legacy leftover that survived a previous run
   *     because of a crash mid-migration is silently ignored once the
   *     new key is populated; the operator's already-saved post-rename
   *     boards win).
   */
  private migrateLegacyKeyIfNeeded(): void {
    if (this.key !== STORAGE_KEY) {
      return;
    }
    if (this.storage.getItem(this.key) !== null) {
      return;
    }
    const legacy = this.storage.getItem(LEGACY_STORAGE_KEY);
    if (legacy === null) {
      return;
    }
    this.storage.setItem(this.key, legacy);
    this.storage.removeItem(LEGACY_STORAGE_KEY);
  }

  async save(snapshot: BoardCollectionSnapshot): Promise<void> {
    try {
      this.storage.setItem(this.key, this.serialize(snapshot));
    } catch (err) {
      if (LocalStorageBoardCollectionRepository.isQuotaExceeded(err)) {
        throw new StorageFullError(err);
      }
      throw err;
    }
  }

  private serialize(snapshot: BoardCollectionSnapshot): string {
    const envelope: WireEnvelope = {
      v: ENVELOPE_VERSION,
      appMajor: this.appMajor,
      currentBoardId: snapshot.currentBoardId,
      boards: snapshot.boards.map((b) => {
        const wire: WireBoard = {
          id: b.id,
          name: b.name,
          tree: JSON.parse(encode(b.tree)) as unknown,
        };
        return wire;
      }),
    };
    return JSON.stringify(envelope);
  }

  private envelopeToSnapshot(parsed: WireEnvelope): BoardCollectionSnapshot {
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("LocalStorageBoardCollectionRepository: stored payload is not an object");
    }
    if (typeof parsed.currentBoardId !== "string" || !Array.isArray(parsed.boards)) {
      throw new Error("LocalStorageBoardCollectionRepository: stored payload is missing required fields");
    }
    const boards: Board[] = parsed.boards.map((b) => {
      // §17.42 — discard any legacy `freshDateColor` carried by older
      // payloads; the field is no longer part of the Board type.
      const board: Board = {
        id: b.id,
        name: b.name,
        tree: decode(JSON.stringify(b.tree)) as TreeNode<unknown>,
      };
      return board;
    });
    return { boards, currentBoardId: parsed.currentBoardId };
  }

  /**
   * Detect the various flavours of quota-exceeded errors browsers throw.
   * - WHATWG `DOMException` with `name === "QuotaExceededError"`
   * - Legacy WebKit code 22 (`QUOTA_EXCEEDED_ERR`)
   * - Firefox legacy `NS_ERROR_DOM_QUOTA_REACHED`
   * - Legacy IE-style code 1014
   */
  private static isQuotaExceeded(err: unknown): boolean {
    if (err === null || typeof err !== "object") {
      return false;
    }
    const e = err as { name?: string; code?: number };
    return (
      e.name === "QuotaExceededError" ||
      e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      e.code === 22 ||
      e.code === 1014
    );
  }
}

function noop(): void {
  // §17.86 — default {@link LocalStorageBoardCollectionRepositoryOptions.onVersionMismatch}.
  // The kiosk composition root replaces this with a banner-surface callback.
}

function defaultSeed(): BoardCollectionSnapshot {
  // SPEC §17.21 — first-boot kiosk lands on the showcase board, which
  // exercises every visible UI branch (TextNode + BSC, all three
  // computed-value branches, eligible/non-eligible mix, dates spanning
  // the timestamp age gradient). Pre-§17.21 callers that relied on the
  // empty single-TextNode "Default Board" should inject a custom
  // `seed` factory through the constructor options.
  const board = buildShowcaseBoard();
  return {
    boards: [board],
    currentBoardId: board.id,
  };
}
