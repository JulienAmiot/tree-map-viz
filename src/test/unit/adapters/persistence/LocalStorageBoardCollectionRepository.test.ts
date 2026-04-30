import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
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
});
