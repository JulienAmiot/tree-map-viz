/**
 * Step definitions for the Phase 7 shell-chrome features
 * (SPEC §12.3 + §17.11):
 *  - `shell/drawer.feature`
 *  - `shell/breadcrumb.feature`
 *  - `shell/burger_menu.feature`
 *
 * Loose coupling rules (SPEC §13.3 + `eslint.config.js`):
 *  - never imports from `src/{domain,application,adapters}/**` or `main`;
 *  - the only contract with the app is the served URL, the DOM, and the
 *    `?test=1`-gated `window.__appTestApi__` bridge.
 *
 * Reuses the boot/view step background (kiosk open + optional fixture
 * seed + reload + optional focus). The drawer is auto-hidden by default,
 * so every interactive shell scenario opens it via the handle first;
 * shell content (board name, breadcrumb, burger trigger) lives behind
 * `max-height: 0` while closed and is not clickable until revealed.
 */

import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

import { TreeGraphPage } from "../pageObjects/TreeGraphPage.js";

const { When, Then } = createBdd();

// -- Drawer --------------------------------------------------------------

When("I tap the drawer handle", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.drawerHandle().click();
});

Then("the drawer is open", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  expect(await kiosk.isDrawerOpen()).toBe(true);
  await expect(kiosk.drawerHandle()).toHaveAttribute("aria-expanded", "true");
});

Then("the drawer is closed", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  expect(await kiosk.isDrawerOpen()).toBe(false);
  await expect(kiosk.drawerHandle()).toHaveAttribute("aria-expanded", "false");
});

Then(
  "the drawer panel contains the board name {string}",
  async ({ page }, expected: string) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.boardNameLabel()).toHaveText(expected);
  },
);

Then("the drawer panel contains the focus breadcrumb", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.breadcrumbHost()).toHaveCount(1);
});

Then("the drawer panel contains the burger trigger", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.burgerTrigger()).toHaveCount(1);
});

// -- Breadcrumb ----------------------------------------------------------

When(
  "I tap the breadcrumb segment for {string}",
  async ({ page }, nodeId: string) => {
    const kiosk = new TreeGraphPage(page);
    await kiosk.breadcrumbSegmentByNodeId(nodeId).click();
  },
);

Then("the breadcrumb has {int} segment(s)", async ({ page }, n: number) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.breadcrumbSegments()).toHaveCount(n);
});

Then(
  "breadcrumb segment {int} shows {string}",
  async ({ page }, position: number, expected: string) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.breadcrumbSegments().nth(position - 1)).toHaveText(
      expected,
    );
  },
);

Then("the last breadcrumb segment is the current page", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  const last = kiosk.breadcrumbSegments().last();
  await expect(last).toHaveAttribute("aria-current", "page");
  // The current segment is rendered as a non-button <span>; ancestors are
  // <button>. Asserting the tag name is the cheapest contract we can keep.
  const tag = await last.evaluate((el) => el.tagName.toUpperCase());
  expect(tag).toBe("SPAN");
});

// -- Burger menu ---------------------------------------------------------

When("I tap the burger trigger", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.burgerTrigger().click();
});

When("I tap the board name", async ({ page }) => {
  // The board name lives inside the drawer's light DOM but outside the
  // burger host; the perfect "outside the burger but inside the drawer"
  // probe so we can verify burger-close + drawer-stay-open in one tap.
  const kiosk = new TreeGraphPage(page);
  await kiosk.boardNameLabel().click();
});

Then("the burger menu is open", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  expect(await kiosk.isBurgerMenuOpen()).toBe(true);
  await expect(kiosk.burgerTrigger()).toHaveAttribute("aria-expanded", "true");
});

Then("the burger menu is closed", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  expect(await kiosk.isBurgerMenuOpen()).toBe(false);
  await expect(kiosk.burgerTrigger()).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

Then(
  "the burger menu has an item with action {string}",
  async ({ page }, action: string) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.burgerMenuItemByAction(action)).toHaveCount(1);
  },
);

Then("the burger menu has {int} items", async ({ page }, n: number) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.burgerMenuItems()).toHaveCount(n);
});

// -- Close-to-parent X (§17.23) -----------------------------------------

When("I tap the close-to-parent button", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.closeToParentButton().click();
});

Then("the close-to-parent button is visible", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.closeToParentButton()).toBeVisible();
});

Then("the close-to-parent button is not rendered", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.closeToParentButton()).toHaveCount(0);
});

Then(
  "the close-to-parent button targets node {string}",
  async ({ page }, expected: string) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.closeToParentButton()).toHaveAttribute(
      "data-parent-id",
      expected,
    );
  },
);

// -- Edit-node pencil + modal (§17.28) -----------------------------------

When("I tap the edit-node pencil", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.editNodeButton().click();
});

Then("the edit-node pencil is visible", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.editNodeButton()).toBeVisible();
});

Then(
  "the edit-node pencil targets node {string}",
  async ({ page }, expected: string) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.editNodeButton()).toHaveAttribute(
      "data-node-id",
      expected,
    );
  },
);

Then("the edit-node modal is open", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  expect(await kiosk.isEditNodeModalOpen()).toBe(true);
  await expect(kiosk.editNodeModalPanel()).toBeVisible();
});

Then("the edit-node modal is closed", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  expect(await kiosk.isEditNodeModalOpen()).toBe(false);
});

Then(
  "the edit-node modal title field shows {string}",
  async ({ page }, expected: string) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.editNodeModalForm().getByTestId("field-title")).toHaveValue(
      expected,
    );
  },
);

When(
  "I set the edit-node modal field {string} to {string}",
  async ({ page }, fieldId: string, value: string) => {
    const kiosk = new TreeGraphPage(page);
    await kiosk.editNodeModalForm().getByTestId(fieldId).fill(value);
  },
);

When("I confirm the edit-node modal", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.editNodeModalConfirm().click();
});

When("I cancel the edit-node modal", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.editNodeModalCancel().click();
});

// -- Burger menu item activation (§17.31 — Settings\u2026 wiring) ------------

When(
  "I tap the burger menu item with action {string}",
  async ({ page }, action: string) => {
    const kiosk = new TreeGraphPage(page);
    await kiosk.burgerMenuItemByAction(action).click();
  },
);

// -- Board-settings modal (§17.31) --------------------------------------

Then("the board-settings modal is open", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  expect(await kiosk.isBoardSettingsModalOpen()).toBe(true);
  await expect(kiosk.boardSettingsModalPanel()).toBeVisible();
});

Then("the board-settings modal is closed", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  expect(await kiosk.isBoardSettingsModalOpen()).toBe(false);
});

Then(
  "the board-settings modal name field shows the current board's name",
  async ({ page }) => {
    const kiosk = new TreeGraphPage(page);
    const drawerName = (await kiosk.boardNameLabel().textContent())?.trim() ?? "";
    await expect(
      kiosk.boardSettingsModalField("field-name"),
    ).toHaveValue(drawerName);
  },
);

When(
  "I set the board-settings modal field {string} to {string}",
  async ({ page }, fieldId: string, value: string) => {
    const kiosk = new TreeGraphPage(page);
    await kiosk.boardSettingsModalField(fieldId).fill(value);
  },
);

When("I confirm the board-settings modal", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.boardSettingsModalConfirm().click();
});

When("I cancel the board-settings modal", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.boardSettingsModalCancel().click();
});

Then("the drawer board name is {string}", async ({ page }, expected: string) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.boardNameLabel()).toHaveText(expected);
});

Then(
  "the drawer board name is unchanged from the seed default",
  async ({ page }) => {
    // §17.31 — the empty-storage seed plants the showcase board
    // (`SHOWCASE_BOARD_NAME`). Cancelling the settings modal must
    // not have touched it.
    const kiosk = new TreeGraphPage(page);
    const text = (await kiosk.boardNameLabel().textContent())?.trim() ?? "";
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toBe("Should be discarded");
  },
);

Then("the board-settings delete button is disabled", async ({ page }) => {
  // §17.31 — the empty-storage seed plants exactly one board (the
  // showcase). The delete button is disabled because deleting the
  // sole board would violate the `getCurrentBoard` invariant.
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.boardSettingsModalDeleteBtn()).toBeDisabled();
});

Then(
  "the board-settings inline delete confirm prompt is not visible",
  async ({ page }) => {
    await expect(page.getByTestId("delete-confirm-prompt")).toHaveCount(0);
  },
);

Then(
  "the focused-panel title colour is {string}",
  async ({ page }, expected: string) => {
    // SPEC §17.31 — verifying the rendered colour requires the
    // browser's computed style (the rule resolves
    // `var(--board-fresh, currentColor)` against the cascaded
    // custom property installed on `<tree-graph-screen>`'s host).
    // The focused panel's `[data-testid="title"]` is reachable
    // through the open shadow trees via Playwright's testid
    // locator. We pierce the shadow tree by scoping to
    // `parent-identity-strip` first.
    const title = page
      .locator("parent-identity-strip")
      .getByTestId("title")
      .first();
    await expect(title).toHaveCSS("color", expected);
  },
);

// -- Inline title / value edit (§17.28) ---------------------------------

When("I tap the focused title", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.focusedTitle().click();
});

When("I tap the focused value", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.focusedValue().click();
});

When(
  "I type {string} in the focused title editor and press Enter",
  async ({ page }, value: string) => {
    const kiosk = new TreeGraphPage(page);
    const editor = kiosk.focusedTitleEditor();
    await editor.fill(value);
    await editor.press("Enter");
  },
);

When(
  "I type {string} in the focused value editor and commit",
  async ({ page }, value: string) => {
    // Multi-line editors commit on Ctrl+Enter; single-line on Enter.
    // Probe the editor's tag to decide which key combo to send: a plain
    // Enter on a textarea would insert a newline (and only Ctrl+Enter
    // would commit), while a plain Enter on a number input commits the
    // BSC inline value edit. Probing the tag avoids the "press Enter,
    // see if it stuck" pattern that pollutes the textarea with stray
    // newlines before Ctrl+Enter arrives.
    const kiosk = new TreeGraphPage(page);
    const editor = kiosk.focusedValueEditor();
    await editor.fill(value);
    const tagName = await editor.evaluate((el) => el.tagName);
    if (tagName === "TEXTAREA") {
      await editor.press("Control+Enter");
    } else {
      await editor.press("Enter");
    }
  },
);
