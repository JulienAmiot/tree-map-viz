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

  /**
   * Read the focused node's title — the `data-testid="title"` element rendered
   * by the `asParent` view inside the parent identity strip.
   *
   * The chain pierces three shadow roots (`tree-graph-screen` → `node-view` →
   * per-kind element); Playwright's `getByTestId` walks open shadow DOM, so
   * scoping by `parent-strip` first is enough to disambiguate against the
   * `asChild` titles in the children grid.
   */
  focusedTitle(): Locator {
    return this.parentStrip().getByTestId("title");
  }

  /** Description element rendered by the focused (asParent) view. */
  focusedDescription(): Locator {
    return this.parentStrip().getByTestId("description");
  }

  /** Value cell in the focused (asParent) BusinessScoreCard view (also empty for `childrenCount` n=0). */
  focusedValue(): Locator {
    return this.parentStrip().getByTestId("value");
  }

  /** ISO date next to a `recordedValue` in the focused (asParent) view. */
  focusedValueDate(): Locator {
    return this.parentStrip().getByTestId("value-date");
  }

  /** `Σ` badge appended by the focused (asParent) view when value-kind is `computedMean`. */
  focusedComputedBadge(): Locator {
    return this.parentStrip().getByTestId("computed-badge");
  }

  /** Parent identity strip — also exposes `data-focused-id` for "still focused" assertions. */
  parentStrip(): Locator {
    return this.page.getByTestId("parent-strip");
  }

  /**
   * §17.23 close-to-parent affordance — the small "X" button overlaid on
   * the top-right of the focused panel. Only present in the DOM when the
   * focus has a parent (root focus omits it entirely). The button carries
   * `data-parent-id` matching the ancestor it navigates to, so e2e can
   * assert the target without touching the URL.
   */
  closeToParentButton(): Locator {
    return this.page.getByTestId("close-to-parent");
  }

  /**
   * §17.28 edit-node affordance — the pencil button to the LEFT of the
   * close-X. Always present whenever the focused panel renders a vm
   * (root or non-root). Carries `data-node-id` mirroring the focused id.
   */
  editNodeButton(): Locator {
    return this.page.getByTestId("edit-node");
  }

  /** §17.28 edit-node modal host element. */
  editNodeModalHost(): Locator {
    return this.page.locator("edit-node-modal");
  }

  /** §17.28 edit-node modal panel (only in the DOM while open). */
  editNodeModalPanel(): Locator {
    return this.page.getByTestId("edit-node-modal");
  }

  /** §17.28 edit-node modal form. */
  editNodeModalForm(): Locator {
    return this.page.getByTestId("edit-modal-form");
  }

  /** §17.28 Confirm / Cancel buttons on the edit modal. */
  editNodeModalConfirm(): Locator {
    return this.page.getByTestId("edit-modal-confirm");
  }
  editNodeModalCancel(): Locator {
    return this.page.getByTestId("edit-modal-cancel");
  }

  async isEditNodeModalOpen(): Promise<boolean> {
    const v = await this.editNodeModalHost().getAttribute("open");
    return v !== null;
  }

  /**
   * §17.28 inline-edit affordance on the focused panel. Returns the
   * `<input data-testid="title-edit">` (when the title is being edited)
   * or `null` when not. Scoped to the parent strip to avoid colliding
   * with any future child-tile inline editor.
   */
  focusedTitleEditor(): Locator {
    return this.parentStrip().getByTestId("title-edit");
  }

  /**
   * §17.28 inline-edit affordance for the value (text-area for TextNode
   * / number input for BSC recordedValue).
   */
  focusedValueEditor(): Locator {
    return this.parentStrip().getByTestId("value-edit");
  }

  /** All children tiles in the focused-view grid (excludes the `+` slot). */
  childTiles(): Locator {
    return this.page.getByTestId("child");
  }

  /**
   * The child tile bound to the given domain node id (`data-id` on `child-tile`).
   * Use child-scoped getByTestId for nested fields (title/description/value/...).
   */
  childById(id: string): Locator {
    return this.page.locator(`[data-testid="child"][data-id="${id}"]`);
  }

  /** All `<plus-tile>` host elements (custom-element tag — useful for "no descendant testids" assertions). */
  plusTileHosts(): Locator {
    return this.page.locator("plus-tile");
  }

  /** All inner `<button data-testid="plus-tile">` elements — what the user actually clicks. */
  plusTileButtons(): Locator {
    return this.page.getByTestId("plus-tile");
  }

  /**
   * The shell's `data-testid="layout"` wrapper, which carries the
   * orientation flag (`data-orientation="landscape" | "portrait"`) — the
   * e2e seam for `layout/orientation_reflow.feature`.
   */
  layout(): Locator {
    return this.page.getByTestId("layout");
  }

  /** The `<children-grid>` host element (custom-element tag) — used for tile-area math against its bounding box. */
  childrenGridHost(): Locator {
    return this.page.locator("children-grid");
  }

  /** The `<parent-identity-strip>` host element (custom-element tag) — used for above/below geometry assertions. */
  parentStripHost(): Locator {
    return this.page.locator("parent-identity-strip");
  }

  /** Read the layout wrapper's `data-orientation` attribute. */
  async orientation(): Promise<string | null> {
    return this.layout().getAttribute("data-orientation");
  }

  /** The `<app-drawer>` host element. Carries the reflected `open` boolean attribute. */
  drawerHost(): Locator {
    return this.page.getByTestId("drawer");
  }

  /** The `<button data-testid="drawer-handle">` rendered inside `<app-drawer>` shadow root. */
  drawerHandle(): Locator {
    return this.page.getByTestId("drawer-handle");
  }

  /** The board-name `<span>` shown at the leading edge of the drawer body. */
  boardNameLabel(): Locator {
    return this.page.getByTestId("board-name");
  }

  /** The `<focus-breadcrumb>` host element rendered inside the drawer body. */
  breadcrumbHost(): Locator {
    return this.page.locator("focus-breadcrumb");
  }

  /** All breadcrumb segments (ancestors + the focused current segment) in order. */
  breadcrumbSegments(): Locator {
    return this.page.getByTestId("crumb");
  }

  /** The breadcrumb segment whose `data-node-id` matches the given uuid. */
  breadcrumbSegmentByNodeId(nodeId: string): Locator {
    return this.page.locator(
      `[data-testid="crumb"][data-node-id="${nodeId}"]`,
    );
  }

  /** The `<button data-testid="burger-trigger">` rendered inside `<burger-menu>` shadow root. */
  burgerTrigger(): Locator {
    return this.page.getByTestId("burger-trigger");
  }

  /** The `<ul data-testid="burger-menu">` (popup) — `hidden` attribute reflects open state. */
  burgerMenuList(): Locator {
    return this.page.getByTestId("burger-menu");
  }

  /** Burger menu items (rendered always; visible only while open). */
  burgerMenuItems(): Locator {
    return this.page.getByTestId("burger-item");
  }

  /** The burger menu item whose `data-action` matches. */
  burgerMenuItemByAction(action: string): Locator {
    return this.page.locator(
      `[data-testid="burger-item"][data-action="${action}"]`,
    );
  }

  /** Read the drawer host's reflected `open` attribute (presence ↔ open). */
  async isDrawerOpen(): Promise<boolean> {
    const v = await this.drawerHost().getAttribute("open");
    return v !== null;
  }

  /** Read the burger menu list's `hidden` attribute (presence ↔ closed). */
  async isBurgerMenuOpen(): Promise<boolean> {
    const v = await this.burgerMenuList().getAttribute("hidden");
    return v === null;
  }

  /** The `<add-child-modal>` host element. */
  addChildModalHost(): Locator {
    return this.page.locator("add-child-modal");
  }

  /** The modal panel (`role="dialog"`) — only present in the DOM while open. */
  addChildModalPanel(): Locator {
    return this.page.getByTestId("add-child-modal");
  }

  /** Backdrop `<div>` behind the panel. */
  addChildModalBackdrop(): Locator {
    return this.page.getByTestId("modal-backdrop");
  }

  /**
   * SPEC §17.25 — left-rail kind list. Replaces the §17.19 `<select>`
   * dropdown: kinds are now visible buttons in a 20 %-wide column on
   * the left side of the modal panel. `addChildModalKindList()` returns
   * the container; `addChildModalKindButton(kind)` returns a specific
   * picker button.
   */
  addChildModalKindList(): Locator {
    return this.page.getByTestId("kind-list");
  }

  addChildModalKindButton(kind: string): Locator {
    return this.page.locator(
      `[data-testid="kind-btn"][data-kind="${kind}"]`,
    );
  }

  /** All kind buttons (one per available kind). */
  addChildModalKindButtons(): Locator {
    return this.page.getByTestId("kind-btn");
  }

  /** The form (always rendered while open; type-specific fields appear
   *  underneath the dropdown once a kind is chosen). */
  addChildModalForm(): Locator {
    return this.page.getByTestId("modal-form");
  }

  /** Form field by data-testid (`field-title`, `field-unit`, etc.). */
  addChildModalField(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  /** Confirm / Cancel buttons. */
  addChildModalConfirm(): Locator {
    return this.page.getByTestId("modal-confirm");
  }
  addChildModalCancel(): Locator {
    return this.page.getByTestId("modal-cancel");
  }

  /** Read the modal host's reflected `open` attribute. */
  async isAddChildModalOpen(): Promise<boolean> {
    const v = await this.addChildModalHost().getAttribute("open");
    return v !== null;
  }

  /**
   * SPEC §17.29 — the shared close-X button rendered in every
   * modal's top-right corner via `modalFrameStyles.renderModalCloseX`.
   * Same `data-testid` on every modal: at most one modal is open at a
   * time, so the selector is unambiguous. Reaching across the shadow
   * boundaries via `page.getByTestId` works because Lit shadow roots
   * are open-mode (Playwright's testid locator pierces them).
   */
  modalCloseX(): Locator {
    return this.page.getByTestId("modal-close-x");
  }

  /** Read the currently-rendered focused node id from the parent strip's `data-focused-id`. */
  async focusedId(): Promise<string | null> {
    return this.parentStrip().getAttribute("data-focused-id");
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
   * Drive the hash router to focus a specific node — uses the canonical
   * `#/b/<boardId>/n/<focusNodeUuid>` shape so the bridge reads back the
   * same id via `currentFocusUuid()`.
   */
  async focusNode(nodeUuid: string): Promise<void> {
    await this.page.evaluate(async (uuid) => {
      const w = window as BridgedWindow;
      if (!w.__appTestApi__) {
        throw new Error("test bridge not installed; was the page opened with ?test=1?");
      }
      const boardId = w.__appTestApi__.currentBoardId();
      await w.__appTestApi__.navigateTo(`#/b/${boardId}/n/${uuid}`);
    }, nodeUuid);
  }

  /**
   * Force the kiosk to treat the user as preferring reduced motion (SPEC §14.4).
   * Phase 9 — the drill animation's reduced-motion path commits the navigation
   * synchronously, so e2e scenarios don't need to wait for `DRILL_SETTLE_MS`.
   */
  async dismissAnimations(): Promise<void> {
    await this.page.evaluate(() => {
      const w = window as BridgedWindow;
      if (!w.__appTestApi__) {
        throw new Error("test bridge not installed; was the page opened with ?test=1?");
      }
      w.__appTestApi__.dismissAnimations();
    });
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
