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

import { expect } from "@playwright/test";
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
