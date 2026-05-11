import { describe, expect, it } from "vitest";

import { TreeNavigationServiceV4 } from "../../../application/TreeNavigationServiceV4.js";
import type { Clock } from "../../../domain/capabilities/Clock.js";
import { TextNodeV4 } from "../../../domain/nodes/TextNodeV4.js";
import { Tree } from "../../../domain/Tree.js";
import { Timestamp } from "../../../domain/values/Timestamp.js";
import { Weight } from "../../../domain/values/Weight.js";

const clock: Clock = { now: () => Timestamp.of(new Date("2026-05-11T10:00:00Z")) };
const w = Weight.of(1);
const node = (id: string): TextNodeV4 => new TextNodeV4(id, id, w, clock);

const buildTree = (): { tree: Tree; ids: { root: string; a: string; b: string; ba: string } } => {
  const root = node("root");
  const a = node("a");
  const b = node("b");
  const ba = node("ba");
  root.attach(a);
  root.attach(b);
  b.attach(ba);
  return { tree: new Tree(root), ids: { root: "root", a: "a", b: "b", ba: "ba" } };
};

describe("TreeNavigationServiceV4 (§17.92 — Phase B.4: v4-aware navigation)", () => {
  describe("constructor + getters", () => {
    it("defaults focused id to the tree root id when no initial focus given", () => {
      const { tree, ids } = buildTree();
      const svc = new TreeNavigationServiceV4(tree);
      expect(svc.getFocusedId()).toBe(ids.root);
      expect(svc.getRoot()).toBe(tree);
    });

    it("honours initialFocusedId when provided", () => {
      const { tree, ids } = buildTree();
      const svc = new TreeNavigationServiceV4(tree, ids.b);
      expect(svc.getFocusedId()).toBe(ids.b);
    });
  });

  describe("getFocusedView", () => {
    it("returns center + direct children for the focused node", () => {
      const { tree, ids } = buildTree();
      const svc = new TreeNavigationServiceV4(tree, ids.root);
      const view = svc.getFocusedView();
      expect(view).not.toBeNull();
      expect(view!.center.id).toBe(ids.root);
      expect(view!.childrenNodes.map((c) => c.id)).toEqual([ids.a, ids.b]);
    });

    it("childrenNodes is a defensive copy (mutating it does not affect the underlying tree)", () => {
      const { tree, ids } = buildTree();
      const svc = new TreeNavigationServiceV4(tree, ids.root);
      const view = svc.getFocusedView()!;
      const arr = view.childrenNodes as TextNodeV4[];
      arr.pop();
      const view2 = svc.getFocusedView()!;
      expect(view2.childrenNodes.length).toBe(2);
    });

    it("returns null when the focused id no longer exists in the tree", () => {
      const { tree } = buildTree();
      const svc = new TreeNavigationServiceV4(tree, "ghost");
      expect(svc.getFocusedView()).toBeNull();
    });
  });

  describe("focusChild", () => {
    it("succeeds when the target is a direct child of the current focus", () => {
      const { tree, ids } = buildTree();
      const svc = new TreeNavigationServiceV4(tree, ids.root);
      expect(svc.focusChild(ids.a)).toEqual({ ok: true });
      expect(svc.getFocusedId()).toBe(ids.a);
    });

    it("fails when the target is not a direct child (grandchild rejected)", () => {
      const { tree, ids } = buildTree();
      const svc = new TreeNavigationServiceV4(tree, ids.root);
      const result = svc.focusChild(ids.ba);
      expect(result).toEqual({ ok: false, reason: "Node is not a direct child of the focused node." });
      expect(svc.getFocusedId()).toBe(ids.root);
    });

    it("fails when the current focus itself is not in the tree", () => {
      const { tree, ids } = buildTree();
      const svc = new TreeNavigationServiceV4(tree, "ghost");
      expect(svc.focusChild(ids.a)).toEqual({ ok: false, reason: "Current focus not found in tree." });
    });
  });

  describe("focusParent", () => {
    it("succeeds when the current focus has a parent (uses Node.parent O(1) lookup)", () => {
      const { tree, ids } = buildTree();
      const svc = new TreeNavigationServiceV4(tree, ids.ba);
      expect(svc.focusParent()).toEqual({ ok: true });
      expect(svc.getFocusedId()).toBe(ids.b);
      expect(svc.focusParent()).toEqual({ ok: true });
      expect(svc.getFocusedId()).toBe(ids.root);
    });

    it("fails when already at the root", () => {
      const { tree, ids } = buildTree();
      const svc = new TreeNavigationServiceV4(tree, ids.root);
      expect(svc.focusParent()).toEqual({ ok: false, reason: "Already at root." });
    });

    it("fails when the focused id no longer exists in the tree", () => {
      const { tree } = buildTree();
      const svc = new TreeNavigationServiceV4(tree, "ghost");
      expect(svc.focusParent()).toEqual({ ok: false, reason: "Current focus not found in tree." });
    });
  });

  describe("focusByUuid", () => {
    it("succeeds for any reachable node id (deep-link routing)", () => {
      const { tree, ids } = buildTree();
      const svc = new TreeNavigationServiceV4(tree, ids.root);
      expect(svc.focusByUuid(ids.ba)).toEqual({ ok: true });
      expect(svc.getFocusedId()).toBe(ids.ba);
    });

    it("fails when the uuid does not match any node", () => {
      const { tree, ids } = buildTree();
      const svc = new TreeNavigationServiceV4(tree, ids.root);
      expect(svc.focusByUuid("ghost")).toEqual({ ok: false, reason: "Node not found." });
      expect(svc.getFocusedId()).toBe(ids.root);
    });
  });

  describe("replaceTree (§17.31 semantics preserved)", () => {
    it("snaps focus to new root when no focusedId given", () => {
      const { tree, ids } = buildTree();
      const svc = new TreeNavigationServiceV4(tree, ids.b);
      const newTree = new Tree(node("new-root"));
      svc.replaceTree(newTree);
      expect(svc.getFocusedId()).toBe("new-root");
      expect(svc.getRoot()).toBe(newTree);
    });

    it("honours focusedId when provided to replaceTree", () => {
      const newRoot = node("new-root");
      const child = node("new-child");
      newRoot.attach(child);
      const newTree = new Tree(newRoot);
      const { tree } = buildTree();
      const svc = new TreeNavigationServiceV4(tree);
      svc.replaceTree(newTree, "new-child");
      expect(svc.getFocusedId()).toBe("new-child");
    });
  });
});
