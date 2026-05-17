import { beforeEach, describe, expect, it } from "vitest";

import { BoardCollectionService } from "../../../application/BoardCollectionService.js";
import type {
  Board,
  BoardCollectionRepository,
  BoardCollectionSnapshot,
} from "../../../application/ports/BoardCollectionRepository.js";
import type { IdGenerator } from "../../../application/ports/IdGenerator.js";
import type { Clock } from "../../../domain/capabilities/Clock.js";
import { TextNode } from "../../../domain/nodes/TextNode.js";
import { Tree } from "../../../domain/Tree.js";
import { Timestamp } from "../../../domain/values/Timestamp.js";
import { Weight } from "../../../domain/values/Weight.js";

const clock: Clock = { now: () => Timestamp.of(new Date("2026-05-16T15:00:00Z")) };
const freshTree = (id: string): Tree => new Tree(new TextNode(`root-of-${id}`, "Root", Weight.of(1), clock));
const makeBoard = (id: string, name: string): Board => ({ id, name, tree: freshTree(id) });
const sequentialIdGen = (prefix = "new"): IdGenerator => { let n = 0; return () => `${prefix}-${++n}`; };

class FakeRepoV4 implements BoardCollectionRepository {
  private snapshot: BoardCollectionSnapshot;
  public saveCallCount = 0;
  public lastSaved: BoardCollectionSnapshot | null = null;
  constructor(initial: BoardCollectionSnapshot) { this.snapshot = initial; }
  async load(): Promise<BoardCollectionSnapshot> { return { ...this.snapshot, boards: [...this.snapshot.boards] }; }
  async save(snapshot: BoardCollectionSnapshot): Promise<void> {
    this.saveCallCount += 1;
    this.lastSaved = { ...snapshot, boards: [...snapshot.boards] };
    this.snapshot = this.lastSaved;
  }
}

describe("BoardCollectionService (§17.102 — type-only successor; Tree opaque)", () => {
  let repo: FakeRepoV4;

  beforeEach(() => {
    repo = new FakeRepoV4({ boards: [makeBoard("b1", "Alpha"), makeBoard("b2", "Beta")], currentBoardId: "b1" });
  });

  it("create() + list() + getCurrentBoard() + getCurrentBoardId() — loads snapshot, no save on construction, exposes opaque trees", async () => {
    const svc = await BoardCollectionService.create(repo, sequentialIdGen());
    expect(svc.list().map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(svc.getCurrentBoardId()).toBe("b1");
    expect(svc.getCurrentBoard().name).toBe("Alpha");
    expect(svc.getCurrentBoard().tree).toBeInstanceOf(Tree);
    expect(repo.saveCallCount).toBe(0);
  });

  it("switchTo() — switches valid id, rejects unknown id, no-ops on same id (no save)", async () => {
    const svc = await BoardCollectionService.create(repo, sequentialIdGen());
    const ok = await svc.switchTo("b2");
    expect(ok.ok).toBe(true);
    expect(svc.getCurrentBoardId()).toBe("b2");
    expect(repo.saveCallCount).toBe(1);

    const sameAgain = await svc.switchTo("b2");
    expect(sameAgain.ok).toBe(true);
    expect(repo.saveCallCount).toBe(1);

    const missing = await svc.switchTo("nope");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toBe("Board not found.");
  });

  it("rename() + updateSettings() — happy + trim + empty-name + unknown-id all surface { ok, reason } correctly", async () => {
    const svc = await BoardCollectionService.create(repo, sequentialIdGen());

    const r1 = await svc.rename("b1", "  Renamed  ");
    expect(r1.ok).toBe(true);
    expect(svc.list().find((b) => b.id === "b1")!.name).toBe("Renamed");

    const r2 = await svc.rename("b1", "   ");
    expect(r2.ok).toBe(false);
    const r3 = await svc.rename("missing", "X");
    expect(r3.ok).toBe(false);

    const r4 = await svc.updateSettings("b2", { name: " Beta2 " });
    expect(r4.ok).toBe(true);
    expect(svc.list().find((b) => b.id === "b2")!.name).toBe("Beta2");

    const r5 = await svc.updateSettings("b2", { name: "" });
    expect(r5.ok).toBe(false);
    const r6 = await svc.updateSettings("ghost", { name: "X" });
    expect(r6.ok).toBe(false);
  });

  it("createBoard() — happy + trim + empty-name + auto-current + persists; injected idGen produces the new id", async () => {
    const svc = await BoardCollectionService.create(repo, sequentialIdGen("fresh"));

    const ok = await svc.createBoard("  Gamma  ", freshTree("g"));
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.board.id).toBe("fresh-1");
      expect(ok.board.name).toBe("Gamma");
    }
    expect(svc.getCurrentBoardId()).toBe("fresh-1");
    expect(svc.list()).toHaveLength(3);

    const empty = await svc.createBoard("   ", freshTree("e"));
    expect(empty.ok).toBe(false);
    expect(svc.list()).toHaveLength(3);
  });

  it("replaceCurrentTree() + deleteBoard() — replaces tree opaquely; refuses to delete the last remaining board; falls back to first board on current-id deletion", async () => {
    const svc = await BoardCollectionService.create(repo, sequentialIdGen());

    const newTree = freshTree("replaced");
    await svc.replaceCurrentTree(newTree);
    expect(svc.getCurrentBoard().tree).toBe(newTree);

    const r1 = await svc.deleteBoard("b1");
    expect(r1.ok).toBe(true);
    expect(svc.list().map((b) => b.id)).toEqual(["b2"]);
    expect(svc.getCurrentBoardId()).toBe("b2");

    const lastOne = await svc.deleteBoard("b2");
    expect(lastOne.ok).toBe(false);
    if (!lastOne.ok) expect(lastOne.reason).toMatch(/last remaining/i);
  });
});
