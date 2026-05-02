/**
 * Step definitions for the §17.35 routing features
 * (SPEC §11.3 + §17.11):
 *  - `routing/deep_link.feature`
 *  - `routing/focus_to_url.feature`
 *  - `routing/unknown_uuid_fallback.feature`
 *
 * Loose coupling rules (SPEC §13.3 + `eslint.config.js`):
 *  - never imports from `src/{domain,application,adapters}/**` or `main`;
 *  - the only contract with the app is the served URL, the DOM, and the
 *    `?test=1`-gated `window.__appTestApi__` bridge.
 *
 * The routing pipeline is wired in three places: bootup (`startRoute`
 * resolution + `router.replace` fallback), focus mutations (drill /
 * breadcrumb / close-to-parent / import / board-switch / board-create
 * all push or replace through `HashRouter`), and `router.onChange`
 * (catches external hash changes — browser back/forward, manual edit,
 * paste). These steps drive each path through the test bridge's
 * `navigateTo` (synchronous-ish hash write + `requestAnimationFrame`
 * resolve) and Playwright's native `page.goBack()` for the browser-
 * navigation path.
 */

import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

import { TreeGraphPage } from "../pageObjects/TreeGraphPage.js";

const { When } = createBdd();

/**
 * Drive the bridge to set the URL hash to the canonical
 * `#/b/<currentBoardId>/n/<nodeUuid>` shape. Same path as the existing
 * `I focus on node` step in `viewSteps.ts`, but with a more explicit
 * verb so the routing scenarios read as URL-driven (not focus-driven).
 */
When(
  "I navigate the kiosk to the focus hash for node {string}",
  async ({ page }, nodeUuid: string) => {
    const kiosk = new TreeGraphPage(page);
    await kiosk.focusNode(nodeUuid);
  },
);

/**
 * Set the URL hash to a literal value (e.g. `#/b/foo/n/does-not-exist`)
 * so the unknown-uuid / wrong-board / malformed-hash branches can be
 * exercised directly. Goes through the test bridge's `navigateTo`,
 * which writes `location.hash` and awaits one `requestAnimationFrame`
 * so the `hashchange` listener has a tick to run before the next step.
 */
When(
  "I navigate the kiosk to the literal hash {string}",
  async ({ page }, hash: string) => {
    await page.evaluate(async (h) => {
      const w = window as Window & {
        __appTestApi__?: { navigateTo(url: string): Promise<void> };
      };
      if (!w.__appTestApi__) {
        throw new Error(
          "test bridge not installed; was the page opened with ?test=1?",
        );
      }
      await w.__appTestApi__.navigateTo(h);
    }, hash);
  },
);

/**
 * Press the browser's Back button. Playwright's `page.goBack()` is the
 * direct primitive; we await its return so the navigation fully settles
 * (Playwright resolves once the next document is ready). The kiosk's
 * `router.onChange` runs on the resulting `hashchange`, so by the time
 * the next Then step asks "what's the focused id?", the post-back
 * refresh has already painted.
 */
When("I press the browser back button", async ({ page }) => {
  await page.goBack();
  // The hashchange listener runs synchronously inside the `popstate`,
  // but the kiosk's `refresh()` schedules a Lit render which lands on
  // the next microtask. Wait for that to flush before yielding.
  await expect
    .poll(async () => {
      const kiosk = new TreeGraphPage(page);
      return await kiosk.focusedId();
    })
    .not.toBeNull();
});
