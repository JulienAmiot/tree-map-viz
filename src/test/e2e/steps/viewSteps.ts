/**
 * Step definitions for the Phase 6 view features (SPEC §12.3 + §17.9):
 * `views/text_node_views.feature`, `views/business_score_card_views.feature`,
 * `views/computed_aggregation_view.feature`, `views/plus_tile.feature`.
 *
 * Every step goes through the `TreeGraphPage` page object — which itself
 * speaks only the kiosk's served URL, the DOM, and the `?test=1`-gated
 * `window.__appTestApi__` bridge. The loose-coupling rule from SPEC §13.3
 * (no `src/{domain,application,adapters}/**` imports here) is enforced by
 * `eslint.config.js`.
 *
 * Fixtures are referenced by short name (`textTree`, `mixedComputed`,
 * `zeroEligible`, …) and resolved against `src/test/e2e/fixtures/trees/`;
 * each lookup is cached so repeated scenarios don't re-read from disk.
 */

import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBdd } from "playwright-bdd";

import { TreeGraphPage } from "../pageObjects/TreeGraphPage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures", "trees");
const fixtureCache = new Map<string, unknown>();

function loadFixture(name: string): unknown {
  const cached = fixtureCache.get(name);
  if (cached !== undefined) {
    return cached;
  }
  const fixturePath = path.join(FIXTURES_DIR, `${name}.json`);
  const parsed: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));
  fixtureCache.set(name, parsed);
  return parsed;
}

const { When, Then } = createBdd();

When(
  "I seed the {string} fixture via the test bridge",
  async ({ page }, fixtureName: string) => {
    const kiosk = new TreeGraphPage(page);
    await kiosk.seedTree(loadFixture(fixtureName));
  },
);

When("I focus on node {string}", async ({ page }, nodeUuid: string) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.focusNode(nodeUuid);
});

When("I click the plus tile", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.plusTileButtons().first().click();
});

When("I dismiss animations via the test bridge", async ({ page }) => {
  // SPEC §14.4 — the bridge sets `<html class="test-no-anim">` so the drill
  // helper short-circuits its CSS transition and commits navigation
  // synchronously. Without this step a Playwright drill scenario would have
  // to wait out `DRILL_SETTLE_MS` (250 ms) per drill.
  const kiosk = new TreeGraphPage(page);
  await kiosk.dismissAnimations();
});

When(
  "I tap the child tile for {string}",
  async ({ page }, nodeId: string) => {
    // SPEC §4 — tapping a child tile drills into it. The wrapper carries
    // `data-testid="child"` + `data-id="<uuid>"`; clicking the wrapper bubbles
    // a `tile-drill` `CustomEvent` that the composition root translates into
    // `nav.focusByUuid + router.push + refresh`.
    const kiosk = new TreeGraphPage(page);
    await kiosk.childById(nodeId).click();
  },
);

Then(
  "the URL hash includes {string}",
  async ({ page }, fragment: string) => {
    // The hash router pushes `#/b/<boardId>/n/<focusNodeUuid>`; assert the
    // tail fragment so the boardId remains free to vary.
    const url = new URL(page.url());
    expect(url.hash).toContain(fragment);
  },
);

Then(
  "the focused description is {string}",
  async ({ page }, expected: string) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.focusedDescription()).toHaveText(expected);
  },
);

Then("the focused value is {string}", async ({ page }, expected: string) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.focusedValue()).toHaveText(expected);
});

// SPEC §17.27 — TextNode value is rendered through a small markdown
// pipeline (escape-first, then bold/italic/code/links/headings/lists).
// These steps verify the *DOM shape* (semantic elements) the renderer
// emits, and the bidirectional contract between source and rendered
// text (textContent stays markdown-stripped, so existing
// `the focused value is "..."` style assertions keep working).
Then(
  "the focused value contains a {string} element",
  async ({ page }, tagName: string) => {
    const kiosk = new TreeGraphPage(page);
    const value = kiosk.focusedValue();
    await expect(value.locator(tagName)).toHaveCount(1, {
      // Some scenarios assert two list items + one ul; callers use
      // the dedicated *count* step for that. Here we keep the
      // simple "exactly one" contract.
      timeout: 2000,
    });
  },
);

Then(
  "the focused value contains {int} {string} elements",
  async ({ page }, n: number, tagName: string) => {
    const kiosk = new TreeGraphPage(page);
    const value = kiosk.focusedValue();
    await expect(value.locator(tagName)).toHaveCount(n);
  },
);

Then(
  "the focused value's body font-size is between {int} and {int} pixels",
  async ({ page }, lo: number, hi: number) => {
    // SPEC §17.27 — the markdown body uses a tile-relative `cqmin`
    // baseline tightened by a JS shrink-to-fit pass. We don't pin a
    // specific px value (it depends on the browser's viewport at
    // test-time) but we DO pin a sane range so the rendering can't
    // silently regress to "0 px" (broken) or "movie-theatre" sizes.
    const kiosk = new TreeGraphPage(page);
    const px = await kiosk.focusedValue().evaluate((el: Element) => {
      const cs = getComputedStyle(el);
      return parseFloat(cs.fontSize);
    });
    expect(px).toBeGreaterThanOrEqual(lo);
    expect(px).toBeLessThanOrEqual(hi);
  },
);

Then("the focused value area is empty", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  // `childrenCount` n=0 still renders <span data-testid="value"> (so existence
  // is asserted) but with no text content; assert both pieces explicitly.
  await expect(kiosk.focusedValue()).toHaveCount(1);
  await expect(kiosk.focusedValue()).toHaveText("");
});

Then("the focused value has a date", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.focusedValueDate()).toHaveCount(1);
});

Then("the focused value has no date", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.focusedValueDate()).toHaveCount(0);
});

Then("the focused node has no value", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.focusedValue()).toHaveCount(0);
});

Then("the focused node has a computed badge", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.focusedComputedBadge()).toHaveCount(1);
});

Then("the focused node has no computed badge", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.focusedComputedBadge()).toHaveCount(0);
});

Then("the focused id is {string}", async ({ page }, expected: string) => {
  const kiosk = new TreeGraphPage(page);
  expect(await kiosk.focusedId()).toBe(expected);
});

Then(
  "the child {string} has title {string}",
  async ({ page }, id: string, expected: string) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.childById(id).getByTestId("title")).toHaveText(expected);
  },
);

Then(
  "the child {string} has description {string}",
  async ({ page }, id: string, expected: string) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.childById(id).getByTestId("description")).toHaveText(
      expected,
    );
  },
);

Then(
  "the child {string} has no description block",
  async ({ page }, id: string) => {
    // SPEC §17.30 — descriptions are intentionally rendered ONLY on
    // the focused panel (parent role). Child tiles must NOT carry a
    // [data-testid="description"] element regardless of whether the
    // domain node has a non-empty description.
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.childById(id).getByTestId("description")).toHaveCount(0);
  },
);

Then(
  "the child {string} has value {string}",
  async ({ page }, id: string, expected: string) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.childById(id).getByTestId("value")).toHaveText(expected);
  },
);

Then("the child {string} has no value", async ({ page }, id: string) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.childById(id).getByTestId("value")).toHaveCount(0);
});

Then(
  "the child {string} has a computed badge",
  async ({ page }, id: string) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.childById(id).getByTestId("computed-badge")).toHaveCount(
      1,
    );
  },
);

Then(
  "the child {string} has no computed badge",
  async ({ page }, id: string) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.childById(id).getByTestId("computed-badge")).toHaveCount(
      0,
    );
  },
);

Then("the child {string} has a date", async ({ page }, id: string) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.childById(id).getByTestId("value-date")).toHaveCount(1);
});

Then("there are {int} child tiles", async ({ page }, expected: number) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.childTiles()).toHaveCount(expected);
});

Then("there is exactly one plus tile", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.plusTileButtons()).toHaveCount(1);
});

Then("there are {int} plus tiles", async ({ page }, expected: number) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.plusTileButtons()).toHaveCount(expected);
});

Then("the plus tile shows {string}", async ({ page }, expected: string) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.plusTileButtons().first()).toContainText(expected);
});

Then("the plus tile has a dashed border", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  // The dashed border is the visual hallmark of the affordance (SPEC §12.3 plus_tile).
  // `getComputedStyle().borderStyle` collapses the four sides into a single
  // shorthand iff they all match — exactly what we want to assert.
  const borderStyle = await kiosk
    .plusTileButtons()
    .first()
    .evaluate((el: Element) => getComputedStyle(el).borderStyle);
  expect(borderStyle).toBe("dashed");
});

Then("the plus tile has no title", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.plusTileHosts().getByTestId("title")).toHaveCount(0);
});

Then("the plus tile has no value", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.plusTileHosts().getByTestId("value")).toHaveCount(0);
});

Then("the plus tile has no value-date", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.plusTileHosts().getByTestId("value-date")).toHaveCount(0);
});

// — §17.14 layout steps ———————————————————————————————————————————

Then("the focused tile has no description block", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  // SPEC §17.14 — Description is no longer rendered in the tile body
  // for either kind; the value (text or number+unit) takes that space.
  await expect(kiosk.parentStrip().getByTestId("description")).toHaveCount(0);
});

Then("every tile title has the same font-size", async ({ page }) => {
  // SPEC §17.14 — "consistent across all the tiles" applies to the
  // children-grid tiles (the parent identity strip is a strip, not a
  // tile; it's allowed to scale up its title for the focused-context
  // emphasis). All child-tile titles must therefore agree pixel-for-
  // pixel modulo sub-pixel rounding.
  //
  // Auto-wait for at least one child tile to render before reading
  // computed styles. The `evaluateAll` below is a one-shot DOM read
  // and would otherwise race the kiosk's first render after a
  // `reload`. Asserting on the locator first piggy-backs on
  // playwright's built-in retry until a match exists; ChildA is the
  // first child of every fixture used by this scenario so it is a
  // safe pin.
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.childTiles().first()).toBeVisible();
  const sizes = await page
    .locator('children-grid [data-testid="title"]')
    .evaluateAll((els: Element[]) =>
      els.map((el) => parseFloat(getComputedStyle(el as HTMLElement).fontSize)),
    );
  expect(sizes.length).toBeGreaterThan(0);
  const first = sizes[0]!;
  for (const s of sizes) {
    expect(Math.abs(s - first)).toBeLessThanOrEqual(1);
  }
});

Then("every tile title's font-size is approximately 2vh", async ({ page }) => {
  const viewportHeight = page.viewportSize()?.height ?? 0;
  expect(viewportHeight).toBeGreaterThan(0);
  // tileLayoutStyles.ts sets the AsChild title to `font-size: 2vh`; the
  // AsParent variant overrides with `2.4vh`. We assert the AsChild
  // (children grid) titles to ensure the §17.14 baseline holds; the
  // AsParent variant is allowed to scale up slightly per role.
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.childTiles().first()).toBeVisible();
  const sizes = await page.$$eval(
    'children-grid [data-testid="title"]',
    (els: Element[]) =>
      els.map((el) => parseFloat(getComputedStyle(el as HTMLElement).fontSize)),
  );
  expect(sizes.length).toBeGreaterThan(0);
  const expected = viewportHeight * 0.02;
  for (const s of sizes) {
    // ±1.5px tolerance — covers fractional rounding + minor anti-aliasing.
    expect(Math.abs(s - expected)).toBeLessThanOrEqual(1.5);
  }
});

Then(
  "the focused value's unit font-size is one third of the value font-size",
  async ({ page }) => {
    // Playwright's locator API walks open shadow roots, which the raw
    // `querySelector` chain above does not — that's why an earlier
    // probe-via-evaluate version returned `null` for the unit element.
    const kiosk = new TreeGraphPage(page);
    const value = kiosk.parentStrip().getByTestId("value");
    await expect(value).toHaveCount(1);
    const valueFs = await value.evaluate((el: Element) =>
      parseFloat(getComputedStyle(el as HTMLElement).fontSize),
    );
    const unit = value.locator(".unit");
    await expect(unit).toHaveCount(1);
    const unitFs = await unit.evaluate((el: Element) =>
      parseFloat(getComputedStyle(el as HTMLElement).fontSize),
    );
    expect(valueFs).toBeGreaterThan(0);
    expect(unitFs).toBeGreaterThan(0);
    // calc(1em / 3) → 1/3 of the value's resolved font-size; allow ±1px
    // tolerance for sub-pixel rendering.
    expect(Math.abs(unitFs - valueFs / 3)).toBeLessThanOrEqual(1);
  },
);

Then(
  "on every child tile the value font-size is at least {int} times the title font-size",
  async ({ page }, factor: number) => {
    // SPEC §17.17 — "the figure should be the biggest possible". With
    // the cqmin coefficient bumped from 18 → 36, the value font-size
    // is roughly twice what it was. We assert a behavioural lower
    // bound (value ≥ N × title) rather than an absolute pixel count,
    // because the actual pixel size depends on the viewport + the
    // grid's per-tile cqmin. The factor is supplied by the feature so
    // the threshold is visible at the spec layer.
    const titleSizes = await page.$$eval(
      'children-grid [data-testid="title"]',
      (els: Element[]) =>
        els.map((el) => parseFloat(getComputedStyle(el as HTMLElement).fontSize)),
    );
    const valueSizes = await page.$$eval(
      'children-grid [data-testid="value"]',
      (els: Element[]) =>
        els.map((el) => parseFloat(getComputedStyle(el as HTMLElement).fontSize)),
    );
    expect(titleSizes.length).toBeGreaterThan(0);
    expect(valueSizes.length).toBe(titleSizes.length);
    for (let i = 0; i < titleSizes.length; i += 1) {
      const t = titleSizes[i]!;
      const v = valueSizes[i]!;
      expect(v).toBeGreaterThanOrEqual(t * factor);
    }
  },
);

Then("every child tile has a visible border", async ({ page }) => {
  // SPEC §17.17 — child tiles must be visually distinguishable from
  // each other; the border is one of the two cues (the other is the
  // background tint). Read the rendered style from each `[data-slot=
  // "node"]` wrapper inside `<children-grid>`; the rule is scoped to
  // that selector exactly to avoid colliding with the plus tile's
  // dashed look (which lives on its inner button).
  const widths = await page.$$eval(
    'children-grid .tile[data-slot="node"]',
    (els: Element[]) =>
      els.map((el) => parseFloat(getComputedStyle(el as HTMLElement).borderTopWidth)),
  );
  expect(widths.length).toBeGreaterThan(0);
  for (const w of widths) {
    expect(w).toBeGreaterThanOrEqual(1);
  }
});

Then("every child tile has a non-transparent background", async ({ page }) => {
  // The background tint is a `color-mix` derived from `currentColor`
  // mixed with a small alpha. The browser resolves it to a rgba()
  // with alpha ∈ (0, 1). A fully-transparent default would resolve
  // to "rgba(0, 0, 0, 0)".
  const bgs = await page.$$eval(
    'children-grid .tile[data-slot="node"]',
    (els: Element[]) =>
      els.map((el) => getComputedStyle(el as HTMLElement).backgroundColor),
  );
  expect(bgs.length).toBeGreaterThan(0);
  for (const bg of bgs) {
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toBe("transparent");
    expect(bg).not.toBe("");
    // Best-effort alpha check: parse rgba(...).a and confirm it's
    // strictly between 0 and 1 (a non-zero tint that isn't a solid
    // wall covering the value below).
    const m = /rgba?\(([^)]+)\)/.exec(bg);
    if (m) {
      const parts = m[1]!.split(",").map((s) => s.trim());
      const a = parts.length === 4 ? Number(parts[3]) : 1;
      expect(a).toBeGreaterThan(0);
      expect(a).toBeLessThan(1);
    }
  }
});

/**
 * SPEC §17.36 helpers — read the rendered panel-surface properties
 * (border colour, border radius, background colour) from either the
 * parent-identity-strip's inner `.strip` element (inside its shadow
 * root) or from a child tile in the children-grid's shadow root. Both
 * surfaces draw their border + radius + bg on the OUTER element of
 * the panel (the inner `.strip` for the strip; the `.tile[data-slot=
 * "node"]` div for the child); reading getComputedStyle on those
 * elements gives us the resolved rgba()/px values so we can compare
 * them numerically.
 */
function readStripPanelStyle(page: Page) {
  return page.evaluate(() => {
    const screen = document.querySelector("tree-graph-screen");
    const strip = screen?.shadowRoot?.querySelector("parent-identity-strip");
    const inner = strip?.shadowRoot?.querySelector(".strip") as
      | HTMLElement
      | null;
    if (!inner) return null;
    const cs = getComputedStyle(inner);
    return {
      borderColor: cs.borderTopColor,
      borderWidth: parseFloat(cs.borderTopWidth),
      borderRadius: cs.borderTopLeftRadius,
      backgroundColor: cs.backgroundColor,
    };
  });
}

function readFirstChildTilePanelStyle(page: Page) {
  return page.evaluate(() => {
    const screen = document.querySelector("tree-graph-screen");
    const grid = screen?.shadowRoot?.querySelector("children-grid");
    const tile = grid?.shadowRoot?.querySelector(
      '.tile[data-slot="node"]',
    ) as HTMLElement | null;
    if (!tile) return null;
    const cs = getComputedStyle(tile);
    return {
      borderColor: cs.borderTopColor,
      borderWidth: parseFloat(cs.borderTopWidth),
      borderRadius: cs.borderTopLeftRadius,
      backgroundColor: cs.backgroundColor,
    };
  });
}

Then("the parent panel has a visible border", async ({ page }) => {
  const s = await readStripPanelStyle(page);
  expect(s).not.toBeNull();
  expect(s!.borderWidth).toBeGreaterThanOrEqual(1);
});

Then("the parent panel has a non-transparent background", async ({ page }) => {
  const s = await readStripPanelStyle(page);
  expect(s).not.toBeNull();
  const bg = s!.backgroundColor;
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  expect(bg).not.toBe("transparent");
  expect(bg).not.toBe("");
  // Modern Chromium serialises `color-mix(in srgb, ...)` outputs as
  // `color(srgb r g b / a)`, while older paths still emit
  // `rgba(r, g, b, a)`. Accept both shapes; either way the bg has a
  // visible alpha strictly between 0 and 1 (a non-zero tint that
  // isn't a solid wall over the focused value).
  const rgba = /rgba?\(([^)]+)\)/.exec(bg);
  const colorFn = /color\([^)]*\/\s*([0-9.]+)\s*\)/.exec(bg);
  let a: number | undefined;
  if (rgba) {
    const parts = rgba[1]!.split(",").map((s) => s.trim());
    a = parts.length === 4 ? Number(parts[3]) : 1;
  } else if (colorFn) {
    a = Number(colorFn[1]);
  }
  expect(a).toBeDefined();
  expect(a!).toBeGreaterThan(0);
  expect(a!).toBeLessThan(1);
});

Then(
  "the parent panel border colour matches a child tile border colour",
  async ({ page }) => {
    const strip = await readStripPanelStyle(page);
    const tile = await readFirstChildTilePanelStyle(page);
    expect(strip).not.toBeNull();
    expect(tile).not.toBeNull();
    expect(strip!.borderColor).toBe(tile!.borderColor);
  },
);

Then(
  "the parent panel border-radius matches a child tile border-radius",
  async ({ page }) => {
    const strip = await readStripPanelStyle(page);
    const tile = await readFirstChildTilePanelStyle(page);
    expect(strip).not.toBeNull();
    expect(tile).not.toBeNull();
    expect(strip!.borderRadius).toBe(tile!.borderRadius);
  },
);

Then(
  "the parent panel background tint differs from a child tile background tint",
  async ({ page }) => {
    // §17.36 — the parent strip uses --panel-strip-bg (~12 %) while a
    // child tile uses --panel-tile-bg (~7 %). The exact resolved
    // rgba() depends on the kiosk theme's currentColor, but the two
    // alpha components must NOT match — that's the visible delta the
    // drill morph bridges. Both must still be non-transparent (the
    // separate "non-transparent background" steps cover that
    // invariant individually).
    const strip = await readStripPanelStyle(page);
    const tile = await readFirstChildTilePanelStyle(page);
    expect(strip).not.toBeNull();
    expect(tile).not.toBeNull();
    expect(strip!.backgroundColor).not.toBe(tile!.backgroundColor);
  },
);

Then(
  "the focused value-date is in the bottom-right corner of the tile",
  async ({ page }) => {
    // §17.18 — timestamp moved from top-right to bottom-right. We use
    // the parent-strip host (`<business-score-card-as-parent>` /
    // `<text-node-as-parent>`) bounding box as the "tile" reference:
    // it has `width: 100%; height: 100%` so its box matches the slot
    // it occupies. The title sits at the top of that host; the
    // timestamp must sit at the bottom-right corner of the same host.
    const kiosk = new TreeGraphPage(page);
    const ts = kiosk.parentStrip().getByTestId("value-date");
    const title = kiosk.parentStrip().getByTestId("title");
    await expect(ts).toHaveCount(1);
    await expect(title).toHaveCount(1);
    const tsBox = await ts.boundingBox();
    const titleBox = await title.boundingBox();
    expect(tsBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    // The title row gives us the tile's left/right and top edges; for
    // the bottom edge we read the parent-strip host's box (it spans
    // the same width as the title and reaches down to the tile's
    // bottom).
    const stripBox = await kiosk.parentStrip().boundingBox();
    expect(stripBox).not.toBeNull();
    // Right half of the tile:
    const titleMidX = titleBox!.x + titleBox!.width / 2;
    expect(tsBox!.x).toBeGreaterThan(titleMidX);
    // Bottom half of the tile (well below the title row):
    const stripMidY = stripBox!.y + stripBox!.height / 2;
    expect(tsBox!.y).toBeGreaterThan(stripMidY);
    // Hugs the right edge of the tile:
    const distFromRight = titleBox!.x + titleBox!.width - (tsBox!.x + tsBox!.width);
    expect(distFromRight).toBeLessThan(64);
    // Hugs the bottom edge of the tile:
    const distFromBottom =
      stripBox!.y + stripBox!.height - (tsBox!.y + tsBox!.height);
    expect(distFromBottom).toBeLessThan(64);
  },
);

Then(
  "the focused value-date offset matches a child tile value-date offset within {int} px",
  async ({ page }, tolerancePx: number) => {
    // SPEC §17.30 — the parent panel's timestamp must sit at the same
    // visual distance from the strip's outer edge as a child tile's
    // timestamp from its tile's outer edge. The shared
    // `tileLayoutStyles` declares `bottom: 0.4rem; right: 0.6rem` for
    // both — the parity hinges on the per-view's `:host { position:
    // static }` override letting the timestamp escape the strip's
    // wrapper padding.
    //
    // The check: compute (rightEdge - timestamp.right, bottomEdge -
    // timestamp.bottom) for both the parent strip and a child tile
    // that has its own value-date, then assert the deltas match
    // within `tolerancePx` (sub-rem, generous enough to absorb sub-
    // pixel rounding + a possible 1-px strip border).
    //
    // We look up the child tile by `data-id` rather than walking
    // `closest('[data-testid="child"]')` from the timestamp because
    // the timestamp lives inside the per-view's shadow root and
    // `Element.closest` does not pierce shadow boundaries. Picking a
    // known-id child (ChildB — recordedValue, always carries a date)
    // sidesteps the need for a shadow-piercing walk and keeps the
    // step kiosk-mode agnostic.
    const kiosk = new TreeGraphPage(page);
    const parentTs = kiosk.parentStrip().getByTestId("value-date");
    await expect(parentTs).toHaveCount(1);
    const parentBox = await parentTs.boundingBox();
    const stripBox = await kiosk.parentStrip().boundingBox();
    expect(parentBox).not.toBeNull();
    expect(stripBox).not.toBeNull();

    const childTile = kiosk.childById("ChildB");
    const childTs = childTile.getByTestId("value-date");
    await expect(childTs).toHaveCount(1);
    const childBox = await childTs.boundingBox();
    const childTileBox = await childTile.boundingBox();
    expect(childBox).not.toBeNull();
    expect(childTileBox).not.toBeNull();

    const parentRightOffset =
      stripBox!.x + stripBox!.width - (parentBox!.x + parentBox!.width);
    const parentBottomOffset =
      stripBox!.y + stripBox!.height - (parentBox!.y + parentBox!.height);
    const childRightOffset =
      childTileBox!.x + childTileBox!.width - (childBox!.x + childBox!.width);
    const childBottomOffset =
      childTileBox!.y + childTileBox!.height - (childBox!.y + childBox!.height);

    expect(Math.abs(parentRightOffset - childRightOffset)).toBeLessThanOrEqual(
      tolerancePx,
    );
    expect(Math.abs(parentBottomOffset - childBottomOffset)).toBeLessThanOrEqual(
      tolerancePx,
    );
  },
);

Then(
  "the focused title offset matches a child tile title offset within {int} px",
  async ({ page }, tolerancePx: number) => {
    // SPEC §17.37 — the focused panel's title must sit at the same
    // visual distance from the strip's outer top-left as a child
    // tile's title from its tile's outer top-left. Pre-§17.37 the
    // strip's wrapper carried `padding: clamp(0.5rem, 1.5vw,
    // 1.25rem)` which pushed the parent title ~0.5–1.25rem further
    // down and to the right than the child title. Post-§17.37 the
    // strip's outer padding is 0; the inner per-view's
    // `:host { padding: 0.4rem 0.6rem }` (from `tileLayoutStyles`)
    // is the only padding in play on either surface, so both
    // titles land at the same `1px (border) + 0.4rem` top inset
    // and `1px (border) + 0.6rem` left inset.
    //
    // Mirror of the §17.30 timestamp-parity check (above). Same
    // ChildB tile choice: it always renders a title and is part of
    // the `mixedComputed` fixture, so this scenario can be chained
    // against the same setup as the timestamp parity scenario.
    const kiosk = new TreeGraphPage(page);
    const parentTitle = kiosk.parentStrip().getByTestId("title");
    await expect(parentTitle).toHaveCount(1);
    const parentBox = await parentTitle.boundingBox();
    const stripBox = await kiosk.parentStrip().boundingBox();
    expect(parentBox).not.toBeNull();
    expect(stripBox).not.toBeNull();

    const childTile = kiosk.childById("ChildB");
    const childTitle = childTile.getByTestId("title");
    await expect(childTitle).toHaveCount(1);
    const childBox = await childTitle.boundingBox();
    const childTileBox = await childTile.boundingBox();
    expect(childBox).not.toBeNull();
    expect(childTileBox).not.toBeNull();

    const parentTopOffset = parentBox!.y - stripBox!.y;
    const parentLeftOffset = parentBox!.x - stripBox!.x;
    const childTopOffset = childBox!.y - childTileBox!.y;
    const childLeftOffset = childBox!.x - childTileBox!.x;

    expect(Math.abs(parentTopOffset - childTopOffset)).toBeLessThanOrEqual(
      tolerancePx,
    );
    expect(Math.abs(parentLeftOffset - childLeftOffset)).toBeLessThanOrEqual(
      tolerancePx,
    );
  },
);

Then(
  "the focused value-date colour is on the warm-to-cold age gradient",
  async ({ page }) => {
    // §17.18 + §17.21 — the corner timestamp's colour is set via
    // `--age-color` (a custom property) → `color: var(--age-color,
    // currentColor)`. We read the resolved `color` and confirm it
    // lies in the convex hull of the *default* fresh endpoint
    // (`rgb(255, 145, 50)`) and its dynamically-computed desaturated
    // counterpart (HSL same-hue, S≈6%, L≈70% → ≈ `rgb(183, 178, 174)`),
    // i.e. the gradient is actually being applied — not falling
    // through to `currentColor`.
    const kiosk = new TreeGraphPage(page);
    const ts = kiosk.parentStrip().getByTestId("value-date");
    await expect(ts).toHaveCount(1);
    const color = await ts.evaluate((el) => getComputedStyle(el).color);
    expect(color).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
    const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color);
    expect(m).not.toBeNull();
    const [r, g, b] = [Number(m![1]), Number(m![2]), Number(m![3])];
    // Convex combination of (255, 145, 50) and ≈(183, 178, 174):
    //   r ∈ [183, 255], g ∈ [145, 178], b ∈ [50, 174].
    // Bounds widened by ±2 to absorb HSL→RGB rounding.
    expect(r).toBeGreaterThanOrEqual(181);
    expect(r).toBeLessThanOrEqual(255);
    expect(g).toBeGreaterThanOrEqual(143);
    expect(g).toBeLessThanOrEqual(180);
    expect(b).toBeGreaterThanOrEqual(48);
    expect(b).toBeLessThanOrEqual(176);
  },
);
