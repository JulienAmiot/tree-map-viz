import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../../adapters/ui/molecules/childWeight/WeightEditButton.js";
import { WeightEditButton } from "../../../../../../adapters/ui/molecules/childWeight/WeightEditButton.js";
import {
  WEIGHT_EDIT_OPEN_EVENT,
  type WeightEditOpenDetail,
} from "../../../../../../adapters/ui/molecules/childWeight/weightEditEvents.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

describe("<weight-edit-button> (\u00a717.52)", () => {
  it("renders the Lucide `scale` icon inside an accessible button (\u00a717.132)", async () => {
    // SPEC §17.132 -- the icon is the §17.131 `<ds-icon name="scale">`
    // Lucide SVG (was a Unicode `U+2696 SCALES` + VS15 sequence pre-
    // §17.132; before that it was a custom cast-iron-weight SVG atom).
    // The Lucide swap removes the system-font dependency that drifted
    // into the emoji-coloured rendering on macOS Safari + iOS;
    // monochrome `currentColor` is now guaranteed across platforms.
    const el = await mountLitElement<WeightEditButton>(
      "weight-edit-button",
      (e) => {
        e.nodeId = "node-1";
        e.weight = 1;
      },
    );
    const button = el.shadowRoot?.querySelector<HTMLButtonElement>(
      'button[data-testid="weight-edit-button"]',
    );
    expect(button).not.toBeNull();
    expect(button?.getAttribute("aria-label")).toBe("Edit weight");
    const icon = button?.querySelector("ds-icon");
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("name")).toBe("scale");
    // Pin the absence of any other text content so the migration
    // can't accidentally reintroduce a Unicode glyph alongside the
    // Lucide SVG.
    expect(button?.textContent?.trim()).toBe("");
  });

  it("anchors at the tile's bottom-LEFT corner (mirror of the bottom-right timestamp)", async () => {
    // SPEC §17.52 -- the icon sits at the bottom-LEFT corner;
    // the date sits at bottom-RIGHT (§17.18). Pin the host's
    // CSS position so a future refactor that drops the corner
    // anchor (or accidentally puts the icon at top-left where
    // the parent's close-X lives) fails fast.
    const css = (
      WeightEditButton.styles as unknown as { cssText?: string }
    )?.cssText
      ?? String(WeightEditButton.styles);
    expect(css).toMatch(
      /:host\s*\{[^}]*position:\s*absolute[^}]*bottom:\s*0\.2rem[^}]*left:\s*0\.35rem/,
    );
  });

  it("clicking the button dispatches a bubbling+composed `weight-edit-open` event with nodeId, weight, and an anchorRect", async () => {
    // SPEC §17.52 -- the dispatch is the one-and-only way the
    // shell learns the operator wants the popover; the detail
    // carries everything the popover needs to anchor and seed.
    // The anchorRect is the host's own rect when the button is
    // mounted in a unit fixture (no `data-testid="child"`
    // ancestor to walk up to).
    const el = await mountLitElement<WeightEditButton>(
      "weight-edit-button",
      (e) => {
        e.nodeId = "uuid-42";
        e.weight = 4.5;
      },
    );
    const seen: WeightEditOpenDetail[] = [];
    document.addEventListener(WEIGHT_EDIT_OPEN_EVENT, (e) => {
      seen.push((e as CustomEvent<WeightEditOpenDetail>).detail);
    });
    const button = el.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-testid="weight-edit-button"]',
    )!;
    button.click();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.nodeId).toBe("uuid-42");
    expect(seen[0]?.weight).toBe(4.5);
    expect(seen[0]?.anchorRect).toBeDefined();
    // SPEC §17.52-polish -- the click dispatcher also captures
    // the icon's own rect so the popover can sit to the right
    // of it without overlapping. In a unit fixture the host's
    // jsdom rect is zeros but the field is always populated
    // (never null) on the icon-tap path.
    expect(seen[0]?.iconRect).not.toBeNull();
  });

  it("clicking the button stops propagation so the parent tile's @click=drill does NOT fire (\u00a717.52)", async () => {
    // SPEC §17.52 -- the wrapper tile carries `@click=drill` on
    // the children-grid side. Without `stopPropagation` the
    // operator's tap on the icon would simultaneously open the
    // popover AND drill into the tile, leaving the popover
    // orphaned over a different focused node. Pin via a manual
    // wrapper that asserts the click never bubbles past the
    // host.
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-testid", "child");
    wrapper.dataset["litFixture"] = "1";
    document.body.appendChild(wrapper);
    const button = document.createElement(
      "weight-edit-button",
    ) as WeightEditButton;
    button.nodeId = "uuid-1";
    button.weight = 1;
    wrapper.appendChild(button);
    await button.updateComplete;
    const wrapperHandler = vi.fn();
    wrapper.addEventListener("click", wrapperHandler);
    const inner = button.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-testid="weight-edit-button"]',
    )!;
    inner.click();
    expect(wrapperHandler).not.toHaveBeenCalled();
  });

  it("walks up the DOM to find the data-testid=\"child\" tile wrapper for the anchorRect", async () => {
    // SPEC §17.52 -- when mounted inside a `<children-grid>`
    // tile wrapper (the production path), the button's
    // anchorRect snapshot uses the TILE's rect, not the
    // button's tiny rect. The popover anchors against the
    // tile so it can position above-OR-below-OR-beside the
    // tile (the icon is too small to reason against).
    const tile = document.createElement("div");
    tile.setAttribute("data-testid", "child");
    tile.dataset["litFixture"] = "1";
    Object.defineProperty(tile, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          left: 100,
          right: 300,
          top: 50,
          bottom: 250,
          width: 200,
          height: 200,
          x: 100,
          y: 50,
          toJSON() {
            return {};
          },
        }) as DOMRect,
    });
    document.body.appendChild(tile);
    const el = document.createElement(
      "weight-edit-button",
    ) as WeightEditButton;
    el.nodeId = "uuid-1";
    el.weight = 1;
    tile.appendChild(el);
    await el.updateComplete;
    const seen: WeightEditOpenDetail[] = [];
    document.addEventListener(WEIGHT_EDIT_OPEN_EVENT, (e) => {
      seen.push((e as CustomEvent<WeightEditOpenDetail>).detail);
    });
    el.shadowRoot
      ?.querySelector<HTMLButtonElement>(
        '[data-testid="weight-edit-button"]',
      )
      ?.click();
    expect(seen).toHaveLength(1);
    // The captured rect is the TILE's, not the button's --
    // width 200 is the tile's width, the button is much
    // smaller in this unit fixture.
    expect(seen[0]?.anchorRect.width).toBe(200);
    expect(seen[0]?.anchorRect.left).toBe(100);
  });
});
