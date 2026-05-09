/**
 * Step definitions for the Phase 7 layout features (SPEC §12.3 + §17):
 * `layout/treemap_n_plus_one.feature`,
 * `layout/treemap_min_tile_clamp.feature`,
 * `layout/orientation_reflow.feature`.
 *
 * Loose coupling rules from SPEC §13.3 + `eslint.config.js`:
 *  - never imports from `src/{domain,application,adapters}/**` or `main`;
 *  - the only contract with the app is the served URL, the DOM, and the
 *    `?test=1`-gated `window.__appTestApi__` bridge.
 *
 * These steps reuse the Background pattern from viewSteps (kiosk open +
 * fixture seed + reload + optional focus), so the tile-counting and
 * area-bound assertions stay focused on layout geometry.
 */

import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

import { TreeMapPage } from "../pageObjects/TreeMapPage.js";

const { When, Then } = createBdd();

/** 4 px squarify padding inside `<children-grid>` (matches `TILE_PADDING_PX`). */
const TILE_PADDING_PX = 4;

When(
  "I resize the viewport to {int}x{int}",
  async ({ page }, width: number, height: number) => {
    await page.setViewportSize({ width, height });
  },
);

Then(
  "the layout orientation is {string}",
  async ({ page }, expected: string) => {
    const kiosk = new TreeMapPage(page);
    await expect(kiosk.layout()).toHaveAttribute("data-orientation", expected);
  },
);

Then("the parent strip is above the children grid", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  const stripBox = await kiosk.parentStripHost().boundingBox();
  const gridBox = await kiosk.childrenGridHost().boundingBox();
  if (!stripBox || !gridBox) {
    throw new Error(
      "expected parent-identity-strip + children-grid to both have bounding boxes",
    );
  }
  // §4 / option c1 (carried by portrait only post-§17.46): strip stays
  // at the top in portrait. The landscape variant is covered by the
  // separate "to the left of the children grid" step below.
  expect(stripBox.y + stripBox.height).toBeLessThanOrEqual(gridBox.y + 0.5);
});

Then(
  "the parent strip is to the left of the children grid",
  async ({ page }) => {
    // SPEC §17.46 -- in landscape the parent strip docks to the LEFT 25 %
    // rail (was: top-22 % band pre-§17.46). The §4 + option c1 invariant
    // is amended: strip-on-top is preserved in portrait; landscape gains
    // strip-on-left so the rail can hold the §17.45 metric / description
    // vertical split.
    const kiosk = new TreeMapPage(page);
    const stripBox = await kiosk.parentStripHost().boundingBox();
    const gridBox = await kiosk.childrenGridHost().boundingBox();
    if (!stripBox || !gridBox) {
      throw new Error(
        "expected parent-identity-strip + children-grid to both have bounding boxes",
      );
    }
    expect(stripBox.x + stripBox.width).toBeLessThanOrEqual(gridBox.x + 0.5);
  },
);

Then(
  "every tile area is at least one twelfth of the inner children grid area",
  async ({ page }) => {
    const kiosk = new TreeMapPage(page);
    const gridBox = await kiosk.childrenGridHost().boundingBox();
    if (!gridBox) throw new Error("children-grid has no bounding box");
    const innerArea =
      Math.max(0, gridBox.width - 2 * TILE_PADDING_PX) *
      Math.max(0, gridBox.height - 2 * TILE_PADDING_PX);
    // 5 % slack: the floor is on weights, not on rendered pixels — squarify
    // can absorb sub-pixel rounding into the smallest tile in a row.
    const threshold = (innerArea / 12) * 0.95;

    const childTiles = await kiosk.childTiles().all();
    const plusHosts = await kiosk.plusTileHosts().all();
    const all = [...childTiles, ...plusHosts];
    expect(all.length).toBeGreaterThan(0);
    for (const tile of all) {
      const box = await tile.boundingBox();
      if (!box) throw new Error("tile has no bounding box");
      expect(box.width * box.height).toBeGreaterThanOrEqual(threshold);
    }
  },
);

Then(
  "the sum of tile areas covers the inner children grid area within {int}%",
  async ({ page }, tolerancePercent: number) => {
    const kiosk = new TreeMapPage(page);
    const gridBox = await kiosk.childrenGridHost().boundingBox();
    if (!gridBox) throw new Error("children-grid has no bounding box");
    const innerArea =
      Math.max(0, gridBox.width - 2 * TILE_PADDING_PX) *
      Math.max(0, gridBox.height - 2 * TILE_PADDING_PX);

    const childTiles = await kiosk.childTiles().all();
    const plusHosts = await kiosk.plusTileHosts().all();
    const all = [...childTiles, ...plusHosts];
    let sum = 0;
    for (const tile of all) {
      const box = await tile.boundingBox();
      if (!box) throw new Error("tile has no bounding box");
      sum += box.width * box.height;
    }
    const tolerance = innerArea * (tolerancePercent / 100);
    expect(Math.abs(sum - innerArea)).toBeLessThanOrEqual(tolerance);
  },
);
