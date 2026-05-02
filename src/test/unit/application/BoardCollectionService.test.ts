import { beforeEach, describe, expect, it } from "vitest";

import { BoardCollectionService } from "../../../application/BoardCollectionService.js";
import type {
  Board,
  BoardCollectionRepository,
  BoardCollectionSnapshot,
} from "../../../application/ports/BoardCollectionRepository.js";
import type { IdGenerator } from "../../../application/ports/IdGenerator.js";
import { TextCard } from "../../../domain/nodes/TextCard.js";
import { TextNode } from "../../../domain/nodes/TextNode.js";
import { Description } from "../../../domain/values/Description.js";
import { NodeIdentity } from "../../../domain/values/NodeIdentity.js";
import { Title } from "../../../domain/values/Title.js";
import { Weight } from "../../../domain/values/Weight.js";

// ----- test helpers ---------------------------------------------------------

function freshTree(idStr: string): TextNode {
  const identity = NodeIdentity.of(Title.of("Root"), Description.of(""));
  return new TextNode(idStr, identity, Weight.of(1), TextCard.of());
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

  describe("updateSettings (\u00a717.31, simplified by \u00a717.42)", () => {
    // SPEC §17.31 — single round-trip patch for the board's mutable
    // settings. §17.42 retired the per-board fresh-date colour; the
    // patch surface is now `{ name? }` only. The method is kept
    // (rather than collapsing into `rename`) so the modal's confirm
    // event has a single service-level entry point.

    it("patches the name and persists", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());

      const r = await svc.updateSettings("b1", { name: "Alpha-themed" });

      expect(r).toEqual({ ok: true });
      expect(svc.list().find((b) => b.id === "b1")?.name).toBe("Alpha-themed");
      expect(repo.saveCallCount).toBe(1);
    });

    it("leaves the name unchanged when its key is omitted", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());

      const r = await svc.updateSettings("b1", {});

      expect(r).toEqual({ ok: true });
      expect(svc.list().find((b) => b.id === "b1")?.name).toBe("Alpha");
    });

    it("trims the name and rejects empty / whitespace-only", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());

      const r1 = await svc.updateSettings("b1", { name: "" });
      const r2 = await svc.updateSettings("b1", { name: "   " });
      const r3 = await svc.updateSettings("b1", { name: "  Trimmed  " });

      expect(r1.ok).toBe(false);
      expect(r2.ok).toBe(false);
      expect(r3).toEqual({ ok: true });
      expect(svc.list().find((b) => b.id === "b1")?.name).toBe("Trimmed");
    });

    it("rejects an unknown board id", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());
      const r = await svc.updateSettings("nope", { name: "X" });
      expect(r.ok).toBe(false);
      expect(repo.saveCallCount).toBe(0);
    });
  });

  describe("deleteBoard (\u00a717.31)", () => {
    // SPEC §17.31 — remove a board from the collection. Refuses on
    // the last-remaining board (the `getCurrentBoard` invariant
    // assumes ≥ 1 board exists). Deleting the current board promotes
    // the first remaining board to current.

    it("removes a non-current board and keeps the current id put", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());

      const r = await svc.deleteBoard("b2");

      expect(r).toEqual({ ok: true });
      expect(svc.list().map((b) => b.id)).toEqual(["b1"]);
      expect(svc.getCurrentBoardId()).toBe("b1");
      expect(repo.saveCallCount).toBe(1);
    });

    it("removes the current board and promotes the first remaining as current", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());

      const r = await svc.deleteBoard("b1");

      expect(r).toEqual({ ok: true });
      expect(svc.list().map((b) => b.id)).toEqual(["b2"]);
      expect(svc.getCurrentBoardId()).toBe("b2");
    });

    it("refuses to delete the last remaining board", async () => {
      // §17.31 — `getCurrentBoard` requires ≥ 1 board. Settings UI
      // disables the Delete button at 1 board; the service-side
      // guard is defence-in-depth.
      const lonely = new FakeBoardCollectionRepository(
        makeSnapshot([makeBoard("only", "Solo")], "only"),
      );
      const svc = await BoardCollectionService.create(lonely, sequentialIdGen());

      const r = await svc.deleteBoard("only");

      expect(r.ok).toBe(false);
      expect(svc.list().map((b) => b.id)).toEqual(["only"]);
      expect(svc.getCurrentBoardId()).toBe("only");
    });

    it("rejects an unknown board id without persisting", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());

      const r = await svc.deleteBoard("nope");

      expect(r.ok).toBe(false);
      expect(svc.list().map((b) => b.id)).toEqual(["b1", "b2"]);
      expect(repo.saveCallCount).toBe(0);
    });
  });

  describe("replaceCurrentTree (§17.33)", () => {
    // SPEC §17.33 — atomic swap of the current board's tree, used by
    // the Import flow. Other boards stay untouched; the board's
    // mutable settings (name) are preserved across the swap.

    it("swaps the current board's tree and persists", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());
      const incoming = freshTree("imported");

      await svc.replaceCurrentTree(incoming);

      expect(svc.getCurrentBoard().tree).toBe(incoming);
      expect(svc.getCurrentBoard().id).toBe("b1");
      expect(repo.saveCallCount).toBe(1);
      expect(repo.lastSaved?.boards.find((b) => b.id === "b1")?.tree).toBe(
        incoming,
      );
    });

    it("leaves other boards in the collection untouched", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());
      const otherTreeBefore = svc.list().find((b) => b.id === "b2")?.tree;
      const incoming = freshTree("imported");

      await svc.replaceCurrentTree(incoming);

      // Pre-§17.33 contract: import replaces the CURRENT board only; sibling
      // boards' trees are preserved by reference.
      expect(svc.list().find((b) => b.id === "b2")?.tree).toBe(otherTreeBefore);
      expect(svc.list().map((b) => b.id)).toEqual(["b1", "b2"]);
    });

    it("preserves the board's name across the swap", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());

      await svc.replaceCurrentTree(freshTree("imported"));

      expect(svc.getCurrentBoard().name).toBe("Alpha");
    });

    it("triggers exactly one persistence round-trip", async () => {
      const svc = await BoardCollectionService.create(repo, sequentialIdGen());
      const before = repo.saveCallCount;

      await svc.replaceCurrentTree(freshTree("imported"));

      expect(repo.saveCallCount - before).toBe(1);
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
