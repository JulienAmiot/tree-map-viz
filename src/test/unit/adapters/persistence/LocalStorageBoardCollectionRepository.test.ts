import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { encode } from "../../../../adapters/persistence/jsonCodec.js";
import {
  LEGACY_STORAGE_KEY,
  LocalStorageBoardCollectionRepository,
  STORAGE_KEY,
  StorageFullError,
} from "../../../../adapters/persistence/LocalStorageBoardCollectionRepository.js";
import type { BoardCollectionSnapshot } from "../../../../application/ports/BoardCollectionRepository.js";
import { TextCard } from "../../../../domain/nodes/TextCard.js";
import { TextNode } from "../../../../domain/nodes/TextNode.js";
import { Description } from "../../../../domain/values/Description.js";
import { NodeIdentity } from "../../../../domain/values/NodeIdentity.js";
import { Title } from "../../../../domain/values/Title.js";
import { Weight } from "../../../../domain/values/Weight.js";

import { runBoardCollectionRepositoryContract } from "./boardCollectionRepositoryContract.js";

// ---------------------------------------------------------------------------
// Test scaffolding
// ---------------------------------------------------------------------------

function tn(idStr: string, title = "X"): TextNode {
  return new TextNode(
    idStr,
    NodeIdentity.of(Title.of(title), Description.of("")),
    Weight.of(1),
    TextCard.of(),
  );
}

/** In-memory `Storage`-shaped fake. Lets us test isolated from jsdom's shared singleton. */
class InMemoryStorage implements Storage {
  private map = new Map<string, string>();

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

/** Storage that always throws a quota-exceeded DOMException on setItem. */
class QuotaExceededStorage implements Storage {
  get length(): number {
    return 0;
  }
  clear(): void {}
  getItem(): string | null {
    return null;
  }
  key(): string | null {
    return null;
  }
  removeItem(): void {}
  setItem(_key: string, _value: string): void {
    const err = new Error("Quota") as Error & { name: string; code: number };
    err.name = "QuotaExceededError";
    err.code = 22;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Contract suite — runs the same assertions every BoardCollectionRepository
// adapter must satisfy.
// ---------------------------------------------------------------------------

runBoardCollectionRepositoryContract(
  "LocalStorageBoardCollectionRepository",
  async () => new LocalStorageBoardCollectionRepository({ storage: new InMemoryStorage() }),
);

// ---------------------------------------------------------------------------
// Adapter-specific behaviour
// ---------------------------------------------------------------------------

describe("LocalStorageBoardCollectionRepository — adapter-specific", () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  afterEach(() => {
    storage.clear();
  });

  describe("seeding", () => {
    it("seeds a default board on first load when storage is empty", async () => {
      const repo = new LocalStorageBoardCollectionRepository({ storage });
      expect(storage.getItem(STORAGE_KEY)).toBeNull();

      const snapshot = await repo.load();

      expect(snapshot.boards).toHaveLength(1);
      expect(snapshot.currentBoardId).toBe(snapshot.boards[0]!.id);
      expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    });

    it("uses an injected seed factory when provided", async () => {
      const seed = (): BoardCollectionSnapshot => ({
        boards: [{ id: "custom-seed", name: "Custom", tree: tn("seed-root") }],
        currentBoardId: "custom-seed",
      });
      const repo = new LocalStorageBoardCollectionRepository({ storage, seed });

      const snapshot = await repo.load();

      expect(snapshot.boards[0]!.id).toBe("custom-seed");
      expect(snapshot.boards[0]!.name).toBe("Custom");
    });

    it("default seed lands on the showcase board (\u00a717.21)", async () => {
      const repo = new LocalStorageBoardCollectionRepository({ storage });
      const snapshot = await repo.load();
      expect(snapshot.boards).toHaveLength(1);
      const board = snapshot.boards[0]!;
      expect(board.id).toBe("showcase-board");
      expect(board.name).toBe("Showcase");
      // Sanity: the root has more than one direct child (the rich
      // showcase exercises every visible UI branch).
      expect(board.tree.children.length).toBeGreaterThanOrEqual(3);
    });

    it("tolerates a legacy stored freshDateColor on read (\u00a717.42 migration)", async () => {
      // §17.42 retired the per-board fresh-date colour. Operators
      // upgrading from a build that wrote the field still have it
      // in their browser localStorage. The repo MUST decode such
      // payloads without throwing and MUST drop the field on the
      // resulting Board snapshot (the type no longer carries it).
      //
      // We synthesise the legacy envelope by reusing the live codec
      // for the tree wire shape, then injecting `freshDateColor`
      // back at the board envelope layer (the field the §17.42
      // migration deliberately drops on decode).
      const board = tn("legacy-root", "Legacy themed");
      const treeWire = JSON.parse(encode(board)) as unknown;
      const legacyEnvelope = {
        v: 1,
        currentBoardId: "legacy",
        boards: [
          {
            id: "legacy",
            name: "Legacy themed",
            tree: treeWire,
            freshDateColor: "#743089",
          },
        ],
      };
      storage.setItem(STORAGE_KEY, JSON.stringify(legacyEnvelope));

      const repo = new LocalStorageBoardCollectionRepository({ storage });
      const reloaded = await repo.load();

      expect(reloaded.boards).toHaveLength(1);
      const reloadedBoard = reloaded.boards[0]!;
      expect(reloadedBoard.id).toBe("legacy");
      expect(reloadedBoard.name).toBe("Legacy themed");
      // Field is no longer part of the Board type; explicitly absent
      // on the decoded snapshot so downstream code never observes it.
      expect((reloadedBoard as Record<string, unknown>).freshDateColor).toBeUndefined();
    });

    it("does NOT re-seed on subsequent loads after the first save", async () => {
      const repo = new LocalStorageBoardCollectionRepository({ storage });
      await repo.load();

      const snapshot: BoardCollectionSnapshot = {
        boards: [{ id: "user-made", name: "User", tree: tn("u") }],
        currentBoardId: "user-made",
      };
      await repo.save(snapshot);

      const reloaded = await repo.load();
      expect(reloaded.boards).toHaveLength(1);
      expect(reloaded.boards[0]!.id).toBe("user-made");
    });
  });

  describe("storage key discipline", () => {
    it("save() writes to exactly one key (the configured STORAGE_KEY)", async () => {
      const repo = new LocalStorageBoardCollectionRepository({ storage });
      const snapshot: BoardCollectionSnapshot = {
        boards: [{ id: "k", name: "K", tree: tn("kr") }],
        currentBoardId: "k",
      };

      await repo.save(snapshot);

      expect(storage.length).toBe(1);
      expect(storage.key(0)).toBe(STORAGE_KEY);
    });

    it("honours a custom storage key when provided", async () => {
      const customKey = "custom-namespace/board-collection";
      const repo = new LocalStorageBoardCollectionRepository({ storage, key: customKey });
      const snapshot: BoardCollectionSnapshot = {
        boards: [{ id: "k", name: "K", tree: tn("kr") }],
        currentBoardId: "k",
      };

      await repo.save(snapshot);

      expect(storage.getItem(customKey)).not.toBeNull();
      expect(storage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe("error handling", () => {
    it("translates QuotaExceededError into a typed StorageFullError", async () => {
      const repo = new LocalStorageBoardCollectionRepository({ storage: new QuotaExceededStorage() });
      const snapshot: BoardCollectionSnapshot = {
        boards: [{ id: "x", name: "X", tree: tn("x") }],
        currentBoardId: "x",
      };

      await expect(repo.save(snapshot)).rejects.toBeInstanceOf(StorageFullError);
    });

    it("propagates other unexpected storage errors unchanged", async () => {
      const angry: Storage = {
        ...new InMemoryStorage(),
        setItem: () => {
          throw new TypeError("unexpected");
        },
      } as unknown as Storage;
      const repo = new LocalStorageBoardCollectionRepository({ storage: angry });

      await expect(
        repo.save({
          boards: [{ id: "x", name: "X", tree: tn("x") }],
          currentBoardId: "x",
        }),
      ).rejects.toBeInstanceOf(TypeError);
    });

    it("rejects with a clear error when the stored payload is corrupted JSON", async () => {
      storage.setItem(STORAGE_KEY, "not-actually-json{");
      const repo = new LocalStorageBoardCollectionRepository({ storage });

      await expect(repo.load()).rejects.toThrow();
    });
  });

  describe("\u00a717.63 legacy storage-key migration", () => {
    // The pre-§17.63 builds wrote under `tree-graph-viz/board-collection/v1`;
    // the §17.63 rename flipped the prefix to `tree-map-viz/...`. Operators
    // upgrading from a pre-§17.63 build still have their saved boards under
    // the legacy key; load() must copy them across silently on first boot
    // (envelope shape unchanged at v1 — copy-and-delete, not decode/encode).

    it("copies a legacy payload to the new key and clears the legacy entry on first load", async () => {
      const board = tn("legacy-root", "From the pre-rename world");
      const treeWire = JSON.parse(encode(board)) as unknown;
      const legacyEnvelope = {
        v: 1,
        currentBoardId: "legacy-id",
        boards: [{ id: "legacy-id", name: "Legacy", tree: treeWire }],
      };
      storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyEnvelope));

      const repo = new LocalStorageBoardCollectionRepository({ storage });
      const snapshot = await repo.load();

      expect(snapshot.boards).toHaveLength(1);
      expect(snapshot.boards[0]!.id).toBe("legacy-id");
      expect(snapshot.boards[0]!.name).toBe("Legacy");
      expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
      expect(storage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
      // Migration MUST be a byte-for-byte copy (no decode → re-encode).
      expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(legacyEnvelope));
    });

    it("ignores the legacy key when the new key is already populated (post-migration boot)", async () => {
      // On a second boot, the legacy key is normally already empty.
      // But a crash between setItem and removeItem could leave the
      // legacy entry behind — the operator's already-saved post-rename
      // boards must still win, and the leftover must NOT clobber them.
      const repo1 = new LocalStorageBoardCollectionRepository({ storage });
      await repo1.load();
      const newKeyPayload = storage.getItem(STORAGE_KEY)!;
      storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ v: 1, currentBoardId: "stale", boards: [] }));

      const repo2 = new LocalStorageBoardCollectionRepository({ storage });
      await repo2.load();

      expect(storage.getItem(STORAGE_KEY)).toBe(newKeyPayload);
      expect(storage.getItem(LEGACY_STORAGE_KEY)).not.toBeNull();
    });

    it("does NOT migrate when a custom storage key is configured", async () => {
      // Custom-key callers have their own storage discipline; the
      // §17.63 default-key migration must never reach across to a
      // legacy entry on their behalf.
      storage.setItem(LEGACY_STORAGE_KEY, '{"v":1,"currentBoardId":"x","boards":[]}');
      const repo = new LocalStorageBoardCollectionRepository({
        storage,
        key: "custom-namespace/board-collection",
      });

      await repo.load();

      expect(storage.getItem(LEGACY_STORAGE_KEY)).not.toBeNull();
      expect(storage.getItem(STORAGE_KEY)).toBeNull();
    });
  });
});
