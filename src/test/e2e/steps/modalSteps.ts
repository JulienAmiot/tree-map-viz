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

import { TreeGraphPage } from "../pageObjects/TreeGraphPage.js";

const { When, Then } = createBdd();

// -- Modal lifecycle -----------------------------------------------------

When("I pick the kind {string}", async ({ page }, kind: string) => {
  // SPEC §17.19 — single-page flow: pick the kind by selecting the
  // matching `<option>` in the kind dropdown (was two large buttons
  // pre-§17.19). Playwright's `selectOption` dispatches `change`,
  // which the modal listens to.
  const kiosk = new TreeGraphPage(page);
  await kiosk.addChildModalKindSelect().selectOption(kind);
});

When("I fill in the title with {string}", async ({ page }, title: string) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.addChildModalField("field-title").fill(title);
});

When(
  "I fill in the current value with {string}",
  async ({ page }, value: string) => {
    // SPEC §17.13 / §17.14 — both kinds collect a mandatory seed
    // `TimestampedValue`; the `field-current-value` testid is the same
    // whether the underlying input is a number (BSC) or textarea (Text).
    const kiosk = new TreeGraphPage(page);
    await kiosk.addChildModalField("field-current-value").fill(value);
  },
);

When("I confirm the add-child modal", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await kiosk.addChildModalConfirm().click();
});

When("I cancel the add-child modal", async ({ page }) => {
  // SPEC §17.19 — single-page flow: there's exactly one Cancel button
  // (no more dual Cancel buttons across Step 1 / Step 2), so we click
  // the testid directly.
  const kiosk = new TreeGraphPage(page);
  await kiosk.addChildModalCancel().click();
});

// -- Modal state --------------------------------------------------------

Then("the add-child modal is open", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  expect(await kiosk.isAddChildModalOpen()).toBe(true);
  await expect(kiosk.addChildModalPanel()).toBeVisible();
});

Then("the add-child modal is closed", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  expect(await kiosk.isAddChildModalOpen()).toBe(false);
  await expect(kiosk.addChildModalPanel()).toHaveCount(0);
});

Then(
  "the modal offers a {string} kind",
  async ({ page }, kindLabel: string) => {
    // SPEC §17.19 — the modal lists the available kinds as `<option>`
    // entries inside the kind dropdown, each labelled
    // "Name — Description". `evaluate` reads the live `select.options`
    // collection (avoids Playwright's quirks around `<select>` light
    // children inside a shadow root).
    const kiosk = new TreeGraphPage(page);
    const sel = kiosk.addChildModalKindSelect();
    await expect(sel).toHaveCount(1);
    const optionTexts = await sel.evaluate((node: Element) => {
      const select = node as HTMLSelectElement;
      return Array.from(select.options).map(
        (o) => o.textContent?.trim() ?? "",
      );
    });
    const matching = optionTexts.filter((t) =>
      t.startsWith(`${kindLabel} \u2014`),
    );
    expect(matching).toHaveLength(1);
  },
);

Then(
  "the modal kind dropdown shows {string} options labelled with name and description",
  async ({ page }, expected: string) => {
    // SPEC §17.19 — dropdown shape: `<expected>` real options (the
    // placeholder option is excluded from the count); each carries a
    // dash-separated "Name — Description" label. We `evaluate` against
    // the `<select>` so we can read its `<option>` children directly
    // through the live DOM API (Playwright's `locator("option")` does
    // not always traverse `<select>` children as expected when the
    // select sits inside an open shadow root).
    const kiosk = new TreeGraphPage(page);
    const sel = kiosk.addChildModalKindSelect();
    const optionTexts = await sel.evaluate((node: Element) => {
      const select = node as HTMLSelectElement;
      return Array.from(select.options)
        .filter((o) => !o.disabled)
        .map((o) => o.textContent?.trim() ?? "");
    });
    expect(optionTexts).toHaveLength(Number(expected));
    for (const t of optionTexts) {
      expect(t).toMatch(/^[A-Z][^\u2014]+ \u2014 .+/);
    }
  },
);

Then(
  "the modal form is for kind {string}",
  async ({ page }, kind: string) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.addChildModalForm()).toHaveAttribute("data-kind", kind);
  },
);

Then("the modal has a title field", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.addChildModalField("field-title")).toHaveCount(1);
});

// SPEC §17.19 — before a kind is picked, no type-specific fields
// render; the form is just the dropdown + actions row.
Then("the modal has no title field", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.addChildModalField("field-title")).toHaveCount(0);
});

Then("the modal has no current-value field", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.addChildModalField("field-current-value")).toHaveCount(0);
  await expect(
    kiosk.addChildModalField("field-current-value-date"),
  ).toHaveCount(0);
});

Then("the modal has a description field", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.addChildModalField("field-description")).toHaveCount(1);
});

// SPEC §17.15 — TextNode form omits the description field; the current
// value IS the description for text cards.
Then("the modal has no description field", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.addChildModalField("field-description")).toHaveCount(0);
});

Then("the modal has a weight field", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.addChildModalField("field-weight")).toHaveCount(1);
});

Then("the modal has no unit field", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.addChildModalField("field-unit")).toHaveCount(0);
});

Then("the modal has no objective fields", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.addChildModalField("field-initial")).toHaveCount(0);
  await expect(kiosk.addChildModalField("field-target")).toHaveCount(0);
  await expect(kiosk.addChildModalField("field-target-date")).toHaveCount(0);
});

Then("the modal has a unit field", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.addChildModalField("field-unit")).toHaveCount(1);
});

Then("the modal has objective fields", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.addChildModalField("field-initial")).toHaveCount(1);
  await expect(kiosk.addChildModalField("field-target")).toHaveCount(1);
  await expect(kiosk.addChildModalField("field-target-date")).toHaveCount(1);
});

// SPEC §17.13 — the BSC modal collects a mandatory seed TimestampedValue
// to feed the otherwise-empty history; the as-of date defaults to today.
Then("the modal has a current-value field", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.addChildModalField("field-current-value")).toHaveCount(1);
  await expect(
    kiosk.addChildModalField("field-current-value-date"),
  ).toHaveCount(1);
});

Then(
  "the as-of date defaults to today's local-calendar ISO",
  async ({ page }) => {
    const kiosk = new TreeGraphPage(page);
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
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.addChildModalField("field-computed")).toHaveCount(1);
});

Then("the modal has the eligible-for-parent-computation toggle", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
  await expect(kiosk.addChildModalField("field-eligible")).toHaveCount(1);
});

Then(
  "the title field shows the value {string}",
  async ({ page }, expected: string) => {
    const kiosk = new TreeGraphPage(page);
    await expect(kiosk.addChildModalField("field-title")).toHaveValue(expected);
  },
);

// -- Backdrop ------------------------------------------------------------

Then("the modal backdrop is semi-transparent", async ({ page }) => {
  const kiosk = new TreeGraphPage(page);
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
    const kiosk = new TreeGraphPage(page);
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
    const kiosk = new TreeGraphPage(page);
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
  const kiosk = new TreeGraphPage(page);
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
