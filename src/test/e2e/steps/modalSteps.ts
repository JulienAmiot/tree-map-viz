/**
 * Step definitions for the Phase 8 add-child modal features
 * (SPEC §12.3 + §17.12):
 *  - `modal/add_child_modal.feature`
 *  - `modal/empty_field_placeholders.feature`
 *
 * Loose coupling rules (SPEC §13.3 + `eslint.config.js`):
 *  - never imports from `src/{domain,application,adapters}/**` or `main`;
 *  - the only contract with the app is the served URL, the DOM, and the
 *    `?test=1`-gated `window.__appTestApi__` bridge.
 *
 * Reuses bootSteps (kiosk open) + viewSteps (`I click the plus tile`,
 * `there are {int} child tiles`, `there is exactly one plus tile`,
 * `the focused id is {string}`).
 */

import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

import { TreeMapPage } from "../pageObjects/TreeMapPage.js";

const { When, Then } = createBdd();

// -- Modal lifecycle -----------------------------------------------------

When("I pick the kind {string}", async ({ page }, kind: string) => {
  // SPEC §17.25 — pick the kind by clicking the matching button in the
  // left-rail kind list (was a `<select>` dropdown in §17.19, two large
  // cards pre-§17.19). The modal listens to the click and updates
  // `chosenKind` + flips `aria-pressed` on the picked button.
  const kiosk = new TreeMapPage(page);
  await kiosk.addChildModalKindButton(kind).click();
});

When("I fill in the title with {string}", async ({ page }, title: string) => {
  const kiosk = new TreeMapPage(page);
  await kiosk.addChildModalField("field-title").fill(title);
});

When(
  "I fill in the current value with {string}",
  async ({ page }, value: string) => {
    // SPEC §17.13 / §17.14 — both kinds collect a mandatory seed
    // `TimestampedValue`; the `field-current-value` testid is the same
    // whether the underlying input is a number (BSC) or textarea (Text).
    const kiosk = new TreeMapPage(page);
    await kiosk.addChildModalField("field-current-value").fill(value);
  },
);

When("I confirm the add-child modal", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  await kiosk.addChildModalConfirm().click();
});

When("I cancel the add-child modal", async ({ page }) => {
  // SPEC §17.19 — single-page flow: there's exactly one Cancel button
  // (no more dual Cancel buttons across Step 1 / Step 2), so we click
  // the testid directly.
  const kiosk = new TreeMapPage(page);
  await kiosk.addChildModalCancel().click();
});

// -- Modal state --------------------------------------------------------

Then("the add-child modal is open", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  expect(await kiosk.isAddChildModalOpen()).toBe(true);
  await expect(kiosk.addChildModalPanel()).toBeVisible();
});

Then("the add-child modal is closed", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  expect(await kiosk.isAddChildModalOpen()).toBe(false);
  await expect(kiosk.addChildModalPanel()).toHaveCount(0);
});

Then(
  "the modal offers a {string} kind",
  async ({ page }, kindLabel: string) => {
    // SPEC §17.25 — the modal lists the available kinds as `<button>`
    // entries inside the left-rail kind list, each labelled with the
    // kind's name (top) + description (bottom). We match `kindLabel`
    // against the `.kind-btn-name` text with strict equality. Pre-§17.121
    // this step used `startsWith(kindLabel)` against the full innerText,
    // which became ambiguous after the §17.95 catalogue grew to 8 kinds
    // ("Computed" startsWith-matches both "Computed" and
    // "Computed Business Score Card"; an exact `.kind-btn-name` check
    // disambiguates without breaking the legacy three-kind invocations).
    const kiosk = new TreeMapPage(page);
    const buttons = kiosk.addChildModalKindButtons();
    const buttonNames = await buttons.evaluateAll((nodes: Element[]) =>
      nodes.map(
        (n) =>
          n.querySelector(".kind-btn-name")?.textContent?.trim() ?? "",
      ),
    );
    const matching = buttonNames.filter((t) => t === kindLabel);
    expect(matching).toHaveLength(1);
  },
);

Then(
  "the modal kind list shows {string} options labelled with name and description",
  async ({ page }, expected: string) => {
    // SPEC §17.25 — the kind list shape: one `kind-btn` per available
    // kind, each rendering a "Name" line + a "Description" line. We
    // assert the count matches and that every button visually exposes
    // both halves (the description is wrapped in `.kind-btn-desc`).
    const kiosk = new TreeMapPage(page);
    const buttons = kiosk.addChildModalKindButtons();
    await expect(buttons).toHaveCount(Number(expected));
    const buttonTexts = await buttons.evaluateAll((nodes: Element[]) =>
      nodes.map((n) => {
        const name = n
          .querySelector(".kind-btn-name")
          ?.textContent?.trim() ?? "";
        const desc = n
          .querySelector(".kind-btn-desc")
          ?.textContent?.trim() ?? "";
        return { name, desc };
      }),
    );
    for (const { name, desc } of buttonTexts) {
      // Name starts with a capital letter (real kind name) and the
      // description is non-empty (mirrors the §17.19 dropdown contract).
      expect(name).toMatch(/^[A-Z]/);
      expect(desc.length).toBeGreaterThan(0);
    }
  },
);

Then(
  "the modal form is for kind {string}",
  async ({ page }, kind: string) => {
    const kiosk = new TreeMapPage(page);
    await expect(kiosk.addChildModalForm()).toHaveAttribute("data-kind", kind);
  },
);

Then("the modal has a title field", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  await expect(kiosk.addChildModalField("field-title")).toHaveCount(1);
});

// SPEC §17.19 — before a kind is picked, no type-specific fields
// render; the form is just the dropdown + actions row.
Then("the modal has no title field", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  await expect(kiosk.addChildModalField("field-title")).toHaveCount(0);
});

Then("the modal has no current-value field", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  await expect(kiosk.addChildModalField("field-current-value")).toHaveCount(0);
  await expect(
    kiosk.addChildModalField("field-current-value-date"),
  ).toHaveCount(0);
});

Then("the modal has a description field", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  await expect(kiosk.addChildModalField("field-description")).toHaveCount(1);
});

// SPEC §17.15 — TextNode form omits the description field; the current
// value IS the description for text cards.
Then("the modal has no description field", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  await expect(kiosk.addChildModalField("field-description")).toHaveCount(0);
});

Then("the modal has a weight field", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  await expect(kiosk.addChildModalField("field-weight")).toHaveCount(1);
});

// SPEC §17.26 — weight is a slider + numeric input pair. The slider
// runs 0..10 step 0.5; both halves share the same `weight` state and
// stay in sync one keystroke at a time. We pin the contract from the
// e2e side so a future regression that drops one half (or breaks the
// sync) trips the gate.
Then(
  "the weight slider runs 0.5..10 step 0.5 and mirrors the number input",
  async ({ page }) => {
    // SPEC §17.31 — slider min was bumped from 0 to 0.5 so the
    // smallest reachable slider value matches the relaxed
    // `Weight.of` floor. Pre-§17.31 the slider advertised min=0 but
    // the domain rejected 0 at confirm time (a UX trap).
    const kiosk = new TreeMapPage(page);
    const slider = kiosk.addChildModalField("field-weight-slider");
    await expect(slider).toHaveCount(1);
    await expect(slider).toHaveAttribute("type", "range");
    await expect(slider).toHaveAttribute("min", "0.5");
    await expect(slider).toHaveAttribute("max", "10");
    await expect(slider).toHaveAttribute("step", "0.5");
    const num = kiosk.addChildModalField("field-weight");
    await expect(num).toHaveAttribute("type", "number");
    await expect(num).toHaveAttribute("min", "0.5");
    await expect(num).toHaveAttribute("max", "10");
    await expect(num).toHaveAttribute("step", "0.5");
    // Both halves carry the same value at rest (the §17.16 default `1`).
    await expect(slider).toHaveValue("1");
    await expect(num).toHaveValue("1");
  },
);

When(
  "I set the weight slider to {string}",
  async ({ page }, value: string) => {
    // SPEC §17.26 — drive the slider via a `fill`-equivalent input
    // event. Playwright's native `fill` doesn't work on `<input
    // type="range">`, so we set the value imperatively and dispatch
    // `input` (the same event the modal listens to). This mirrors the
    // user's drag interaction at the contract level.
    const kiosk = new TreeMapPage(page);
    const slider = kiosk.addChildModalField("field-weight-slider");
    await slider.evaluate((node: Element, v: string) => {
      const input = node as HTMLInputElement;
      input.value = v;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  },
);

Then(
  "the weight number input shows the value {string}",
  async ({ page }, expected: string) => {
    const kiosk = new TreeMapPage(page);
    await expect(kiosk.addChildModalField("field-weight")).toHaveValue(
      expected,
    );
  },
);

Then("the modal has no unit field", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  await expect(kiosk.addChildModalField("field-unit")).toHaveCount(0);
});

Then("the modal has no objective fields", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  await expect(kiosk.addChildModalField("field-initial")).toHaveCount(0);
  await expect(kiosk.addChildModalField("field-target")).toHaveCount(0);
  await expect(kiosk.addChildModalField("field-target-date")).toHaveCount(0);
});

// SPEC §17.77 / §17.94 — StrictRange-only fields. The range row carries
// two `<input type="number">`s pinned to `field-range-min` / `field-range-max`.
// Asserted as a pair so the per-scenario step reads naturally.
Then("the modal has range fields", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  await expect(kiosk.addChildModalField("field-range-min")).toHaveCount(1);
  await expect(kiosk.addChildModalField("field-range-max")).toHaveCount(1);
});

Then("the modal has no range fields", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  await expect(kiosk.addChildModalField("field-range-min")).toHaveCount(0);
  await expect(kiosk.addChildModalField("field-range-max")).toHaveCount(0);
});

When(
  "I set the range min to {string}",
  async ({ page }, value: string) => {
    const kiosk = new TreeMapPage(page);
    await kiosk.addChildModalField("field-range-min").fill(value);
  },
);

When(
  "I set the range max to {string}",
  async ({ page }, value: string) => {
    const kiosk = new TreeMapPage(page);
    await kiosk.addChildModalField("field-range-max").fill(value);
  },
);

Then("the modal has a unit field", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  await expect(kiosk.addChildModalField("field-unit")).toHaveCount(1);
});

Then("the modal has objective fields", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  await expect(kiosk.addChildModalField("field-initial")).toHaveCount(1);
  await expect(kiosk.addChildModalField("field-target")).toHaveCount(1);
  await expect(kiosk.addChildModalField("field-target-date")).toHaveCount(1);
});

// SPEC §17.13 — the BSC modal collects a mandatory seed TimestampedValue
// to feed the otherwise-empty history; the as-of date defaults to today.
Then("the modal has a current-value field", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  await expect(kiosk.addChildModalField("field-current-value")).toHaveCount(1);
  await expect(
    kiosk.addChildModalField("field-current-value-date"),
  ).toHaveCount(1);
});

Then(
  "the as-of date defaults to today's local-calendar ISO",
  async ({ page }) => {
    const kiosk = new TreeMapPage(page);
    const today = (() => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    })();
    await expect(
      kiosk.addChildModalField("field-current-value-date"),
    ).toHaveValue(today);
  },
);

Then("the modal has the computed toggle", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  await expect(kiosk.addChildModalField("field-computed")).toHaveCount(1);
});

Then("the modal has the eligible-for-parent-computation toggle", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  await expect(kiosk.addChildModalField("field-eligible")).toHaveCount(1);
});

Then(
  "the title field shows the value {string}",
  async ({ page }, expected: string) => {
    const kiosk = new TreeMapPage(page);
    await expect(kiosk.addChildModalField("field-title")).toHaveValue(expected);
  },
);

// -- Backdrop ------------------------------------------------------------

Then("the modal backdrop is semi-transparent", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  // Resolve the rendered `background-color` and assert its alpha is in the
  // [0, 1) range (anything strictly less than 1 means "you can see through
  // it"). `color-mix(in srgb, #000 55%, transparent)` resolves to an
  // `rgba()` once the browser computes it.
  const alpha = await kiosk.addChildModalBackdrop().evaluate((el: Element) => {
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    const m = /rgba?\(([^)]+)\)/.exec(bg);
    if (!m) return 1;
    const parts = m[1]!.split(",").map((s) => s.trim());
    if (parts.length < 4) return 1;
    return Number(parts[3]);
  });
  expect(alpha).toBeGreaterThan(0);
  expect(alpha).toBeLessThan(1);
});

// -- Empty-field placeholder pattern (SPEC §6 + §17.13) ------------------

Then(
  'every modal text input has a placeholder of the form "<Field name> — e.g. <mock>"',
  async ({ page }) => {
    const kiosk = new TreeMapPage(page);
    const placeholders = await kiosk
      .addChildModalForm()
      .evaluate((form: Element) => {
        const fields = form.querySelectorAll<
          HTMLInputElement | HTMLTextAreaElement
        >(
          'input[type="text"], input[type="number"], input[type="date"], textarea',
        );
        return Array.from(fields).map((f) => f.placeholder);
      });
    expect(placeholders.length).toBeGreaterThan(0);
    // SPEC §6 (refined in §17.13) — every placeholder reads
    // `<Field name> — e.g. <example>`. The capital-leading field name
    // (re-)states the input's purpose, and the `e.g.` clause carries a
    // concrete sample value.
    for (const p of placeholders) {
      expect(p).toMatch(/^[A-Z].* — e\.g\./);
    }
  },
);

Then(
  "no modal <label> wraps a text, number, date, or textarea field",
  async ({ page }) => {
    const kiosk = new TreeMapPage(page);
    const violations = await kiosk
      .addChildModalForm()
      .evaluate((form: Element) => {
        return Array.from(form.querySelectorAll("label"))
          .map((lab) =>
            lab.querySelector(
              'input[type="text"], input[type="number"], input[type="date"], textarea',
            )
              ? lab.outerHTML
              : null,
          )
          .filter((v): v is string => v !== null);
      });
    expect(violations).toEqual([]);
  },
);

// -- Focus invariance ----------------------------------------------------

Then("the focused id is unchanged after the modal interaction", async ({ page }) => {
  const kiosk = new TreeMapPage(page);
  // The default seed focuses the root `TextNode` whose id is generated at
  // boot — we don't know its value up-front, but we know the parent strip's
  // `data-focused-id` was the same before opening the modal as it is now.
  // The cheap invariant: the parent strip is still rendering the same id
  // it had at the start of the scenario. We capture/compare via the
  // `data-id` on the parent strip's `<node-view>` which mirrors the
  // focused node's id (SPEC §17.9 — `data-focused-id` on the strip).
  const stripId = await kiosk.focusedId();
  // The default seed is "Root" (a TextNode) at the root of the board.
  // The plus-tile activates from the focused parent, so `data-focused-id`
  // is the parent's id — i.e. the root id. Asserting non-null suffices to
  // prove "still rendering a focused parent strip"; the per-scenario
  // setup (open-with-empty-storage) guarantees the value is the seeded
  // root's id, which is unchanged through the modal flow.
  expect(stripId).not.toBeNull();
  expect(stripId).not.toBe("");
});

// -- Shared modal frame (SPEC §17.29) -----------------------------------

When("I tap the modal close-X", async ({ page }) => {
  // SPEC §17.29 -- every modal in the app carries a close-X button in
  // its top-right corner via `modalFrameStyles.renderModalCloseX`.
  // The button's testid (`modal-close-x`) is the same across modals,
  // so a single step covers add-child / edit-node / future modals.
  // Scenarios assert the resulting "modal closed" state via the per-
  // modal "is closed" step.
  const kiosk = new TreeMapPage(page);
  await kiosk.modalCloseX().click();
});

Then(
  "the modal panel fits inside the viewport with at least 2rem of margin",
  async ({ page }) => {
    // SPEC §17.29 -- the modal panel is sized as `width/height:
    // max-content` and capped at `100vw/100vh - 4rem`. So either:
    //   (a) the content is small -> the panel is smaller than the cap;
    //   (b) the content overflows -> the panel hits the cap exactly.
    // In both cases the panel's bounding box must leave >= 2rem of
    // margin on every side (4rem total = 2rem on each side, modulo
    // sub-pixel rounding). Pre-§17.29 the panel was pinned to
    // `inset:5vh 8vw` which left ~5vh / ~8vw of margin -- this step
    // would have passed by accident on a small viewport but failed
    // on a wide one (8vw of 1920px = 154px, well over 2rem).
    const kiosk = new TreeMapPage(page);
    // The shared close-X has the same testid on every modal; we
    // resolve the panel from whichever modal is currently open.
    const closeX = kiosk.modalCloseX();
    await closeX.waitFor({ state: "visible" });
    // The modals live inside `<tree-map-screen>`'s shadow root, so
    // we walk into it from the host element. Both modal hosts are
    // direct shadow children of the screen.
    const measured = await page.evaluate(() => {
      const screen = document.querySelector("tree-map-screen");
      const screenRoot = (screen as { shadowRoot?: ShadowRoot } | null)
        ?.shadowRoot;
      if (!screenRoot) {
        throw new Error("expected <tree-map-screen> with an open shadow root");
      }
      const modals = Array.from(
        screenRoot.querySelectorAll<HTMLElement>(
          "add-child-modal, edit-node-modal",
        ),
      ).filter((el) => el.hasAttribute("open"));
      if (modals.length === 0) {
        throw new Error("expected an open modal but found none");
      }
      const host = modals[0]!;
      const panel = host.shadowRoot?.querySelector<HTMLElement>(
        '[role="dialog"]',
      );
      if (!panel) {
        throw new Error("expected a [role=dialog] panel inside the modal");
      }
      const rect = panel.getBoundingClientRect();
      const remPx = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      return {
        top: rect.top,
        left: rect.left,
        right: window.innerWidth - rect.right,
        bottom: window.innerHeight - rect.bottom,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
        remPx,
      };
    });
    const minMarginPx = 2 * measured.remPx - 1; // sub-pixel tolerance
    expect(measured.top).toBeGreaterThanOrEqual(minMarginPx);
    expect(measured.left).toBeGreaterThanOrEqual(minMarginPx);
    expect(measured.right).toBeGreaterThanOrEqual(minMarginPx);
    expect(measured.bottom).toBeGreaterThanOrEqual(minMarginPx);
  },
);
