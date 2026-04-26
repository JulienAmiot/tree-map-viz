import { describe, expect, it } from "vitest";

import { TreeNavigationService } from "../../../application/TreeNavigationService.js";
import { TextNode } from "../../../domain/nodes/TextNode.js";
import { Description } from "../../../domain/values/Description.js";
import { NodeIdentity } from "../../../domain/values/NodeIdentity.js";
import { Title } from "../../../domain/values/Title.js";
import { Weight } from "../../../domain/values/Weight.js";

const identity = NodeIdentity.of(Title.of("X"), Description.of(""));
const w = Weight.of(1);

function tn(idStr: string): TextNode {
  return new TextNode(idStr, identity, w);
}

// Tree shape:
//   root
//   ├── n1
//   └── n2
//       └── b3
function demoTree(): TextNode {
  const root = tn("root");
  const n1 = tn("n1");
  const n2 = tn("n2");
  const b3 = tn("b3");
  n2.attach(b3);
  root.attach(n1);
  root.attach(n2);
  return root;
}

describe("TreeNavigationService", () => {
  it("shows root and its children initially", () => {
    const root = demoTree();
    const svc = new TreeNavigationService(root);
    const v = svc.getFocusedView();
    expect(v?.center.id).toBe("root");
    expect(v?.childrenNodes.map((c) => c.id)).toEqual(["n1", "n2"]);
  });

  it("focuses a direct child", () => {
    const root = demoTree();
    const svc = new TreeNavigationService(root);
    const r = svc.focusChild("n2");
    expect(r).toEqual({ ok: true });
    expect(svc.getFocusedView()?.center.id).toBe("n2");
    expect(svc.getFocusedView()?.childrenNodes.map((c) => c.id)).toEqual(["b3"]);
  });

  it("rejects child that is not direct", () => {
    const root = demoTree();
    const svc = new TreeNavigationService(root);
    const r = svc.focusChild("b3");
    expect(r.ok).toBe(false);
  });

  it("navigates to parent from child", () => {
    const root = demoTree();
    const svc = new TreeNavigationService(root);
    svc.focusChild("n2");
    expect(svc.focusParent()).toEqual({ ok: true });
    expect(svc.getFocusedId()).toBe("root");
  });

  it("does not go above root", () => {
    const root = demoTree();
    const svc = new TreeNavigationService(root);
    expect(svc.focusParent().ok).toBe(false);
  });

  describe("focusByUuid", () => {
    it("focuses the root by its uuid", () => {
      const root = demoTree();
      const svc = new TreeNavigationService(root);
      svc.focusChild("n2");
      const r = svc.focusByUuid("root");
      expect(r).toEqual({ ok: true });
      expect(svc.getFocusedId()).toBe("root");
    });

    it("focuses a deeply-nested node by uuid (skipping intermediate parents)", () => {
      const root = demoTree();
      const svc = new TreeNavigationService(root);
      const r = svc.focusByUuid("b3");
      expect(r).toEqual({ ok: true });
      expect(svc.getFocusedView()?.center.id).toBe("b3");
    });

    it("rejects unknown uuid and leaves focus untouched", () => {
      const root = demoTree();
      const svc = new TreeNavigationService(root);
      svc.focusChild("n2");
      const before = svc.getFocusedId();
      const r = svc.focusByUuid("does-not-exist");
      expect(r.ok).toBe(false);
      expect(svc.getFocusedId()).toBe(before);
    });

    it("focuses an already-focused node as a no-op success", () => {
      const root = demoTree();
      const svc = new TreeNavigationService(root);
      svc.focusChild("n2");
      const r = svc.focusByUuid("n2");
      expect(r).toEqual({ ok: true });
      expect(svc.getFocusedId()).toBe("n2");
    });
  });
});
