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
  "the focused value-date is in the top-right corner of the tile",
  async ({ page }) => {
    // The "tile" host is the per-kind element that the parent-identity
    // strip mounts inside its `<node-view>` slot. Both BSC and Text
    // variants expose `data-view-kind` on their `[data-testid="title"]`,
    // so we walk up from the title to find the host element.
    const kiosk = new TreeGraphPage(page);
    const ts = kiosk.parentStrip().getByTestId("value-date");
    const title = kiosk.parentStrip().getByTestId("title");
    await expect(ts).toHaveCount(1);
    await expect(title).toHaveCount(1);
    const tsBox = await ts.boundingBox();
    // Use the title's bounding box as the "tile" reference: the title
    // spans the full width of the per-kind element and sits at the very
    // top, so its `right` edge is the tile's right edge and its `top`
    // is the tile's top. That's a reliable proxy without piercing
    // shadow DOM ourselves.
    const titleBox = await title.boundingBox();
    expect(tsBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    // Right of horizontal midpoint:
    const titleMidX = titleBox!.x + titleBox!.width / 2;
    expect(tsBox!.x).toBeGreaterThan(titleMidX);
    // Vertically inside the title row (top of tile, ±a small slack for
    // the timestamp's own height extending below the title baseline):
    expect(tsBox!.y).toBeLessThan(titleBox!.y + titleBox!.height);
    // Hugs the right edge of the tile (within a sensible inset):
    const distFromRight = titleBox!.x + titleBox!.width - (tsBox!.x + tsBox!.width);
    expect(distFromRight).toBeLessThan(64);
  },
);
