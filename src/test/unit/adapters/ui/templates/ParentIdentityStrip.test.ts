import { afterEach, describe, expect, it } from "vitest";

import "../../../../../adapters/ui/templates/ParentIdentityStrip.js";
import {
  EDIT_NODE_OPEN_EVENT,
  FOCUS_CLOSE_TO_PARENT_EVENT,
  ParentIdentityStrip,
} from "../../../../../adapters/ui/templates/ParentIdentityStrip.js";
import type { NodeViewModel } from "../../../../../adapters/ui/molecules/NodeViewModel.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

const textVm: NodeViewModel = {
  kind: "TextNode",
  id: "uuid-1",
  title: "Quarterly review",
  value: {
    text: "Quarterly review",
    dateIso: "2026-04-23T00:00:00.000Z",
    dateColor: "rgb(255, 145, 50)",
  },
};

/**
 * SPEC §17.136 S13a -- `<parent-identity-strip>` no longer owns the
 * close-X (§17.23) + edit-pencil (§17.28) buttons; those moved into
 * each AsParent's `<card-frame slot="header-actions">` cell via the
 * shared `molecules/headerActions.ts` helper. The strip is now a
 * pure visual frame around its inner `<node-view>` -- the
 * pre-strand button-rendering tests retire here; the helper's own
 * test file pins the button DOM + event-dispatch contract.
 *
 * The strip still:
 *   - wraps a `<node-view view-role="asParent">`,
 *   - exposes the `data-testid="parent-strip"` + `data-focused-id`
 *     selectors used by the drill animation + e2e steps,
 *   - forwards its `parent-id` attribute to the inner `<node-view>`
 *     via the `.parentId` property binding (so the AsParent tag's
 *     `header-actions` slot can consume it).
 *
 * The event-constant exports stay as re-exports of the helper's
 * canonical exports so existing callsites keep compiling.
 */
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
      value: {
        text: "Other",
        dateIso: "2026-04-23T00:00:00.000Z",
        dateColor: "rgb(255, 145, 50)",
      },
    };
    el.vm = next;
    await el.updateComplete;

    const root = el.shadowRoot?.querySelector('[data-testid="parent-strip"]') as HTMLElement;
    expect(root?.dataset["focusedId"]).toBe("uuid-2");
    const inner = el.shadowRoot?.querySelector("node-view");
    expect((inner as unknown as { vm?: NodeViewModel }).vm).toEqual(next);
  });

  it("\u00a717.136 S13a -- forwards `parentId` to the inner `<node-view>` via the `.parentId` property binding so the registry-dispatched AsParent tag can consume it for the `header-actions` close-X slot", async () => {
    const el = await mountLitElement<ParentIdentityStrip>(
      "parent-identity-strip",
      (e) => {
        e.vm = textVm;
        e.parentId = "uuid-parent";
      },
    );
    const inner = el.shadowRoot?.querySelector("node-view");
    expect((inner as unknown as { parentId?: string }).parentId).toBe("uuid-parent");
    // The strip ALSO carries its own `parent-id` attribute on the
    // host (set by the shell); the property forwards through.
    el.parentId = "";
    await el.updateComplete;
    expect((inner as unknown as { parentId?: string }).parentId).toBe("");
  });

  it("\u00a717.136 S13a -- no longer renders the close-X or edit-pencil buttons (they moved to each AsParent's `header-actions` slot)", async () => {
    const el = await mountLitElement<ParentIdentityStrip>(
      "parent-identity-strip",
      (e) => {
        e.vm = textVm;
        e.parentId = "uuid-parent";
      },
    );
    expect(
      el.shadowRoot?.querySelector('[data-testid="close-to-parent"]'),
    ).toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="edit-node"]'),
    ).toBeNull();
  });

  it("\u00a717.136 S13a -- re-exports `FOCUS_CLOSE_TO_PARENT_EVENT` + `EDIT_NODE_OPEN_EVENT` from the headerActions helper (back-compat with main.ts / TreeMapScreen)", () => {
    expect(FOCUS_CLOSE_TO_PARENT_EVENT).toBe("focus-close-to-parent");
    expect(EDIT_NODE_OPEN_EVENT).toBe("edit-node-open");
  });

  it("\u00a717.136 S13a -- the strip's CSS retired the .has-close / .has-edit modifier rules + the --strip-gutter-right publication", () => {
    const cssText = String(
      (ParentIdentityStrip.styles as { cssText?: string }).cssText ?? "",
    );
    // Modifier classes that the pre-strand strip applied retire.
    expect(cssText).not.toMatch(/\.strip\.has-close[^{]*\{/);
    expect(cssText).not.toMatch(/\.strip\.has-edit[^{]*\{/);
    // No more --strip-gutter-right publication; the inline-edit
    // max-width consumption in inlineTitleEdit.ts now falls back
    // to the helper's 0px default.
    expect(cssText).not.toMatch(/--strip-gutter-right:\s*0px/);
    expect(cssText).not.toMatch(/--strip-gutter-right:\s*calc/);
    // Button-specific rules retire too.
    expect(cssText).not.toMatch(/\.strip-action\s*\{/);
    expect(cssText).not.toMatch(/\.close-x\s*\{/);
    expect(cssText).not.toMatch(/\.edit-pencil\s*\{/);
  });
});
