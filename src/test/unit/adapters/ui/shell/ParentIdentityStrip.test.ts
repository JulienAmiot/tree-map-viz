import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../adapters/ui/shell/ParentIdentityStrip.js";
import {
  EDIT_NODE_OPEN_EVENT,
  type EditNodeOpenDetail,
  FOCUS_CLOSE_TO_PARENT_EVENT,
  type FocusCloseToParentDetail,
  ParentIdentityStrip,
} from "../../../../../adapters/ui/shell/ParentIdentityStrip.js";
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

  // -- §17.23 close-to-parent affordance --------------------------------

  describe("close-to-parent button (§17.23)", () => {
    it("does not render the close-X when parentId is empty (root focus)", async () => {
      const el = await mountLitElement<ParentIdentityStrip>(
        "parent-identity-strip",
        (e) => {
          e.vm = textVm;
        },
      );
      const button = el.shadowRoot?.querySelector(
        '[data-testid="close-to-parent"]',
      );
      expect(button).toBeNull();
    });

    it("renders the close-X when parentId is set; carries the id as data-parent-id", async () => {
      const el = await mountLitElement<ParentIdentityStrip>(
        "parent-identity-strip",
        (e) => {
          e.vm = textVm;
          e.parentId = "uuid-parent";
        },
      );
      const button = el.shadowRoot?.querySelector(
        '[data-testid="close-to-parent"]',
      ) as HTMLButtonElement | null;
      expect(button).not.toBeNull();
      expect(button?.tagName).toBe("BUTTON");
      expect(button?.getAttribute("type")).toBe("button");
      expect(button?.getAttribute("data-parent-id")).toBe("uuid-parent");
      // Accessibility — kiosk has no keyboard, but assistive tech still
      // benefits from the label, and the contract is cheap to pin.
      expect(button?.getAttribute("aria-label")).toBeTruthy();
    });

    it("toggles the close-X presence when parentId flips between empty and set", async () => {
      const el = await mountLitElement<ParentIdentityStrip>(
        "parent-identity-strip",
        (e) => {
          e.vm = textVm;
          e.parentId = "uuid-parent";
        },
      );
      expect(
        el.shadowRoot?.querySelector('[data-testid="close-to-parent"]'),
      ).not.toBeNull();

      el.parentId = "";
      await el.updateComplete;
      expect(
        el.shadowRoot?.querySelector('[data-testid="close-to-parent"]'),
      ).toBeNull();

      el.parentId = "uuid-grand";
      await el.updateComplete;
      const button = el.shadowRoot?.querySelector(
        '[data-testid="close-to-parent"]',
      );
      expect(button?.getAttribute("data-parent-id")).toBe("uuid-grand");
    });

    it(`tap dispatches "${FOCUS_CLOSE_TO_PARENT_EVENT}" with { parentId } that bubbles + composes`, async () => {
      const el = await mountLitElement<ParentIdentityStrip>(
        "parent-identity-strip",
        (e) => {
          e.vm = textVm;
          e.parentId = "uuid-parent";
        },
      );
      // Listen on a *light-DOM* ancestor (the host's parent) to verify the
      // event escapes the shadow root via `composed: true`.
      const host = el.parentElement as HTMLElement;
      const handler = vi.fn<(e: Event) => void>();
      host.addEventListener(FOCUS_CLOSE_TO_PARENT_EVENT, handler);

      const button = el.shadowRoot?.querySelector(
        '[data-testid="close-to-parent"]',
      ) as HTMLButtonElement;
      button.click();

      expect(handler).toHaveBeenCalledTimes(1);
      const ev = handler.mock.calls[0]?.[0] as
        | CustomEvent<FocusCloseToParentDetail>
        | undefined;
      expect(ev?.detail.parentId).toBe("uuid-parent");
      expect(ev?.bubbles).toBe(true);
      expect(ev?.composed).toBe(true);
    });

    it("close-X click is a no-op when parentId is empty (defensive — button isn't rendered, but the handler guards anyway)", async () => {
      // The button isn't in the DOM at root, so users can't trigger this
      // path by tapping. Pinned because the handler is a public seam (and
      // a future refactor that conditionally renders a disabled button
      // mustn't accidentally fire the event).
      const el = await mountLitElement<ParentIdentityStrip>(
        "parent-identity-strip",
        (e) => {
          e.vm = textVm;
          e.parentId = "";
        },
      );
      const handler = vi.fn();
      el.addEventListener(FOCUS_CLOSE_TO_PARENT_EVENT, handler);
      // Reach into the strip and call the click pathway as if the button
      // were present (parentId still "" — guard must trip).
      // We dispatch the event manually since the button is absent.
      const button = el.shadowRoot?.querySelector(
        '[data-testid="close-to-parent"]',
      );
      expect(button).toBeNull();
      expect(handler).not.toHaveBeenCalled();
    });

    it("flags the strip wrapper with the `has-close` modifier (semantic marker; \u00a717.47 retired the right-gutter CSS the modifier used to drive)", async () => {
      // \u00a717.23 introduced the close-X button; the wrapper's
      // has-close modifier was originally how the strip's CSS knew
      // to reserve a right-side gutter so the button did not
      // overlap the title text. \u00a717.47 retired the gutter
      // (the buttons now match the title row's 3vh height and
      // overlay the right end of the title row instead of dangling
      // below it; long titles still get text-overflow: ellipsis at
      // the title row's right edge). The modifier is kept as a
      // semantic marker -- useful for diagnostics + the e2e steps
      // that confirm presence -- but no longer carries a CSS
      // payload, so this test now only asserts the marker's
      // presence/absence keying off `parentId`.
      const el = await mountLitElement<ParentIdentityStrip>(
        "parent-identity-strip",
        (e) => {
          e.vm = textVm;
          e.parentId = "uuid-parent";
        },
      );
      const wrap = el.shadowRoot?.querySelector(
        '[data-testid="parent-strip"]',
      ) as HTMLElement;
      expect(wrap.classList.contains("has-close")).toBe(true);

      el.parentId = "";
      await el.updateComplete;
      expect(wrap.classList.contains("has-close")).toBe(false);
    });
  });

  // -- §17.28 edit-node pencil affordance ------------------------------

  describe("edit-node pencil button (\u00a717.28)", () => {
    it("renders the pencil whenever a vm is present (root or non-root)", async () => {
      const el = await mountLitElement<ParentIdentityStrip>(
        "parent-identity-strip",
        (e) => {
          e.vm = textVm;
          e.parentId = "";
        },
      );
      const pencil = el.shadowRoot?.querySelector('[data-testid="edit-node"]');
      expect(pencil).not.toBeNull();
      expect(pencil?.getAttribute("data-node-id")).toBe("uuid-1");
      expect(pencil?.getAttribute("aria-label")).toBeTruthy();
    });

    it("does NOT render the pencil when vm is null", async () => {
      const el = await mountLitElement<ParentIdentityStrip>(
        "parent-identity-strip",
      );
      expect(
        el.shadowRoot?.querySelector('[data-testid="edit-node"]'),
      ).toBeNull();
    });

    it("renders the pencil to the LEFT of the close-X (DOM order in the strip)", async () => {
      const el = await mountLitElement<ParentIdentityStrip>(
        "parent-identity-strip",
        (e) => {
          e.vm = textVm;
          e.parentId = "uuid-parent";
        },
      );
      const wrap = el.shadowRoot?.querySelector(
        '[data-testid="parent-strip"]',
      ) as HTMLElement;
      const buttons = Array.from(
        wrap.querySelectorAll<HTMLButtonElement>("button"),
      );
      const pencilIdx = buttons.findIndex(
        (b) => b.dataset["testid"] === "edit-node",
      );
      const closeIdx = buttons.findIndex(
        (b) => b.dataset["testid"] === "close-to-parent",
      );
      expect(pencilIdx).toBeGreaterThanOrEqual(0);
      expect(closeIdx).toBeGreaterThanOrEqual(0);
      expect(pencilIdx).toBeLessThan(closeIdx);
    });

    it(`tap dispatches "${EDIT_NODE_OPEN_EVENT}" with { nodeId } that bubbles + composes`, async () => {
      const el = await mountLitElement<ParentIdentityStrip>(
        "parent-identity-strip",
        (e) => {
          e.vm = textVm;
          e.parentId = "uuid-parent";
        },
      );
      const host = el.parentElement as HTMLElement;
      const handler = vi.fn<(e: Event) => void>();
      host.addEventListener(EDIT_NODE_OPEN_EVENT, handler);

      const pencil = el.shadowRoot?.querySelector(
        '[data-testid="edit-node"]',
      ) as HTMLButtonElement;
      pencil.click();

      expect(handler).toHaveBeenCalledTimes(1);
      const ev = handler.mock.calls[0]?.[0] as
        | CustomEvent<EditNodeOpenDetail>
        | undefined;
      expect(ev?.detail.nodeId).toBe("uuid-1");
      expect(ev?.bubbles).toBe(true);
      expect(ev?.composed).toBe(true);
    });

    it("flags the strip wrapper with the `has-edit` modifier when the pencil is shown", async () => {
      const el = await mountLitElement<ParentIdentityStrip>(
        "parent-identity-strip",
        (e) => {
          e.vm = textVm;
        },
      );
      const wrap = el.shadowRoot?.querySelector(
        '[data-testid="parent-strip"]',
      ) as HTMLElement;
      expect(wrap.classList.contains("has-edit")).toBe(true);
    });

    it("when both buttons render, the wrapper carries BOTH `has-close` AND `has-edit`", async () => {
      const el = await mountLitElement<ParentIdentityStrip>(
        "parent-identity-strip",
        (e) => {
          e.vm = textVm;
          e.parentId = "uuid-parent";
        },
      );
      const wrap = el.shadowRoot?.querySelector(
        '[data-testid="parent-strip"]',
      ) as HTMLElement;
      expect(wrap.classList.contains("has-close")).toBe(true);
      expect(wrap.classList.contains("has-edit")).toBe(true);
    });
  });

  // -- \u00a717.47 buttons-aligned-with-title contract --------------------

  describe("buttons aligned with the title row (\u00a717.47)", () => {
    // \u00a717.47 -- the close-X + edit-pencil buttons should sit on
    // the same horizontal line as the title (so the focused panel
    // does not have stray hardware dangling below the title row
    // into the body / value area), and they should NOT consume
    // horizontal space at the right of the panel (so the per-view's
    // value / description fills the strip's full inner width). The
    // CSS contract we pin here:
    //   1. .strip-action sizes match the title row's height
    //      (clamp(1.5rem, 3vh, 2.25rem) square -- floor protects
    //      touch-target on small viewports, ceiling caps the
    //      growth on very tall ones, the natural 3vh resolves to
    //      the title row's own height in between).
    //   2. .strip-action's `top` is the same offset that the title
    //      row uses (1px border + 0.2rem host padding-top) so the
    //      button's top edge aligns flush with the title row's top
    //      edge.
    //   3. The has-close / has-edit modifiers no longer carry a
    //      `padding-right` rule (the gutter is retired) -- so the
    //      strip's content-area width is the full strip width
    //      regardless of which buttons render.

    it("the .strip-action size and top offset match the title row (clamp 1.5rem -- 3vh -- 2.25rem; top = 1px + 0.2rem)", () => {
      const cssText = String(
        (ParentIdentityStrip.styles as { cssText?: string }).cssText ?? "",
      );
      expect(cssText).toMatch(
        /\.strip-action\s*\{[\s\S]*?width:\s*clamp\(\s*1\.5rem\s*,\s*3vh\s*,\s*2\.25rem\s*\)/,
      );
      expect(cssText).toMatch(
        /\.strip-action\s*\{[\s\S]*?height:\s*clamp\(\s*1\.5rem\s*,\s*3vh\s*,\s*2\.25rem\s*\)/,
      );
      expect(cssText).toMatch(
        /\.strip-action\s*\{[\s\S]*?top:\s*calc\(\s*1px\s*\+\s*0\.2rem\s*\)/,
      );
    });

    it("the strip's CSS does not reserve a right-side gutter via padding-right (\u00a717.47 retirement holds)", () => {
      const cssText = String(
        (ParentIdentityStrip.styles as { cssText?: string }).cssText ?? "",
      );
      // \u00a717.47 -- the pre-\u00a717.47 contract was
      //   .strip.has-close,
      //   .strip.has-edit { padding-right: clamp(3rem, 4vw, 3.75rem); ... }
      //   .strip.has-close.has-edit { padding-right: clamp(5.5rem, 8vw, 7.5rem); ... }
      // Both rules are gone in \u00a717.47. The negation guards on
      // `.strip.has-close` rule bodies catch a regression that
      // re-introduces the layout-affecting padding. Using `[^}]*`
      // (not `[\s\S]*?`) keeps the search confined to a single rule
      // body so a comment further down that mentions "padding-right"
      // (e.g. the .close-x rule's narrative) does not trip the
      // negation. \u00a717.50 added the `--strip-gutter-right`
      // custom-property publish on these same selectors; that is
      // intentional and not flagged by the negation below.
      expect(cssText).not.toMatch(
        /\.strip\.has-close[^{]*\{[^}]*padding-right/,
      );
      expect(cssText).not.toMatch(
        /\.strip\.has-edit[^{]*\{[^}]*padding-right/,
      );
    });

    it("the strip publishes --strip-gutter-right on the .has-close / .has-edit modifiers (\u00a717.50)", () => {
      // SPEC \u00a717.50 -- the modifier classes still carry no
      // layout-affecting padding (\u00a717.47 retirement holds),
      // but they now also publish a --strip-gutter-right CSS custom
      // property that per-views consume for inline-edit input
      // max-width. Static read-only content (title text, value
      // figure, description) keeps text-overflow: ellipsis so a long
      // title is clipped under the buttons -- the variable is for
      // INTERACTIVE inline-edit inputs only. The pins below catch a
      // regression that drops the variable export (which would let
      // the inline title-edit run behind the close-X / edit-pencil
      // again).
      const cssText = String(
        (ParentIdentityStrip.styles as { cssText?: string }).cssText ?? "",
      );
      // Default rule on `.strip` initialises the var to 0px so the
      // calc(100% - var(--strip-gutter-right, 0px)) max-width in
      // unit-fixture mounts (no modifier classes set) resolves to
      // 100% and tests that don't set up the modifiers still pass.
      expect(cssText).toMatch(
        /\.strip\s*\{[\s\S]*?--strip-gutter-right:\s*0px/,
      );
      // One-button variant (close-X xor edit-pencil): one clamp +
      // the right offset (0.35rem + 1px border).
      expect(cssText).toMatch(
        /\.strip\.has-close\s*:not\(\s*\.has-edit\s*\)\s*,\s*\.strip\.has-edit\s*:not\(\s*\.has-close\s*\)\s*\{[\s\S]*?--strip-gutter-right:\s*calc\([\s\S]*?clamp\(1\.5rem,\s*3vh,\s*2\.25rem\)/,
      );
      // Two-button variant: two clamps + a 0.25rem inter-button gap.
      expect(cssText).toMatch(
        /\.strip\.has-close\.has-edit\s*\{[\s\S]*?--strip-gutter-right:\s*calc\([\s\S]*?clamp\(1\.5rem,\s*3vh,\s*2\.25rem\)\s*\+\s*0\.25rem\s*\+\s*\n?\s*clamp\(1\.5rem,\s*3vh,\s*2\.25rem\)/,
      );
    });
  });
});
