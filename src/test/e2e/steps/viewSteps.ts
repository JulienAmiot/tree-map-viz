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
    // §17.18 — timestamp moved from top-right to bottom-right.
    // §17.45 introduced the metric-pane (`.metric-pane` inside the
    // per-view's body) as the timestamp's containing block; with a
    // description sibling the metric-pane is the LEFT half of the
    // body (row flex) and with no description it fills the body. The
    // §17.46 amendment switches the body to column flex when the
    // per-view's host is taller than wide (the landscape left-rail
    // case), in which case the metric-pane is the TOP half of the
    // body and the description sits below -- so "bottom-right of the
    // tile" no longer maps to "bottom of the strip's outer rect"
    // when a description is present. The contract that survives both
    // refactors is "bottom-right of the metric-pane" (the §17.45
    // containing block); that's what this step now reads against.
    const kiosk = new TreeGraphPage(page);
    const ts = kiosk.parentStrip().getByTestId("value-date");
    const title = kiosk.parentStrip().getByTestId("title");
    const metricPane = kiosk.parentStrip().getByTestId("metric-pane");
    await expect(ts).toHaveCount(1);
    await expect(title).toHaveCount(1);
    await expect(metricPane).toHaveCount(1);
    const tsBox = await ts.boundingBox();
    const titleBox = await title.boundingBox();
    const paneBox = await metricPane.boundingBox();
    expect(tsBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    expect(paneBox).not.toBeNull();
    // Right half of the metric-pane:
    const paneMidX = paneBox!.x + paneBox!.width / 2;
    expect(tsBox!.x).toBeGreaterThan(paneMidX);
    // Bottom half of the metric-pane (well below the title row):
    const paneMidY = paneBox!.y + paneBox!.height / 2;
    expect(tsBox!.y).toBeGreaterThan(paneMidY);
    // Hugs the right edge of the metric-pane:
    const distFromRight = paneBox!.x + paneBox!.width - (tsBox!.x + tsBox!.width);
    expect(distFromRight).toBeLessThan(64);
    // Hugs the bottom edge of the metric-pane:
    const distFromBottom =
      paneBox!.y + paneBox!.height - (tsBox!.y + tsBox!.height);
    expect(distFromBottom).toBeLessThan(64);
  },
);

Then(
  "the focused value-date offset matches a child tile value-date offset within {int} px",
  async ({ page }, tolerancePx: number) => {
    // SPEC §17.30 (refined by §17.45) — the parent panel's timestamp
    // must sit at the same visual distance from the metric-pane's
    // outer edge as a child tile's timestamp from its tile's outer
    // edge. The shared `tileLayoutStyles` declares
    // `bottom: 0.4rem; right: 0.6rem` for both — the parity hinges
    // on the metric-pane carrying `position: relative` so the
    // absolute-positioned timestamp resolves its containing block to
    // the metric-pane (post-§17.45).
    //
    // Pre-§17.45 the per-view's `:host { position: static }` override
    // piped the timestamp's containing block one layer outward to the
    // `<parent-identity-strip>` wrapper, so the parity was measured
    // against the strip's outer edge. §17.45 introduces a horizontal
    // split (metric-pane left, optional description right): when a
    // description is present the metric-pane is the LEFT half of the
    // strip body, and "the same offset from the outer edge" means
    // "from the metric-pane's outer edge", not from the strip's. The
    // step measures against the metric-pane unconditionally; with no
    // description the metric-pane fills the body so the contract
    // collapses to the pre-§17.45 strip-outer parity.
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
    const metricPane = kiosk.parentStrip().getByTestId("metric-pane");
    await expect(metricPane).toHaveCount(1);
    const paneBox = await metricPane.boundingBox();
    expect(parentBox).not.toBeNull();
    expect(paneBox).not.toBeNull();

    const childTile = kiosk.childById("ChildB");
    const childTs = childTile.getByTestId("value-date");
    await expect(childTs).toHaveCount(1);
    const childBox = await childTs.boundingBox();
    const childTileBox = await childTile.boundingBox();
    expect(childBox).not.toBeNull();
    expect(childTileBox).not.toBeNull();

    const parentRightOffset =
      paneBox!.x + paneBox!.width - (parentBox!.x + parentBox!.width);
    const parentBottomOffset =
      paneBox!.y + paneBox!.height - (parentBox!.y + parentBox!.height);
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
  "the focused BSC value is horizontally centered to its metric pane within {int} px",
  async ({ page }, tolerancePx: number) => {
    // SPEC §17.39 (refined by §17.45) — the centered BSC `.value`
    // span on the focused panel must sit at the **metric-pane**'s
    // horizontal center. The metric-pane is the layout container
    // the per-view introduces in §17.45 to host the BSC's numeric
    // content (value + target row + timestamp); when no description
    // sibling is present the metric-pane fills the strip's body
    // (post-title, gutter-escaped via the §17.39 negative margin),
    // so "centered in the metric-pane" collapses to the pre-§17.45
    // "centered in the strip's full width" contract; when a
    // description IS present the metric-pane is the LEFT half of
    // the strip body, and the centered value sits at the LEFT-half
    // center — the operator's mental model becomes "the value is
    // centered in the metric area, the description is on the right".
    //
    // The check computes the value's center-x and asserts it matches
    // the metric-pane's center-x within `tolerancePx`. Measuring
    // against the metric-pane (not the strip) makes the assertion
    // stable whether the focused node carries a description or not.
    //
    // Focus must be on a BSC node with a recordedValue (so the
    // `.value` is a non-empty span the bounding box is well-defined
    // for). `ChildB` in `mixedComputed` satisfies that — the
    // scenario above seeds and focuses accordingly.
    const kiosk = new TreeGraphPage(page);
    const parentValue = kiosk.parentStrip().getByTestId("value");
    await expect(parentValue).toHaveCount(1);
    const valueBox = await parentValue.boundingBox();
    const metricPane = kiosk.parentStrip().getByTestId("metric-pane");
    await expect(metricPane).toHaveCount(1);
    const paneBox = await metricPane.boundingBox();
    expect(valueBox).not.toBeNull();
    expect(paneBox).not.toBeNull();

    const valueCenterX = valueBox!.x + valueBox!.width / 2;
    const paneCenterX = paneBox!.x + paneBox!.width / 2;

    expect(Math.abs(valueCenterX - paneCenterX)).toBeLessThanOrEqual(
      tolerancePx,
    );
  },
);

Then(
  "the focused value-date colour is on the warm-to-cold age gradient",
  async ({ page }) => {
    // §17.18 + §17.42 — the corner timestamp's colour is set via
    // `--age-color` (a custom property) → `color: var(--age-color,
    // currentColor)`. The gradient endpoints were simplified in
    // §17.42 from the §17.21 per-board colour design to a fixed
    // bright off-white (`rgb(245, 245, 245)`) at age 0 days fading
    // linearly to a dark grey (`rgb(64, 64, 64)`) at >= 30 days
    // old. We confirm the resolved `color` is achromatic (R = G =
    // B within ±1 to absorb gamma rounding) and falls inside that
    // ramp — i.e. the helper is actually emitting a gradient
    // colour, not falling through to `currentColor`.
    const kiosk = new TreeGraphPage(page);
    const ts = kiosk.parentStrip().getByTestId("value-date");
    await expect(ts).toHaveCount(1);
    const color = await ts.evaluate((el) => getComputedStyle(el).color);
    expect(color).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
    const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color);
    expect(m).not.toBeNull();
    const [r, g, b] = [Number(m![1]), Number(m![2]), Number(m![3])];
    // Achromatic — both endpoints are pure greys, so the lerp is
    // achromatic at every step. ±1 tolerance for sRGB rounding.
    expect(Math.abs(r - g)).toBeLessThanOrEqual(1);
    expect(Math.abs(r - b)).toBeLessThanOrEqual(1);
    // Bounded by the §17.42 endpoints (64 ≤ channel ≤ 245).
    expect(r).toBeGreaterThanOrEqual(63);
    expect(r).toBeLessThanOrEqual(246);
  },
);

// -- SPEC §17.40 -- BSC objective row + gradient value colour + warning ----

Then(
  "the child tile {string} shows a target row with text containing {string}",
  async ({ page }, nodeId: string, expectedSubstring: string) => {
    // SPEC §17.40 — the per-tile target row carries a bullseye icon
    // and a `target-text` span with the target value + unit, optionally
    // followed by a `target-date` time element.
    const kiosk = new TreeGraphPage(page);
    const tile = kiosk.childById(nodeId);
    await expect(tile).toHaveCount(1);
    const row = tile.getByTestId("target-row");
    await expect(row).toHaveCount(1);
    const text = (await row.textContent()) ?? "";
    expect(text.replace(/\s+/g, " ")).toContain(expectedSubstring);
  },
);

Then(
  "the focused parent strip shows a target row with text containing {string}",
  async ({ page }, expectedSubstring: string) => {
    // Same contract as the child-tile step, scoped to the focused
    // parent strip — the BSC parent role re-uses the same template
    // helper, and the per-view's `:host { position: static }` does
    // not affect the target-row's flow inside `.value-area`.
    const kiosk = new TreeGraphPage(page);
    const row = kiosk.parentStrip().getByTestId("target-row");
    await expect(row).toHaveCount(1);
    const text = (await row.textContent()) ?? "";
    expect(text.replace(/\s+/g, " ")).toContain(expectedSubstring);
  },
);

Then(
  "the child tile {string} value carries a gradient colour",
  async ({ page }, nodeId: string) => {
    // SPEC §17.40 — the mapper bakes a four-stop red → green ramp
    // colour into the VM at `objective.valueColor` and the per-view
    // applies it via the `--bsc-value-color` custom property on the
    // `.value` element. We read the resolved `color` and reject the
    // tile-default text colour (the `<body>` text colour the rest
    // of the kiosk inherits) -- a non-empty ramp colour will be
    // distinct.
    const kiosk = new TreeGraphPage(page);
    const tile = kiosk.childById(nodeId);
    await expect(tile).toHaveCount(1);
    const value = tile.getByTestId("value");
    await expect(value).toHaveCount(1);
    const colors = await value.evaluate((el) => {
      const computed = getComputedStyle(el).color;
      const inline = el.getAttribute("style") ?? "";
      return { computed, inline };
    });
    expect(colors.inline).toMatch(/--bsc-value-color:\s*rgb\(/);
    expect(colors.computed).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
    // The four-stop ramp's RGBs are bounded; every stop has at least
    // one channel > 60 (red >= 220, orange >= 234, yellow has G >=
    // 204, green has G >= 163). The kiosk's default text colour on
    // the dark theme is a high-luminance grey (>= 200 across all
    // three channels) -- assert at least one channel is BELOW 200
    // to confirm the ramp is in effect rather than the default.
    const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(colors.computed);
    expect(m).not.toBeNull();
    const [r, g, b] = [Number(m![1]), Number(m![2]), Number(m![3])];
    expect(Math.min(r, g, b)).toBeLessThan(200);
  },
);

Then(
  "the child tile {string} shows the off-track warning glyph",
  async ({ page }, nodeId: string) => {
    // SPEC §17.40 amendment + §17.44 -- the warning fires when the
    // BSC's recorded trajectory (least-squares fit) extrapolated to
    // the target date predicts a value short of the target. §17.44
    // moves the glyph from the tile's bottom-left into the target
    // row, after the target date, tinted on a yellow → orange → red
    // ramp keyed to the deviation magnitude. The step asserts the
    // glyph (a) lives inside the .target-row (not absolutely
    // positioned at bottom-left); and (b) carries an inline
    // `color: rgb(...)` from the §17.44 ramp.
    const kiosk = new TreeGraphPage(page);
    const tile = kiosk.childById(nodeId);
    await expect(tile).toHaveCount(1);
    const row = tile.getByTestId("target-row");
    await expect(row).toHaveCount(1);
    const warn = row.getByTestId("off-track-warning");
    await expect(warn).toHaveCount(1);
    const inline = (await warn.getAttribute("style")) ?? "";
    expect(inline).toMatch(/\bcolor:\s*rgb\(\d+,\s*\d+,\s*\d+\)/);
  },
);

Then(
  "the child tile {string} does not show the off-track warning glyph",
  async ({ page }, nodeId: string) => {
    const kiosk = new TreeGraphPage(page);
    const tile = kiosk.childById(nodeId);
    await expect(tile).toHaveCount(1);
    await expect(tile.getByTestId("off-track-warning")).toHaveCount(0);
  },
);

Then(
  "the focused parent strip shows the off-track warning glyph",
  async ({ page }) => {
    // §17.44 -- on the focused-panel strip the warning glyph also
    // lives inside the parent's .target-row (not at the strip's
    // bottom-left), tinted by the same deviation-keyed ramp.
    const kiosk = new TreeGraphPage(page);
    const row = kiosk.parentStrip().getByTestId("target-row");
    await expect(row).toHaveCount(1);
    const warn = row.getByTestId("off-track-warning");
    await expect(warn).toHaveCount(1);
    const inline = (await warn.getAttribute("style")) ?? "";
    expect(inline).toMatch(/\bcolor:\s*rgb\(\d+,\s*\d+,\s*\d+\)/);
  },
);

// -- SPEC §17.41 -- BSC trend arrow at the right of the value -------------

// -- SPEC §17.52 -- child-tile inline weight edit ------------------------

Then(
  "the child tile {string} shows a weight-edit corner button",
  async ({ page }, nodeId: string) => {
    // SPEC §17.52 -- every node tile carries a corner icon in the
    // bottom-left for inline weight editing. Mirror of the §17.18
    // bottom-right timestamp position. The button is the discoverable
    // path; long-press is the hidden gesture.
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.weightEditButtonForChild(nodeId)).toHaveCount(1);
  },
);

When(
  "I tap the weight-edit corner button on child tile {string}",
  async ({ page }, nodeId: string) => {
    // SPEC §17.52 -- the icon is one of the two triggers for the
    // popover (the other being a 500 ms long-press anywhere on the
    // tile body). The icon's `@click` handler stops propagation so
    // the tap does NOT also drill into the tile.
    const kiosk = new TreeGraphPage(page);
    await kiosk.weightEditButtonForChild(nodeId).click();
  },
);

Then(
  "the weight-edit popover is open",
  async ({ page }) => {
    const kiosk = new TreeGraphPage(page);
    await expect.poll(() => kiosk.isWeightEditPopoverOpen()).toBe(true);
    await expect(kiosk.weightEditPopoverPanel()).toHaveCount(1);
  },
);

Then(
  "the weight-edit popover is closed",
  async ({ page }) => {
    const kiosk = new TreeGraphPage(page);
    await expect.poll(() => kiosk.isWeightEditPopoverOpen()).toBe(false);
  },
);

Then(
  "the weight-edit slider value is {string}",
  async ({ page }, expected: string) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.weightEditSlider()).toHaveValue(expected);
  },
);

Then(
  "the weight-edit live label shows {string}",
  async ({ page }, expected: string) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.weightEditLabel()).toHaveText(expected);
  },
);

When(
  "I drag the weight-edit slider to {string}",
  async ({ page }, value: string) => {
    // SPEC §17.52 -- simulate a drag mid-gesture: dispatch the
    // native `input` event WITHOUT a `change`. The popover updates
    // its live label but does NOT yet dispatch
    // `inline-edit-weight`. The §17.52 commit-on-release contract
    // is what we're pinning here: live label first, persisted
    // commit only on release.
    const kiosk = new TreeGraphPage(page);
    await kiosk.weightEditSlider().evaluate((el, v) => {
      const input = el as HTMLInputElement;
      input.value = String(v);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  },
);

When(
  "I release the weight-edit slider at {string}",
  async ({ page }, value: string) => {
    // SPEC §17.52 -- simulate the operator releasing the slider:
    // dispatch both `input` (final live update) and `change` (the
    // §17.52 commit seam). The popover dispatches
    // `inline-edit-weight`, the composition root applies
    // `editFields(node, { kind, weight })`, and the tree refreshes.
    const kiosk = new TreeGraphPage(page);
    await kiosk.weightEditSlider().evaluate((el, v) => {
      const input = el as HTMLInputElement;
      input.value = String(v);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  },
);

When(
  "I press Escape to dismiss the weight-edit popover",
  async ({ page }) => {
    // SPEC §17.52 -- Escape on the document-level keydown listener
    // closes the popover without commit (no `inline-edit-weight`
    // dispatch -> no service call).
    await page.keyboard.press("Escape");
  },
);

When(
  "I tap outside the weight-edit popover",
  async ({ page }) => {
    // SPEC §17.52 -- pointerdown OUTSIDE the popover (the screen-
    // level capture handler walks the composedPath looking for
    // the popover) closes without commit. Tap the top-bar (well
    // away from any tile or the popover panel itself).
    const kiosk = new TreeGraphPage(page);
    await kiosk.topBar().click();
  },
);

Then(
  "the child tile {string} carries data-weight {string}",
  async ({ page }, nodeId: string, expectedWeight: string) => {
    // SPEC §17.52 -- the tile wrapper publishes the live weight
    // as a `data-weight` attribute. After a successful commit the
    // children-grid re-renders with the new weight on every tile,
    // and the assertion below pins the exact post-commit value
    // without depending on rendered-pixel area math (which is
    // sensitive to viewport size + squarify ordering quirks).
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.childById(nodeId)).toHaveAttribute(
      "data-weight",
      expectedWeight,
    );
  },
);

Then(
  "the child tile {string} bounding-box area exceeds the child tile {string} bounding-box area",
  async ({ page }, idA: string, idB: string) => {
    // SPEC §17.52 -- redundant but useful sanity: the visible
    // tile sizes are also rebalanced after a commit. We pin a
    // strict inequality (NOT a ratio) because squarify rounds
    // sub-pixels into the smallest tile in a row, so a 5 vs 1
    // ratio doesn't always render as exactly 5x area.
    const kiosk = new TreeGraphPage(page);
    const aBox = await kiosk.childById(idA).boundingBox();
    const bBox = await kiosk.childById(idB).boundingBox();
    if (!aBox || !bBox) throw new Error("missing bounding box");
    expect(aBox.width * aBox.height).toBeGreaterThan(bBox.width * bBox.height);
  },
);

When(
  "I long-press on child tile {string}",
  async ({ page }, nodeId: string) => {
    // SPEC §17.52 -- the second trigger for the popover. The
    // children-grid arms a 500 ms timer on `pointerdown` over the
    // tile wrapper; on fire the timer dispatches
    // `weight-edit-open`. Simulate the gesture by dispatching
    // `pointerdown` over the tile, then waiting 600 ms (50 ms
    // buffer past the threshold), then `pointerup`. We resolve
    // the wrapper's center via boundingBox() so the synthesised
    // pointerId-1 events land on the correct element.
    const kiosk = new TreeGraphPage(page);
    const tile = kiosk.childById(nodeId);
    await tile.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      el.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          composed: true,
          pointerId: 1,
          clientX: cx,
          clientY: cy,
        }),
      );
    });
    await page.waitForTimeout(600);
    await tile.evaluate((el) => {
      el.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          composed: true,
          pointerId: 1,
        }),
      );
    });
  },
);

Then(
  "the child tile {string} shows a trend arrow with direction {string}",
  async ({ page }, nodeId: string, expectedDirection: string) => {
    // SPEC §17.41 — every recordedValue BSC with a defined regression
    // (≥ 2 distinct-timestamp historized entries) renders a small
    // arrow at the right of its value. The mapper bakes the bucket
    // into `data-direction` so the e2e step can assert which of the
    // 5 buckets (`up | up-right | right | down-right | down`) the
    // mapper landed on without parsing the rendered Unicode glyph.
    //
    // The §17.41 colour policy — monochrome `currentColor`, no
    // gradient tint — is asserted via the absence of any inline
    // colour-related style on the arrow span (mirrors the §17.40
    // amendment's check on the warning glyph).
    const kiosk = new TreeGraphPage(page);
    const tile = kiosk.childById(nodeId);
    await expect(tile).toHaveCount(1);
    const arrow = tile.getByTestId("trend-arrow");
    await expect(arrow).toHaveCount(1);
    expect(await arrow.getAttribute("data-direction")).toBe(expectedDirection);
    const inline = (await arrow.getAttribute("style")) ?? "";
    expect(inline).not.toMatch(/(?<!-)color:/);
    expect(inline).not.toMatch(/--bsc-value-color/);
  },
);
