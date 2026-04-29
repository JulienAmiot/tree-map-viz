import { afterEach, describe, expect, it } from "vitest";

import "../../../../../adapters/ui/shell/ParentIdentityStrip.js";
import type { ParentIdentityStrip } from "../../../../../adapters/ui/shell/ParentIdentityStrip.js";
import type { NodeViewModel } from "../../../../../adapters/ui/views/NodeViewModel.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

const textVm: NodeViewModel = {
  kind: "TextNode",
  id: "uuid-1",
  title: "Quarterly review",
  description: "Top-level scorecard",
};

describe("<parent-identity-strip>", () => {
  it("renders nothing in the strip body when vm is null", async () => {
    const el = await mountLitElement<ParentIdentityStrip>("parent-identity-strip");
    const inner = el.shadowRoot?.querySelector("node-view");
    expect(inner).toBeNull();
  });

  it("renders a `<node-view view-role=\"asParent\">` carrying the supplied vm", async () => {
    const el = await mountLitElement<ParentIdentityStrip>("parent-identity-strip", (e) => {
      e.vm = textVm;
    });
    const inner = el.shadowRoot?.querySelector("node-view");
    expect(inner).not.toBeNull();
    expect(inner?.getAttribute("view-role")).toBe("asParent");
    expect((inner as unknown as { vm?: NodeViewModel }).vm).toEqual(textVm);
  });

  it("exposes `data-testid=\"parent-strip\"` for e2e", async () => {
    const el = await mountLitElement<ParentIdentityStrip>("parent-identity-strip", (e) => {
      e.vm = textVm;
    });
    const root = el.shadowRoot?.querySelector('[data-testid="parent-strip"]');
    expect(root).not.toBeNull();
  });

  it("mirrors the focused node's id to `data-focused-id` (used for navigation assertions)", async () => {
    const el = await mountLitElement<ParentIdentityStrip>("parent-identity-strip", (e) => {
      e.vm = textVm;
    });
    const root = el.shadowRoot?.querySelector('[data-testid="parent-strip"]') as HTMLElement;
    expect(root?.dataset["focusedId"]).toBe("uuid-1");
  });

  it("updates when the vm property changes", async () => {
    const el = await mountLitElement<ParentIdentityStrip>("parent-identity-strip", (e) => {
      e.vm = textVm;
    });
    const next: NodeViewModel = {
      kind: "TextNode",
      id: "uuid-2",
      title: "Other",
      description: "",
    };
    el.vm = next;
    await el.updateComplete;

    const root = el.shadowRoot?.querySelector('[data-testid="parent-strip"]') as HTMLElement;
    expect(root?.dataset["focusedId"]).toBe("uuid-2");
    const inner = el.shadowRoot?.querySelector("node-view");
    expect((inner as unknown as { vm?: NodeViewModel }).vm).toEqual(next);
  });
});
