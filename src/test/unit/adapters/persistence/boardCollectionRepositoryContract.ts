/**
 * Reusable contract test for any `BoardCollectionRepository` adapter.
 *
 * Per SPEC §11 line 334 the LocalStorage adapter ships with a contract test
 * "shared with future adapters". This module is the contract.
 *
 * Vitest only auto-discovers `*.test.ts`, so this `.ts` helper is never run
 * on its own — adapter tests import {@link runBoardCollectionRepositoryContract}
 * and pass a factory that returns a fresh repository instance per test.
 *
 * Invariants tested:
 *  - `load()` returns a structurally well-formed (non-empty) snapshot — adapters
 *    that find no stored data MUST seed.
 *  - `save()` then `load()` round-trips the snapshot (currentBoardId + boards).
 *  - Multi-board snapshots survive serialization.
 *  - Trees with both `TextNode` and `BusinessScoreCardNode` survive
 *    serialization with their identity / weight / objective / history intact.
 */

import { describe, expect, it } from "vitest";

import type {
  BoardCollectionRepository,
  BoardCollectionSnapshot,
} from "../../../../application/ports/BoardCollectionRepository.js";
import { BusinessScoreCard } from "../../../../domain/nodes/BusinessScoreCard.js";
import { BusinessScoreCardNode } from "../../../../domain/nodes/BusinessScoreCardNode.js";
import { TextNode } from "../../../../domain/nodes/TextNode.js";
import type { TreeNode } from "../../../../domain/nodes/TreeNode.js";
import { Description } from "../../../../domain/values/Description.js";
import { NodeIdentity } from "../../../../domain/values/NodeIdentity.js";
import { Objective } from "../../../../domain/values/Objective.js";
import { TimestampedValue } from "../../../../domain/values/TimestampedValue.js";
import { Title } from "../../../../domain/values/Title.js";
import { Unit } from "../../../../domain/values/Unit.js";
import { Weight } from "../../../../domain/values/Weight.js";

export type RepoFactory = () => Promise<BoardCollectionRepository>;

function tn(idStr: string, title: string, weight = 1): TextNode {
  return new TextNode(
    idStr,
    NodeIdentity.of(Title.of(title), Description.of("")),
    Weight.of(weight),
  );
}

function bsc(idStr: string, title: string, weight = 1): BusinessScoreCardNode<number> {
  const card = BusinessScoreCard.of(
    Unit.of("USD"),
    Objective.of(0, 100, new Date("2026-12-31T00:00:00Z")),
    [
      TimestampedValue.of(10, new Date("2026-04-01T00:00:00Z")),
      TimestampedValue.of(40, new Date("2026-04-15T00:00:00Z")),
    ],
  );
  return new BusinessScoreCardNode<number>(
    idStr,
    NodeIdentity.of(Title.of(title), Description.of("d")),
    Weight.of(weight),
    card,
    false,
    true,
  );
}

function richTree(rootId: string): TreeNode<unknown> {
  const root = tn(`${rootId}-root`, "Root");
  const a = bsc(`${rootId}-a`, "Alpha", 2);
  const b = tn(`${rootId}-b`, "Bravo", 3);
  const c = bsc(`${rootId}-c`, "Charlie", 1);
  root.attach(a);
  root.attach(b);
  b.attach(c);
  return root;
}

export function runBoardCollectionRepositoryContract(
  adapterName: string,
  makeRepo: RepoFactory,
): void {
  describe(`[contract] ${adapterName}`, () => {
    it("load() returns a non-empty snapshot whose currentBoardId references one of the boards", async () => {
      const repo = await makeRepo();
      const snapshot = await repo.load();

      expect(snapshot.boards.length).toBeGreaterThanOrEqual(1);
      expect(snapshot.boards.some((b) => b.id === snapshot.currentBoardId)).toBe(true);
    });

    it("save() then load() round-trips a single-board snapshot", async () => {
      const repo = await makeRepo();
      const tree = richTree("rt1");
      const snapshot: BoardCollectionSnapshot = {
        boards: [{ id: "only", name: "Only Board", tree }],
        currentBoardId: "only",
      };

      await repo.save(snapshot);
      const reloaded = await repo.load();

      expect(reloaded.currentBoardId).toBe("only");
      expect(reloaded.boards).toHaveLength(1);
      expect(reloaded.boards[0]!.id).toBe("only");
      expect(reloaded.boards[0]!.name).toBe("Only Board");
      expect(reloaded.boards[0]!.tree.id).toBe("rt1-root");
      expect(reloaded.boards[0]!.tree.children).toHaveLength(2);
    });

    it("save() then load() preserves a multi-board snapshot in order", async () => {
      const repo = await makeRepo();
      const snapshot: BoardCollectionSnapshot = {
        boards: [
          { id: "b1", name: "First", tree: richTree("first") },
          { id: "b2", name: "Second", tree: tn("just-text", "JustText") },
          { id: "b3", name: "Third", tree: richTree("third") },
        ],
        currentBoardId: "b2",
      };

      await repo.save(snapshot);
      const reloaded = await repo.load();

      expect(reloaded.currentBoardId).toBe("b2");
      expect(reloaded.boards.map((b) => b.id)).toEqual(["b1", "b2", "b3"]);
      expect(reloaded.boards.map((b) => b.name)).toEqual(["First", "Second", "Third"]);
    });

    it("save() then load() preserves BusinessScoreCardNode fields (weight, unit, objective, history)", async () => {
      const repo = await makeRepo();
      const tree = richTree("kpi");
      const snapshot: BoardCollectionSnapshot = {
        boards: [{ id: "k", name: "K", tree }],
        currentBoardId: "k",
      };

      await repo.save(snapshot);
      const reloaded = await repo.load();

      const reloadedRoot = reloaded.boards[0]!.tree;
      const alpha = reloadedRoot.children[0] as BusinessScoreCardNode<number>;
      expect(alpha).toBeInstanceOf(BusinessScoreCardNode);
      expect(alpha.weight.value).toBe(2);
      expect(alpha.identity.title.value).toBe("Alpha");
      expect(alpha.card.unit.value).toBe("USD");
      expect(alpha.card.objective.targetValue).toBe(100);
      expect(alpha.card.objective.initialValue).toBe(0);
      const history = alpha.history();
      expect(history).toHaveLength(2);
      expect(history.map((tv) => tv.value)).toEqual([10, 40]);
    });

    it("a second save() overwrites the previous snapshot (no append)", async () => {
      const repo = await makeRepo();
      const first: BoardCollectionSnapshot = {
        boards: [{ id: "first", name: "First", tree: tn("ft", "FT") }],
        currentBoardId: "first",
      };
      const second: BoardCollectionSnapshot = {
        boards: [{ id: "second", name: "Second", tree: tn("st", "ST") }],
        currentBoardId: "second",
      };

      await repo.save(first);
      await repo.save(second);
      const reloaded = await repo.load();

      expect(reloaded.boards.map((b) => b.id)).toEqual(["second"]);
      expect(reloaded.currentBoardId).toBe("second");
    });

    it("load() repeatedly returns equivalent snapshots (no corruption across reads)", async () => {
      const repo = await makeRepo();
      const snapshot: BoardCollectionSnapshot = {
        boards: [{ id: "b", name: "B", tree: richTree("idem") }],
        currentBoardId: "b",
      };
      await repo.save(snapshot);

      const a = await repo.load();
      const b = await repo.load();

      expect(b.currentBoardId).toBe(a.currentBoardId);
      expect(b.boards.map((x) => x.id)).toEqual(a.boards.map((x) => x.id));
      expect(b.boards[0]!.tree.children.map((c) => c.id)).toEqual(
        a.boards[0]!.tree.children.map((c) => c.id),
      );
    });
  });
}
