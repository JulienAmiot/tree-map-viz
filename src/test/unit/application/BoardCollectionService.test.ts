import { beforeEach, describe, expect, it } from "vitest";

import { BoardCollectionService } from "../../../application/BoardCollectionService.js";
import type {
  Board,
  BoardCollectionRepository,
  BoardCollectionSnapshot,
} from "../../../application/ports/BoardCollectionRepository.js";
import type { IdGenerator } from "../../../application/ports/IdGenerator.js";
import { TextNode } from "../../../domain/nodes/TextNode.js";
import { Description } from "../../../domain/values/Description.js";
import { NodeIdentity } from "../../../domain/values/NodeIdentity.js";
import { Title } from "../../../domain/values/Title.js";
import { Weight } from "../../../domain/values/Weight.js";

// ----- test helpers ---------------------------------------------------------

function freshTree(idStr: string): TextNode {
  const identity = NodeIdentity.of(Title.of("Root"), Description.of(""));
  return new TextNode(idStr, identity, Weight.of(1));
}

function makeBoard(id: string, name: string): Board {
  return { id, name, tree: freshTree(`tree-of-${id}`) };
}

function makeSnapshot(boards: Board[], currentBoardId: string): BoardCollectionSnapshot {
  return { boards, currentBoardId };
}

class FakeBoardCollectionRepository implements BoardCollectionRepository {
  private snapshot: BoardCollectionSnapshot;
  public saveCallCount = 0;
  public lastSaved: BoardCollectionSnapshot | null = null;

  constructor(initial: BoardCollectionSnapshot) {
    this.snapshot = initial;
  }

  async load(): Promise<BoardCollectionSnapshot> {
    return { ...this.snapshot, boards: [...this.snapshot.boards] };
  }

  async save(snapshot: BoardCollectionSnapshot): Promise<void> {
    this.saveCallCount += 1;
    this.lastSaved = { ...snapshot, boards: [...snapshot.boards] };
    this.snapshot = this.lastSaved;
  }
}

function sequentialIdGen(prefix = "new"): IdGenerator {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

// ----- tests ----------------------------------------------------------------

describe("BoardCollectionService", () => {
  let repo: FakeBoardCollectionRepository;
  let initialBoards: Board[];

  beforeEach(() => {
    initialBoards = [makeBoard("b1", "Alpha"), makeBoard("b2", "Beta")];
    repo = new FakeBoardCollectionRepository(makeSnapshot(initialBoards, "b1"));
  });

  describe("create() — load from repository", () => {
    it("loads the snapshot and exposes boards + current id", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());

      expect(svc.list().map((b) => b.id)).toEqual(["b1", "b2"]);
      expect(svc.getCurrentBoardId()).toBe("b1");
      expect(svc.getCurrentBoard().name).toBe("Alpha");
    });

    it("does not save during construction (load is read-only)", async () => {
      await BoardCollectionService.create(repo, sequentialIdGen());
      expect(repo.saveCallCount).toBe(0);
    });

    it("returns a defensive copy from list() so callers cannot mutate internal state", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());
      const list = svc.list();

      expect(() => {
        // Readonly array at the type level; runtime defensive copy expected.
        (list as Board[]).push(makeBoard("hacker", "Hacker"));
      }).not.toThrow();

      expect(svc.list().map((b) => b.id)).toEqual(["b1", "b2"]);
    });
  });

  describe("switchTo", () => {
    it("switches to a known board id and persists", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());

      const r = await svc.switchTo("b2");

      expect(r).toEqual({ ok: true });
      expect(svc.getCurrentBoardId()).toBe("b2");
      expect(repo.saveCallCount).toBe(1);
      expect(repo.lastSaved?.currentBoardId).toBe("b2");
    });

    it("rejects an unknown board id without mutating state", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());

      const r = await svc.switchTo("nope");

      expect(r.ok).toBe(false);
      expect(svc.getCurrentBoardId()).toBe("b1");
      expect(repo.saveCallCount).toBe(0);
    });

    it("treats switching to the already-current board as a no-op success without persisting", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());

      const r = await svc.switchTo("b1");

      expect(r).toEqual({ ok: true });
      expect(repo.saveCallCount).toBe(0);
    });
  });

  describe("rename", () => {
    it("renames a known board, trims whitespace, and persists", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());

      const r = await svc.rename("b2", "  Renamed Beta  ");

      expect(r).toEqual({ ok: true });
      expect(svc.list().find((b) => b.id === "b2")?.name).toBe("Renamed Beta");
      expect(repo.saveCallCount).toBe(1);
      expect(repo.lastSaved?.boards.find((b) => b.id === "b2")?.name).toBe("Renamed Beta");
    });

    it("rejects an unknown board id", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());

      const r = await svc.rename("nope", "Whatever");

      expect(r.ok).toBe(false);
      expect(repo.saveCallCount).toBe(0);
    });

    it("rejects an empty / whitespace-only name", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());

      const r1 = await svc.rename("b1", "");
      const r2 = await svc.rename("b1", "   ");

      expect(r1.ok).toBe(false);
      expect(r2.ok).toBe(false);
      expect(svc.list().find((b) => b.id === "b1")?.name).toBe("Alpha");
      expect(repo.saveCallCount).toBe(0);
    });
  });

  describe("createBoard", () => {
    it("appends a new board with a generated id, switches to it, and persists", async () => {
      const idGen = sequentialIdGen("uuid");
      const svc = await BoardCollectionService.create(repo, idGen);
      const newTree = freshTree("freshly-made");

      const r = await svc.createBoard("Gamma", newTree);

      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.board.id).toBe("uuid-1");
        expect(r.board.name).toBe("Gamma");
        expect(r.board.tree).toBe(newTree);
      }
      expect(svc.list().map((b) => b.id)).toEqual(["b1", "b2", "uuid-1"]);
      expect(svc.getCurrentBoardId()).toBe("uuid-1");
      expect(repo.saveCallCount).toBe(1);
    });

    it("trims the new board's name", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen("uuid"));

      const r = await svc.createBoard("  Trim me  ", freshTree("t"));

      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.board.name).toBe("Trim me");
      }
    });

    it("rejects an empty / whitespace-only name without persisting or mutating state", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen("uuid"));

      const r1 = await svc.createBoard("", freshTree("t1"));
      const r2 = await svc.createBoard("   ", freshTree("t2"));

      expect(r1.ok).toBe(false);
      expect(r2.ok).toBe(false);
      expect(svc.list().map((b) => b.id)).toEqual(["b1", "b2"]);
      expect(svc.getCurrentBoardId()).toBe("b1");
      expect(repo.saveCallCount).toBe(0);
    });
  });

  describe("repository boundary (hexagonal)", () => {
    it("forwards every save through the port (no direct storage knowledge)", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen("uuid"));

      await svc.switchTo("b2");
      await svc.rename("b1", "Alpha-renamed");
      await svc.createBoard("Delta", freshTree("d"));

      expect(repo.saveCallCount).toBe(3);
      expect(repo.lastSaved?.currentBoardId).toBe("uuid-1");
      expect(repo.lastSaved?.boards.map((b) => b.name)).toEqual([
        "Alpha-renamed",
        "Beta",
        "Delta",
      ]);
    });
  });
});
