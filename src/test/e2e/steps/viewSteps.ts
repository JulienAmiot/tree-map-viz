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
