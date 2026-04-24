import { describe, expect, it } from "vitest";
import { Node } from "../domain/Node.js";
import { BusinessScoreCard } from "../domain/BusinessScoreCard.js";
import { TreeNavigationService } from "./TreeNavigationService.js";

function demoTree(): Node {
  const b3 = new BusinessScoreCard(
    "b3",
    "KPI 3",
    "Desc",
    80,
    "%",
    new Date("2026-01-15"),
    new Date("2026-06-01"),
    60,
    100,
    [],
  );
  const b2 = new Node("n2", "Branch 2", "", 2, "x", new Date(), [b3]);
  const b1 = new Node("n1", "Branch 1", "", 1, "x", new Date(), []);
  return new Node("root", "Company", "Top", null, "", new Date(), [b1, b2]);
}

describe("TreeNavigationService", () => {
  it("shows root and its children initially", () => {
    const root = demoTree();
    const svc = new TreeNavigationService(root);
    const v = svc.getFocusedView();
    expect(v?.center.id).toBe("root");
    expect(v?.children.map((c) => c.id)).toEqual(["n1", "n2"]);
  });

  it("focuses a direct child", () => {
    const root = demoTree();
    const svc = new TreeNavigationService(root);
    const r = svc.focusChild("n2");
    expect(r).toEqual({ ok: true });
    expect(svc.getFocusedView()?.center.id).toBe("n2");
    expect(svc.getFocusedView()?.children.map((c) => c.id)).toEqual(["b3"]);
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
});
