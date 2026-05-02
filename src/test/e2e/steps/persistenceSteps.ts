/**
 * Step definitions for the Phase 10 persistence features
 * (SPEC §12.3 + §17.33):
 *  - `persistence/import_export.feature` (this file)
 *  - `persistence/board_collection.feature` (lands in §17.34)
 *  - `persistence/load_save.feature` (lands in §17.35)
 *
 * Loose coupling rules (SPEC §13.3 + `eslint.config.js`):
 *  - never imports from `src/{domain,application,adapters}/**` or `main`;
 *  - the only contract with the app is the served URL, the DOM, and the
 *    `?test=1`-gated `window.__appTestApi__` bridge.
 *
 * The Import / Export wiring goes through native browser primitives
 * the kiosk owns (a transient `<a download>` for export; a transient
 * `<input type="file">` for import). Playwright's first-class
 * `download` and `filechooser` events make those testable without
 * extending the test bridge — fixture content goes straight into
 * `filechooser.setFiles({ buffer, ... })` and a downloaded file's
 * bytes come back via `download.path()` + `readFile`.
 */

import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBdd } from "playwright-bdd";

import { TreeGraphPage } from "../pageObjects/TreeGraphPage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures", "trees");

/**
 * Per-scenario alert capture. The `Given I capture window.alert messages`
 * step registers a handler; subsequent `Then` steps read from the
 * collected list. Keyed by `page` so concurrent scenarios don't bleed
 * into each other's state.
 */
const alertsByPage = new WeakMap<Page, string[]>();

/**
 * Read a fixture's raw JSON (string). Re-read on every call rather than
 * caching because the import steps need fresh bytes anyway (and the
 * file count is tiny).
 */
function loadFixtureText(name: string): string {
  const p = path.join(FIXTURES_DIR, `${name}.json`);
  return readFileSync(p, "utf8");
}

const { Given, When, Then } = createBdd();

// -- Export (download capture) ------------------------------------------

When(
  'I trigger a download via the burger menu item with action {string}',
  async ({ page }, action: string) => {
    // SPEC §17.33 — the export action triggers a transient `<a download>`
    // click in the composition root. Playwright's `download` event fires
    // when the browser starts the download; we race the burger click
    // against the event so the assertion can read the saved bytes.
    const kiosk = new TreeGraphPage(page);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      kiosk.burgerMenuItemByAction(action).click(),
    ]);
    const filePath = await download.path();
    expect(filePath).not.toBeNull();
    const bytes = readFileSync(filePath, "utf8");
    // Stash the parsed JSON on the page object so subsequent Then steps
    // can read it without re-triggering the download.
    (
      page as Page & { __lastDownloadJson__?: unknown }
    ).__lastDownloadJson__ = JSON.parse(bytes) as unknown;
  },
);

Then(
  'the downloaded JSON has root id {string}',
  async ({ page }, expected: string) => {
    const last = (
      page as Page & { __lastDownloadJson__?: { id?: string } }
    ).__lastDownloadJson__;
    expect(last).not.toBeUndefined();
    expect(last?.id).toBe(expected);
  },
);

Then(
  'the downloaded JSON has root title {string}',
  async ({ page }, expected: string) => {
    const last = (
      page as Page & { __lastDownloadJson__?: { title?: string } }
    ).__lastDownloadJson__;
    expect(last).not.toBeUndefined();
    expect(last?.title).toBe(expected);
  },
);

// -- Import (file picker injection) ------------------------------------

When(
  'I import the {string} fixture via the burger menu',
  async ({ page }, fixtureName: string) => {
    // SPEC §17.33 — the composition root spawns a transient
    // `<input type="file">` and clicks it. Playwright catches the
    // resulting `filechooser` event and injects a fixture buffer
    // straight into the input's `.files` collection — exactly what
    // the runtime would see if the operator had picked the file
    // through the native dialog.
    const text = loadFixtureText(fixtureName);
    const kiosk = new TreeGraphPage(page);
    const beforeHash = await page.evaluate(() => window.location.hash);
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      kiosk.burgerMenuItemByAction("import").click(),
    ]);
    await chooser.setFiles({
      name: `${fixtureName}.json`,
      mimeType: "application/json",
      buffer: Buffer.from(text, "utf8"),
    });
    // The composition root's runImport runs the codec → service →
    // nav.replaceTree → router.replace pipeline asynchronously after
    // the change handler fires. Wait for the URL hash to flip (the
    // signal that `router.replace` has run) before yielding control
    // back to the next Then step; otherwise the assertion races the
    // pipeline and reads the pre-import focus.
    await page.waitForFunction(
      (prev) => window.location.hash !== prev,
      beforeHash,
      { timeout: 5000 },
    );
  },
);

When(
  'I import the literal {string} via the burger menu',
  async ({ page }, literal: string) => {
    // SPEC §17.33 — drive the import with a deliberately-malformed
    // payload so the codec rejects it; the alert path is exercised
    // and the in-memory tree stays put.
    const kiosk = new TreeGraphPage(page);
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      kiosk.burgerMenuItemByAction("import").click(),
    ]);
    await chooser.setFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from(literal, "utf8"),
    });
  },
);

// -- window.alert capture ----------------------------------------------

Given("I capture window.alert messages", async ({ page }) => {
  // SPEC §17.33 — import errors surface via `window.alert`. Playwright
  // surfaces those as `dialog` events; we collect each message into a
  // page-scoped array and accept (`d.dismiss()`) so the kiosk
  // continues running. The handler is registered once per scenario;
  // re-registering would stack handlers and trip Playwright's
  // "blocking dialogs" runtime check.
  const messages: string[] = [];
  alertsByPage.set(page, messages);
  page.on("dialog", (d) => {
    messages.push(d.message());
    void d.dismiss();
  });
});

Then(
  "a window.alert was shown matching {string}",
  async ({ page }, pattern: string) => {
    // The pattern is a stringified `/.../flags` literal so feature
    // authors can write case-insensitive matches inline.
    const m = /^\/(.+)\/([a-z]*)$/.exec(pattern);
    if (!m) {
      throw new Error(
        `expected pattern of the form /regex/flags, got ${pattern}`,
      );
    }
    const re = new RegExp(m[1]!, m[2]!);
    // Poll because the dialog event may fire a tick after the user
    // gesture. Default timeout matches Playwright's `expect.poll`
    // baseline (5 s).
    await expect
      .poll(() => {
        const list = alertsByPage.get(page) ?? [];
        return list.find((s) => re.test(s)) ?? "";
      })
      .not.toBe("");
  },
);

// -- Boards-panel modal (§17.34) ---------------------------------------

Then("the boards-panel modal is open", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  expect(await kiosk.isBoardsPanelModalOpen()).toBe(true);
  await expect(kiosk.boardsPanelModalPanel()).toBeVisible();
});

Then("the boards-panel modal is closed", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  expect(await kiosk.isBoardsPanelModalOpen()).toBe(false);
});

Then(
  "the boards-panel lists {int} board(s)",
  async ({ page }, n: number) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.boardsPanelRows()).toHaveCount(n);
  },
);

Then(
  "the boards-panel has a board named {string} marked as current",
  async ({ page }, name: string) => {
    const kiosk = new TreeGraphPage(page);
    const rows = kiosk.boardsPanelRows();
    // Find the row whose name matches; assert its `data-current` is "true".
    const row = rows.filter({ hasText: name }).first();
    await expect(row).toHaveAttribute("data-current", "true");
    await expect(row.getByTestId("row-current-badge")).toBeVisible();
  },
);

Then(
  "the boards-panel has a board named {string} not marked as current",
  async ({ page }, name: string) => {
    const kiosk = new TreeGraphPage(page);
    const row = kiosk.boardsPanelRows().filter({ hasText: name }).first();
    await expect(row).toHaveAttribute("data-current", "false");
    // Non-current rows expose a Switch button.
    await expect(row.getByTestId("row-switch")).toBeVisible();
  },
);

When(
  "I tap the boards-panel switch button for {string}",
  async ({ page }, name: string) => {
    // Find the row by user-visible name, then click its Switch button.
    const kiosk = new TreeGraphPage(page);
    const row = kiosk.boardsPanelRows().filter({ hasText: name }).first();
    // The composition root's switch handler runs `nav.replaceTree` +
    // `router.replace` + `refresh` synchronously, then closes the
    // modal. Wait for the modal to disappear so the next Then step
    // sees the refreshed view.
    const beforeHash = await page.evaluate(() => window.location.hash);
    await row.getByTestId("row-switch").click();
    await page.waitForFunction(
      (prev) => window.location.hash !== prev,
      beforeHash,
      { timeout: 5000 },
    );
  },
);

When(
  "I type {string} into the new-board name field",
  async ({ page }, name: string) => {
    const kiosk = new TreeGraphPage(page);
    await kiosk.boardsPanelNewNameField().fill(name);
  },
);

When("I tap the boards-panel Create button", async ({ page }) => {
  // Same wait-for-hash pattern as switch — `createBoard` flips the
  // current id to the freshly-minted board, the composition root
  // re-seats nav + replaces the URL, then closes the modal.
  const kiosk = new TreeGraphPage(page);
  const beforeHash = await page.evaluate(() => window.location.hash);
  await kiosk.boardsPanelCreateBtn().click();
  await page.waitForFunction(
    (prev) => window.location.hash !== prev,
    beforeHash,
    { timeout: 5000 },
  );
});

When("I cancel the boards-panel modal", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.boardsPanelCancelBtn().click();
});

Then("the boards-panel Create button is disabled", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.boardsPanelCreateBtn()).toBeDisabled();
});

Then(
  "the boards-panel Create button is enabled",
  async ({ page }) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.boardsPanelCreateBtn()).toBeEnabled();
  },
);
