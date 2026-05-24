import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/organisms/PictureNode/PictureNodeAsChild.js";
import { PictureNodeAsChild } from "../../../../../../adapters/ui/organisms/PictureNode/PictureNodeAsChild.js";
import type { PictureNodeViewModel } from "../../../../../../adapters/ui/molecules/NodeViewModel.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

function vmWith(opts: Partial<PictureNodeViewModel> = {}): PictureNodeViewModel {
  return {
    kind: "PictureNode",
    id: "pic-1",
    title: "Office floor plan",
    imageUrl: "https://example.com/floor.jpg",
    ...opts,
  } as PictureNodeViewModel;
}

/**
 * SPEC §17.119 — `<picture-node-as-child>` unit tests.
 *
 * The child role for a picture is intentionally minimal: title row
 * + an `<img>` that fills the value-area with `object-fit: cover`,
 * with the §17.44 `warning-fill` glyph as the load-failure
 * fallback. No timestamp, no description, no inline-edit
 * affordance — that's all parent-role surface.
 */
describe("<picture-node-as-child>", () => {
  it("\u00a717.121i / \u00a717.136 S10 \u2014 a disabled VM surfaces a `.disabled-indicator` forbidden-sign glyph in card-frame's `icons` slot (was the title's firstElementChild pre-\u00a717.136 S10); an enabled VM emits nothing (no strike, no value-area dim)", async () => {
    const enabled = await mountLitElement<PictureNodeAsChild>("picture-node-as-child", (e) => { e.vm = vmWith(); });
    expect(enabled.shadowRoot?.querySelector('[data-testid="disabled-indicator"]')).toBeNull();
    expect(enabled.shadowRoot?.querySelector('[data-testid="value-row"]')?.hasAttribute("data-disabled")).toBe(false);
    const off = await mountLitElement<PictureNodeAsChild>("picture-node-as-child", (e) => { e.vm = vmWith({ disabled: true }); });
    const indicator = off.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="disabled-indicator"]',
    );
    expect(indicator).not.toBeNull();
    // \u00a717.136 S10 -- the indicator now lives in card-frame's
    // `icons` slot (was the title's firstElementChild pre-strand via
    // the §17.121i `renderStaticTitle` prefix arg). Pin the slot
    // membership + the explicit NOT-IN-TITLE check so a regression to
    // the flat layout surfaces here.
    expect(indicator?.closest('[data-testid="icons-slot"]')).not.toBeNull();
    expect(indicator?.closest('[data-testid="title"]')).toBeNull();
    expect(indicator?.tagName).toBe("SPAN");
    // §17.133 -- the indicator hosts a single `<ds-icon name="ban">`
    // Lucide SVG child (was an empty span styled by a `::before`
    // pseudo pre-§17.133). Unchanged by §17.136 S10.
    expect(indicator?.children.length).toBe(1);
    expect(indicator?.firstElementChild?.tagName.toLowerCase()).toBe("ds-icon");
    expect(indicator?.firstElementChild?.getAttribute("name")).toBe("ban");
    expect(off.shadowRoot?.querySelector('[data-testid="value-row"]')?.hasAttribute("data-disabled")).toBe(false);
  });

  it("\u00a717.121j \u2014 reserves the shared `.subtitle` slot (empty) so the QR area lands at the same y-offset as text / workflow tiles", async () => {
    const el = await mountLitElement<PictureNodeAsChild>("picture-node-as-child", (e) => { e.vm = vmWith(); });
    const subtitle = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="subtitle"]');
    expect(subtitle).not.toBeNull();
    expect(subtitle?.textContent?.trim()).toBe("");
    // \u00a717.136 S10 -- the subtitle slot is now routed through
    // card-frame's `subtitle` named slot rather than sitting in
    // the per-view's flat layout. Pin the slot attribute.
    expect(subtitle?.getAttribute("slot")).toBe("subtitle");
  });

  it("\u00a717.136 S10 \u2014 the entire render output is wrapped in a single `<card-frame>` with default 22% / 12% header / footer (small tree-map tile)", async () => {
    const el = await mountLitElement<PictureNodeAsChild>(
      "picture-node-as-child",
      (e) => { e.vm = vmWith(); },
    );
    const cardFrames = el.shadowRoot?.querySelectorAll("card-frame");
    expect(cardFrames?.length).toBe(1);
    const cf = cardFrames?.[0] as HTMLElement;
    // No inline sizing override -- the molecule's defaults apply on
    // tree-map child tiles (same as S2 / S4 / S6 / S8). A regression
    // that adds focused-panel overrides here would surface as a
    // populated style attribute carrying --card-header-height.
    const style = cf.getAttribute("style") ?? "";
    expect(style).not.toMatch(/--card-header-height/);
    expect(style).not.toMatch(/--card-footer-height/);
    // Slot routing: value-area lives in `slot="body"`; no timestamp
    // on a snapshot leaf.
    const valueRow = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="value-row"]');
    expect(valueRow?.getAttribute("slot")).toBe("body");
    expect(el.shadowRoot?.querySelector('[data-testid="value-date"]')).toBeNull();
  });

  it("renders the title with the PictureNode view-kind tag", async () => {
    const el = await mountLitElement<PictureNodeAsChild>(
      "picture-node-as-child",
      (e) => {
        e.vm = vmWith({ id: "uuid-x", title: "Region map" });
      },
    );
    const title = el.shadowRoot?.querySelector('[data-testid="title"]');
    expect(title?.textContent?.trim()).toBe("Region map");
    expect(title?.getAttribute("data-view-kind")).toBe("PictureNode");
    expect(title?.getAttribute("data-id")).toBe("uuid-x");
  });

  it("renders an <img> sized to fill the value-area with the VM's URL + cover sizing", async () => {
    const el = await mountLitElement<PictureNodeAsChild>(
      "picture-node-as-child",
      (e) => {
        e.vm = vmWith({
          imageUrl: "https://example.com/p.png",
          title: "Plant photo",
        });
      },
    );

    const img = el.shadowRoot?.querySelector<HTMLImageElement>(
      '[data-testid="picture-image"]',
    );
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://example.com/p.png");
    // Alt text mirrors the title for screen-reader parity (§17.119).
    expect(img?.getAttribute("alt")).toBe("Plant photo");
    expect(img?.getAttribute("data-value-kind")).toBe("imageUrl");

    // The operator's core requirement — pin the literal CSS rule so a
    // future refactor that drops `object-fit: cover` (or flips it to
    // contain) fails fast at test-time.
    const cssText = (PictureNodeAsChild.styles as readonly { cssText?: string }[])
      .map((s) => String(s.cssText ?? s))
      .join("\n");
    expect(cssText).toMatch(/\.picture-img\s*\{[\s\S]*?object-fit:\s*cover/);
    expect(cssText).toMatch(/\.picture-img\s*\{[\s\S]*?width:\s*100%/);
    expect(cssText).toMatch(/\.picture-img\s*\{[\s\S]*?height:\s*100%/);
  });

  it("on the <img>'s error event, swaps the image for the same warning-fill glyph the Computed* tiles use (§17.116 parity)", async () => {
    const el = await mountLitElement<PictureNodeAsChild>(
      "picture-node-as-child",
      (e) => {
        e.vm = vmWith({ imageUrl: "https://nope.invalid/x.png" });
      },
    );
    const img = el.shadowRoot?.querySelector<HTMLImageElement>(
      '[data-testid="picture-image"]',
    );
    expect(img).not.toBeNull();

    // Fire the same `error` event the browser fires when the source
    // can't be reached. The view's @error handler trips its internal
    // hasError flag and Lit re-renders the value-area with the
    // warning-fill swap.
    img!.dispatchEvent(new Event("error"));
    await el.updateComplete;

    expect(
      el.shadowRoot?.querySelector('[data-testid="picture-image"]'),
    ).toBeNull();
    const warning = el.shadowRoot?.querySelector(
      '[data-testid="warning-fill"]',
    );
    expect(warning).not.toBeNull();
    expect(warning?.getAttribute("role")).toBe("img");
    // The shared `.warning-fill` rule from tileLayoutStyles drives the
    // visual; the reason attribute is the stable e2e/A11y hook the
    // operator and a future fault-debugging test can read.
    expect(warning?.getAttribute("data-reason")).toBe("image-load-failed");
  });

  it("swapping vm.imageUrl after a load failure clears the warning state and retries the <img>", async () => {
    const el = await mountLitElement<PictureNodeAsChild>(
      "picture-node-as-child",
      (e) => {
        e.vm = vmWith({ imageUrl: "https://nope.invalid/x.png" });
      },
    );
    el.shadowRoot
      ?.querySelector<HTMLImageElement>('[data-testid="picture-image"]')
      ?.dispatchEvent(new Event("error"));
    await el.updateComplete;
    expect(
      el.shadowRoot?.querySelector('[data-testid="warning-fill"]'),
    ).not.toBeNull();

    // Operator edits the URL via the modal → composition root pushes a
    // new VM with a different `imageUrl`. The view must reset its
    // local error flag and render an <img> for the new URL. The
    // reset happens in `willUpdate` (before render), so a single
    // `updateComplete` await is enough — no double-render race.
    el.vm = vmWith({ imageUrl: "https://example.com/works.jpg" });
    await el.updateComplete;

    expect(
      el.shadowRoot?.querySelector('[data-testid="warning-fill"]'),
    ).toBeNull();
    const img = el.shadowRoot?.querySelector<HTMLImageElement>(
      '[data-testid="picture-image"]',
    );
    expect(img?.getAttribute("src")).toBe("https://example.com/works.jpg");
  });

  it("does NOT render a timestamp (PictureNode is a snapshot leaf, no asOf)", async () => {
    const el = await mountLitElement<PictureNodeAsChild>(
      "picture-node-as-child",
      (e) => {
        e.vm = vmWith();
      },
    );
    expect(el.shadowRoot?.querySelector('[data-testid="value-date"]')).toBeNull();
  });

  it("does NOT render a Σ computed-badge (the picture is not aggregated)", async () => {
    const el = await mountLitElement<PictureNodeAsChild>(
      "picture-node-as-child",
      (e) => {
        e.vm = vmWith();
      },
    );
    expect(
      el.shadowRoot?.querySelector('[data-testid="computed-badge"]'),
    ).toBeNull();
  });

  it("renders nothing meaningful when vm is null (default state pre-bind)", async () => {
    const el = await mountLitElement<PictureNodeAsChild>(
      "picture-node-as-child",
    );
    expect(el.shadowRoot?.querySelector('[data-testid="title"]')).toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="picture-image"]'),
    ).toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="warning-fill"]'),
    ).toBeNull();
  });

  it("\u00a717.136 S13b \u2014 stamps a `<weight-edit-button slot=\"footer-left\">` carrying the vm.id + the forwarded weight property", async () => {
    const el = await mountLitElement<PictureNodeAsChild>(
      "picture-node-as-child",
      (e) => {
        e.vm = vmWith({ id: "pic-child-uuid" });
        e.weight = 4.2;
      },
    );
    const btn = el.shadowRoot?.querySelector<HTMLElement & { weight: number }>(
      "weight-edit-button",
    );
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute("slot")).toBe("footer-left");
    expect(btn?.getAttribute("node-id")).toBe("pic-child-uuid");
    expect(btn?.weight).toBe(4.2);
  });
});
