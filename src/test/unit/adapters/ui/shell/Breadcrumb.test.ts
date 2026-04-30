import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../adapters/ui/shell/Breadcrumb.js";
import {
  BREADCRUMB_NAVIGATE_EVENT,
  type BreadcrumbNavigateDetail,
  type BreadcrumbSegment,
  type FocusBreadcrumb,
} from "../../../../../adapters/ui/shell/Breadcrumb.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

function crumbsOf(el: FocusBreadcrumb): HTMLElement[] {
  return Array.from(
    el.shadowRoot?.querySelectorAll<HTMLElement>('[data-testid="crumb"]') ?? [],
  );
}

const samplePath: readonly BreadcrumbSegment[] = [
  { id: "root", title: "Root" },
  { id: "n11", title: "Engineering" },
  { id: "n11c2", title: "Platform" },
  { id: "leaf", title: "API gateway" },
];

describe("<focus-breadcrumb>", () => {
  it("renders nothing when path is empty", async () => {
    const el = await mountLitElement<FocusBreadcrumb>("focus-breadcrumb");
    expect(crumbsOf(el)).toHaveLength(0);
    expect(
      el.shadowRoot?.querySelector('[data-testid="breadcrumb"]'),
    ).toBeNull();
  });

  it("renders one crumb per segment in root → focus order", async () => {
    const el = await mountLitElement<FocusBreadcrumb>("focus-breadcrumb");
    el.path = samplePath;
    await el.updateComplete;
    const crumbs = crumbsOf(el);
    expect(crumbs).toHaveLength(samplePath.length);
    expect(crumbs.map((c) => c.dataset["nodeId"])).toEqual([
      "root",
      "n11",
      "n11c2",
      "leaf",
    ]);
    expect(crumbs.map((c) => c.textContent?.trim())).toEqual([
      "Root",
      "Engineering",
      "Platform",
      "API gateway",
    ]);
  });

  it("renders n-1 separators between segments", async () => {
    const el = await mountLitElement<FocusBreadcrumb>("focus-breadcrumb");
    el.path = samplePath;
    await el.updateComplete;
    const seps = el.shadowRoot?.querySelectorAll(".sep") ?? [];
    expect(seps.length).toBe(samplePath.length - 1);
    seps.forEach((s) => expect(s.textContent?.trim()).toBe("›"));
  });

  it("non-focus segments are <button> elements; focus is a non-button <span> with aria-current=page", async () => {
    const el = await mountLitElement<FocusBreadcrumb>("focus-breadcrumb");
    el.path = samplePath;
    await el.updateComplete;
    const crumbs = crumbsOf(el);
    crumbs.slice(0, -1).forEach((c) => {
      expect(c.tagName).toBe("BUTTON");
      expect(c.getAttribute("aria-current")).toBeNull();
    });
    const last = crumbs.at(-1)!;
    expect(last.tagName).toBe("SPAN");
    expect(last.getAttribute("aria-current")).toBe("page");
  });

  it("clicking a non-focus segment dispatches a bubbling+composed `breadcrumb-navigate` with that node's id", async () => {
    const el = await mountLitElement<FocusBreadcrumb>("focus-breadcrumb");
    el.path = samplePath;
    await el.updateComplete;
    const handler = vi.fn();
    el.addEventListener(BREADCRUMB_NAVIGATE_EVENT, handler);
    const target = crumbsOf(el)[1] as HTMLButtonElement; // n11
    target.click();
    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0]?.[0] as
      | CustomEvent<BreadcrumbNavigateDetail>
      | undefined;
    expect(evt?.detail.nodeId).toBe("n11");
    expect(evt?.bubbles).toBe(true);
    expect(evt?.composed).toBe(true);
  });

  it("clicking the focus segment is a no-op (it is not a button and has no listener)", async () => {
    const el = await mountLitElement<FocusBreadcrumb>("focus-breadcrumb");
    el.path = samplePath;
    await el.updateComplete;
    const handler = vi.fn();
    el.addEventListener(BREADCRUMB_NAVIGATE_EVENT, handler);
    const last = crumbsOf(el).at(-1)!;
    last.click();
    expect(handler).not.toHaveBeenCalled();
  });

  it("a single-segment path renders only the current crumb (no separator, no button)", async () => {
    const el = await mountLitElement<FocusBreadcrumb>("focus-breadcrumb");
    el.path = [{ id: "root", title: "Root" }];
    await el.updateComplete;
    const crumbs = crumbsOf(el);
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0]!.tagName).toBe("SPAN");
    expect(crumbs[0]!.getAttribute("aria-current")).toBe("page");
    expect(el.shadowRoot?.querySelectorAll(".sep").length ?? 0).toBe(0);
  });

  it("re-renders when `path` is reassigned (root → deeper focus changes the current segment)", async () => {
    const el = await mountLitElement<FocusBreadcrumb>("focus-breadcrumb");
    el.path = [{ id: "root", title: "Root" }];
    await el.updateComplete;
    expect(crumbsOf(el).at(-1)?.dataset["nodeId"]).toBe("root");

    el.path = [
      { id: "root", title: "Root" },
      { id: "child", title: "Child" },
    ];
    await el.updateComplete;
    const crumbs = crumbsOf(el);
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0]!.tagName).toBe("BUTTON");
    expect(crumbs[1]!.tagName).toBe("SPAN");
    expect(crumbs[1]!.getAttribute("aria-current")).toBe("page");
  });
});
