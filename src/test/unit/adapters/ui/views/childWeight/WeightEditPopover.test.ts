import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../../adapters/ui/views/childWeight/WeightEditPopover.js";
import { WeightEditPopover } from "../../../../../../adapters/ui/views/childWeight/WeightEditPopover.js";
import {
  INLINE_EDIT_WEIGHT_EVENT,
  type InlineEditWeightDetail,
} from "../../../../../../adapters/ui/views/childWeight/weightEditEvents.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

function makeRect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON() {
      return {};
    },
  } as DOMRect;
}

describe("<weight-edit-popover> (\u00a717.52)", () => {
  it("renders nothing when not open", async () => {
    const el = await mountLitElement<WeightEditPopover>(
      "weight-edit-popover",
      (e) => {
        e.nodeId = "uuid-1";
        e.weight = 2;
      },
    );
    expect(
      el.shadowRoot?.querySelector('[data-testid="weight-edit-popover"]'),
    ).toBeNull();
  });

  it("renders a slider seeded at the pre-edit weight when open", async () => {
    const el = await mountLitElement<WeightEditPopover>(
      "weight-edit-popover",
      (e) => {
        e.nodeId = "uuid-1";
        e.weight = 3.5;
        e.anchorRect = makeRect(100, 100, 200, 200);
        e.open = true;
      },
    );
    const slider = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-testid="weight-edit-slider"]',
    );
    expect(slider).not.toBeNull();
    expect(slider?.type).toBe("range");
    expect(slider?.min).toBe("0.5");
    expect(slider?.max).toBe("10");
    expect(slider?.step).toBe("0.5");
    expect(slider?.value).toBe("3.5");
    const label = el.shadowRoot?.querySelector(
      '[data-testid="weight-edit-label"]',
    );
    expect(label?.textContent?.trim()).toBe("3.5");
  });

  it("dragging the slider (input event) updates the live label without committing", async () => {
    // SPEC §17.52 -- the `input` event fires continuously as the
    // operator drags; the label updates live but no
    // `inline-edit-weight` event is dispatched. Commit happens
    // only on `change` (thumb release).
    const el = await mountLitElement<WeightEditPopover>(
      "weight-edit-popover",
      (e) => {
        e.nodeId = "uuid-1";
        e.weight = 1;
        e.anchorRect = makeRect(0, 0, 100, 100);
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(INLINE_EDIT_WEIGHT_EVENT, handler);
    const slider = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-testid="weight-edit-slider"]',
    )!;
    slider.value = "5.5";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    const label = el.shadowRoot?.querySelector(
      '[data-testid="weight-edit-label"]',
    );
    expect(label?.textContent?.trim()).toBe("5.5");
    expect(handler).not.toHaveBeenCalled();
  });

  it("releasing the slider (change event) dispatches `inline-edit-weight` with the operator-chosen value", async () => {
    // SPEC §17.52 -- the `change` event is the §17.52 commit-on-
    // release seam: the popover dispatches `inline-edit-weight`
    // (bubbling + composed) with the new weight. The composition
    // root's `screen.addEventListener("inline-edit-weight", ...)`
    // catches the event and applies `editFields(node, { kind,
    // weight })`.
    const el = await mountLitElement<WeightEditPopover>(
      "weight-edit-popover",
      (e) => {
        e.nodeId = "uuid-7";
        e.weight = 1;
        e.anchorRect = makeRect(0, 0, 100, 100);
        e.open = true;
      },
    );
    const seen: InlineEditWeightDetail[] = [];
    document.addEventListener(INLINE_EDIT_WEIGHT_EVENT, (e) => {
      seen.push((e as CustomEvent<InlineEditWeightDetail>).detail);
    });
    const slider = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-testid="weight-edit-slider"]',
    )!;
    slider.value = "4.5";
    slider.dispatchEvent(new Event("change", { bubbles: true }));
    expect(seen).toHaveLength(1);
    expect(seen[0]?.nodeId).toBe("uuid-7");
    expect(seen[0]?.weight).toBe(4.5);
  });

  it("releasing without a value change (operator opened then immediately released) does NOT dispatch `inline-edit-weight`", async () => {
    // SPEC §17.52 -- a no-op release should not produce a no-op
    // persisted update. The popover compares the pre-edit weight
    // against the slider's commit value and skips the dispatch
    // when they're equal.
    const el = await mountLitElement<WeightEditPopover>(
      "weight-edit-popover",
      (e) => {
        e.nodeId = "uuid-1";
        e.weight = 2;
        e.anchorRect = makeRect(0, 0, 100, 100);
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(INLINE_EDIT_WEIGHT_EVENT, handler);
    const slider = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-testid="weight-edit-slider"]',
    )!;
    // Don't change the value; just dispatch change.
    slider.dispatchEvent(new Event("change", { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("re-seeds liveValue when the popover opens for a different node", async () => {
    // SPEC §17.52 -- one popover instance serves every tile;
    // opening it for a different tile must reset the slider to
    // the new tile's weight (otherwise the previous tile's
    // position lingers and looks like a stale-value bug).
    const el = await mountLitElement<WeightEditPopover>(
      "weight-edit-popover",
      (e) => {
        e.nodeId = "uuid-1";
        e.weight = 1;
        e.anchorRect = makeRect(0, 0, 100, 100);
        e.open = true;
      },
    );
    const slider1 = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-testid="weight-edit-slider"]',
    );
    expect(slider1?.value).toBe("1");
    // Operator drags to 7 then taps outside (closes without
    // commit).
    if (slider1) slider1.value = "7";
    slider1?.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    el.open = false;
    await el.updateComplete;
    // Now opens for a different tile (uuid-2 with weight 4).
    el.nodeId = "uuid-2";
    el.weight = 4;
    el.anchorRect = makeRect(0, 0, 100, 100);
    el.open = true;
    await el.updateComplete;
    const slider2 = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-testid="weight-edit-slider"]',
    );
    expect(slider2?.value).toBe("4");
    const label = el.shadowRoot?.querySelector(
      '[data-testid="weight-edit-label"]',
    );
    expect(label?.textContent?.trim()).toBe("4.0");
  });

  it("clamps an out-of-range slider value back into [MIN_WEIGHT, MAX_WEIGHT]", async () => {
    // SPEC §17.52 -- the popover is the last line of defence
    // before the service. `Weight.of` would throw on an out-of-
    // range value; clamping here means the operator never
    // experiences a silent reject (the commit path always
    // succeeds with the clamped value).
    const el = await mountLitElement<WeightEditPopover>(
      "weight-edit-popover",
      (e) => {
        e.nodeId = "uuid-1";
        e.weight = 1;
        e.anchorRect = makeRect(0, 0, 100, 100);
        e.open = true;
      },
    );
    const seen: InlineEditWeightDetail[] = [];
    el.addEventListener(INLINE_EDIT_WEIGHT_EVENT, (e) => {
      seen.push((e as CustomEvent<InlineEditWeightDetail>).detail);
    });
    const slider = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-testid="weight-edit-slider"]',
    )!;
    slider.value = "100"; // way past max
    slider.dispatchEvent(new Event("change", { bubbles: true }));
    expect(seen).toHaveLength(1);
    expect(seen[0]?.weight).toBe(10);
  });

  it("positions the panel to the RIGHT of the icon and constrains its max-width to the tile (\u00a717.52-polish)", async () => {
    // SPEC §17.52-polish -- operator follow-up: *"the slider
    // should be constrained by the size of the children itself,
    // its shouldn't exceed the tile width and appear at the right
    // of the weight icon (not overlapping it)"*. We mock the
    // panel's intrinsic size (jsdom returns zeros for un-laid-out
    // elements) and assert (a) the inline `max-width` is the
    // tile-bound width (= `tile.right - left - TILE_RIGHT_INSET`)
    // and (b) the host's `left` sits past the icon's right edge
    // by ICON_TO_PANEL_GAP_PX, and (c) the host's `top` aligns
    // the panel's bottom edge with the icon's bottom edge.
    const tileLeft = 200;
    const tileTop = 100;
    const tileWidth = 320;
    const tileHeight = 240;
    const iconLeft = 206;
    const iconTop = tileTop + tileHeight - 26;
    const iconWidth = 22;
    const iconHeight = 22;
    const panelHeight = 96;
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1280,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });
    try {
      const el = await mountLitElement<WeightEditPopover>(
        "weight-edit-popover",
        (e) => {
          e.nodeId = "uuid-1";
          e.weight = 2;
          e.anchorRect = makeRect(tileLeft, tileTop, tileWidth, tileHeight);
          e.iconRect = makeRect(iconLeft, iconTop, iconWidth, iconHeight);
          e.open = true;
        },
      );
      const panel = el.shadowRoot?.querySelector<HTMLElement>(".panel");
      expect(panel).not.toBeNull();
      // Compute the expected inline max-width from the math the
      // popover applies: max-width = tile.right - panel.left -
      // TILE_RIGHT_INSET, where panel.left = icon.right + GAP.
      const ICON_TO_PANEL_GAP = 4;
      const TILE_RIGHT_INSET = 4;
      const ANCHOR_BOTTOM_INSET = 3;
      const panelLeft = iconLeft + iconWidth + ICON_TO_PANEL_GAP;
      const expectedMaxWidth =
        tileLeft + tileWidth - panelLeft - TILE_RIGHT_INSET;
      // Stub the panel rect AFTER the popover has set max-width;
      // the stub returns the constrained width so the second
      // pass measures correctly. We let the panel's height stay
      // a fixed value (jsdom doesn't layout, so we control both
      // axes via the stub).
      Object.defineProperty(panel, "getBoundingClientRect", {
        configurable: true,
        value: () =>
          ({
            left: 0,
            top: 0,
            right: expectedMaxWidth,
            bottom: panelHeight,
            width: expectedMaxWidth,
            height: panelHeight,
            x: 0,
            y: 0,
            toJSON() {
              return {};
            },
          }) as DOMRect,
      });
      // Trigger a re-render so `updated()` re-runs against the
      // stubbed panel rect.
      el.requestUpdate();
      await el.updateComplete;
      // Inline max-width on the panel is the tile-bound width.
      expect(panel?.style.maxWidth).toBe(`${expectedMaxWidth}px`);
      const host = el as HTMLElement;
      // Host left = icon.right + ICON_TO_PANEL_GAP_PX -- the
      // panel sits to the RIGHT of the icon with a 4 px breath.
      expect(host.style.left).toBe(`${panelLeft}px`);
      // Host top = tile.bottom - ANCHOR_BOTTOM_INSET_PX -
      // panelHeight -- the panel's bottom edge aligns with the
      // icon's bottom edge.
      const expectedTop =
        tileTop + tileHeight - ANCHOR_BOTTOM_INSET - panelHeight;
      expect(host.style.top).toBe(`${expectedTop}px`);
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it("falls back to the tile's bottom-left corner when iconRect is null (\u00a717.52-polish)", async () => {
    // SPEC §17.52-polish -- if the dispatcher couldn't locate
    // the icon (unit fixture, or a future tile-kind that doesn't
    // render the icon), the popover anchors at the tile's
    // bottom-left corner with FALLBACK_LEFT_INSET_PX. The max-
    // width still comes from the tile's right edge.
    const tileLeft = 200;
    const tileTop = 100;
    const tileWidth = 320;
    const tileHeight = 240;
    const panelHeight = 96;
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1280,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });
    try {
      const el = await mountLitElement<WeightEditPopover>(
        "weight-edit-popover",
        (e) => {
          e.nodeId = "uuid-1";
          e.weight = 2;
          e.anchorRect = makeRect(tileLeft, tileTop, tileWidth, tileHeight);
          e.iconRect = null;
          e.open = true;
        },
      );
      const FALLBACK_LEFT_INSET = 6;
      const TILE_RIGHT_INSET = 4;
      const ANCHOR_BOTTOM_INSET = 3;
      const expectedLeft = tileLeft + FALLBACK_LEFT_INSET;
      const expectedMaxWidth =
        tileLeft + tileWidth - expectedLeft - TILE_RIGHT_INSET;
      const panel = el.shadowRoot?.querySelector<HTMLElement>(".panel");
      Object.defineProperty(panel, "getBoundingClientRect", {
        configurable: true,
        value: () =>
          ({
            left: 0,
            top: 0,
            right: expectedMaxWidth,
            bottom: panelHeight,
            width: expectedMaxWidth,
            height: panelHeight,
            x: 0,
            y: 0,
            toJSON() {
              return {};
            },
          }) as DOMRect,
      });
      el.requestUpdate();
      await el.updateComplete;
      const host = el as HTMLElement;
      expect(host.style.left).toBe(`${expectedLeft}px`);
      const expectedTop =
        tileTop + tileHeight - ANCHOR_BOTTOM_INSET - panelHeight;
      expect(host.style.top).toBe(`${expectedTop}px`);
      expect(panel?.style.maxWidth).toBe(`${expectedMaxWidth}px`);
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });
});
