/**
 * Step definitions for the boot smoke (`features/boot/app_boots.feature`).
 *
 * Loose coupling rules from SPEC §13.3 + `eslint.config.js`:
 *  - never imports from `src/{domain,application,adapters}/**` or `main`;
 *  - the only contract with the app is the served URL, the DOM, and the
 *    `?test=1`-gated `window.__appTestApi__` bridge.
 *
 * The fixture loaded as `orgTreeJson` is intentionally a *copy* of
 * `examples/test.json` placed under `src/test/e2e/fixtures/trees/orgTree.json`
 * — fixtures are owned by the e2e harness so the kiosk's wire reference
 * (the canonical `examples/test.json`) can change without breaking specs.
 */

import { expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBdd } from "playwright-bdd";

import { TreeGraphPage } from "../pageObjects/TreeGraphPage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORG_TREE_PATH = path.join(__dirname, "..", "fixtures", "trees", "orgTree.json");
const orgTreeJson: unknown = JSON.parse(readFileSync(ORG_TREE_PATH, "utf8"));

const { When, Then } = createBdd();

When("I open the kiosk in test mode with empty storage", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.openWithEmptyStorage();
});

When("I seed the org tree via the test bridge", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.seedTree(orgTreeJson);
});

When("I reload the kiosk", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.reload();
});

Then("the focused title is {string}", async ({ page }, expected: string) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.focusedTitle()).toHaveText(expected);
});
