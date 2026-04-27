/**
 * Page object for the kiosk shell. Wraps Playwright's `Page` so step
 * definitions never reach into selectors directly — adding a `data-testid`
 * is a one-line change here, not across every step file.
 *
 * Cannot import from `src/**` (loose-coupling rule from SPEC §13.3 +
 * `eslint.config.js`); the only contract with the app is the served URL,
 * the DOM, and the `?test=1`-gated `window.__appTestApi__` bridge.
 */

import type { Locator, Page } from "@playwright/test";

/** Path the kiosk is served from in `vite preview` — appended to `baseURL`. */
const KIOSK_PATH = "/";
/** Activation gate for the test bridge (mirrors SPEC §14.4). */
const TEST_FLAG = "test=1";

/** Minimal facade for the bridge surface so steps don't sprinkle `as any`. */
type BridgedWindow = Window & {
  __appTestApi__?: {
    seed(json: unknown): Promise<void>;
    currentFocusUuid(): string;
    currentBoardId(): string;
    navigateTo(url: string): Promise<void>;
    dismissAnimations(): void;
  };
};

export class TreeGraphPage {
  constructor(private readonly page: Page) {}

  /**
   * Navigate to the kiosk with the test-bridge gate active. Each Playwright
   * scenario uses a fresh browser context, so `localStorage` is already
   * empty — no `addInitScript` clear, which would also re-fire on reload
   * and wipe any tree we seed via the bridge.
   */
  async openWithEmptyStorage(): Promise<void> {
    await this.page.goto(`${KIOSK_PATH}?${TEST_FLAG}`);
    await this.expectBridgeReady();
  }

  /** Reload the current page, preserving the URL (and thus the `?test=1` gate). */
  async reload(): Promise<void> {
    await this.page.reload();
    await this.expectBridgeReady();
  }

  /** Read the focused node's title (the H1 inside `<tree-graph-screen>`). */
  focusedTitle(): Locator {
    return this.page.getByTestId("focused-title");
  }

  /** Seed a tree via the test bridge. The page must be reloaded for the new state to render. */
  async seedTree(treeJson: unknown): Promise<void> {
    await this.page.evaluate(async (json) => {
      const w = window as BridgedWindow;
      if (!w.__appTestApi__) {
        throw new Error("test bridge not installed; was the page opened with ?test=1?");
      }
      await w.__appTestApi__.seed(json);
    }, treeJson);
  }

  /**
   * Wait for the bridge to be installed. The bridge is dynamically imported,
   * so on slow first hits it may not be on `window` synchronously after `goto`.
   */
  private async expectBridgeReady(): Promise<void> {
    await this.page.waitForFunction(() => {
      const w = window as BridgedWindow;
      return typeof w.__appTestApi__ !== "undefined";
    });
  }
}
