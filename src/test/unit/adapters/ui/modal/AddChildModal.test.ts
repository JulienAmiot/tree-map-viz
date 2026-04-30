import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../adapters/ui/modal/AddChildModal.js";
import {
  ADD_CHILD_CANCEL_EVENT,
  ADD_CHILD_CONFIRM_EVENT,
  type AddChildConfirmDetail,
  type AddChildModal,
} from "../../../../../adapters/ui/modal/AddChildModal.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

function panelOf(el: AddChildModal): HTMLElement | null {
  return el.shadowRoot?.querySelector<HTMLElement>(
    '[data-testid="add-child-modal"]',
  ) ?? null;
}

function backdropOf(el: AddChildModal): HTMLElement {
  const bd = el.shadowRoot?.querySelector<HTMLElement>(
    '[data-testid="modal-backdrop"]',
  );
  if (!bd) throw new Error("expected modal-backdrop to be rendered");
  return bd;
}

function kindCardOf(el: AddChildModal, kind: string): HTMLButtonElement {
  const card = el.shadowRoot?.querySelector<HTMLButtonElement>(
    `[data-testid="kind-card"][data-kind="${kind}"]`,
  );
  if (!card) throw new Error(`expected kind-card[${kind}]`);
  return card;
}

function fieldOf(
  el: AddChildModal,
  testid: string,
): HTMLInputElement | HTMLTextAreaElement {
  const f = el.shadowRoot?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[data-testid="${testid}"]`,
  );
  if (!f) throw new Error(`expected field [${testid}]`);
  return f;
}

function confirmBtnOf(el: AddChildModal): HTMLButtonElement {
  const b = el.shadowRoot?.querySelector<HTMLButtonElement>(
    '[data-testid="modal-confirm"]',
  );
  if (!b) throw new Error("expected modal-confirm button (form step)");
  return b;
}

async function setInput(
  el: AddChildModal,
  testid: string,
  value: string,
): Promise<void> {
  const f = fieldOf(el, testid);
  f.value = value;
  f.dispatchEvent(new Event("input", { bubbles: true }));
  await el.updateComplete;
}

async function pickText(el: AddChildModal): Promise<void> {
  kindCardOf(el, "TextNode").click();
  await el.updateComplete;
}

async function pickBsc(el: AddChildModal): Promise<void> {
  kindCardOf(el, "BusinessScoreCardNode").click();
  await el.updateComplete;
}

describe("<add-child-modal>", () => {
  it("renders nothing in the body when open=false (no backdrop, no panel)", async () => {
    const el = await mountLitElement<AddChildModal>("add-child-modal");
    expect(el.open).toBe(false);
    expect(panelOf(el)).toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="modal-backdrop"]'),
    ).toBeNull();
  });

  it("renders the type picker (Step 1 / 2) when open=true", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
        e.parentId = "uuid-parent";
      },
    );
    const panel = panelOf(el);
    expect(panel).not.toBeNull();
    expect(panel?.dataset["step"]).toBe("pick-kind");
    expect(
      el.shadowRoot
        ?.querySelector('[data-testid="modal-step"]')
        ?.textContent?.trim(),
    ).toBe("Step 1 / 2");
    expect(
      el.shadowRoot?.querySelectorAll('[data-testid="kind-card"]').length,
    ).toBe(2);
  });

  it("picking a kind moves to Step 2 / 2 with the form for that kind", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(el);
    const panel = panelOf(el);
    expect(panel?.dataset["step"]).toBe("fill-form");
    const form = el.shadowRoot?.querySelector<HTMLFormElement>(
      '[data-testid="modal-form"]',
    );
    expect(form?.dataset["kind"]).toBe("TextNode");
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-unit"]'),
    ).toBeNull();
    // SPEC §17.15 — TextNode form has NO description field. The current
    // value IS the description for text cards; collecting it twice would
    // be redundant.
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-description"]'),
    ).toBeNull();
  });

  it("BSC form keeps the description field (\u00a717.15 — only TextNode drops it)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickBsc(el);
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-description"]'),
    ).not.toBeNull();
  });

  it("weight field is pre-filled with `1` on both Text and BSC forms (\u00a717.16)", async () => {
    // SPEC §17.16 — most kiosk-added children take the default weight,
    // so the form pre-fills `1` (matching the service fallback) instead
    // of leaving the field empty with just a placeholder.
    const elText = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(elText);
    expect((fieldOf(elText, "field-weight") as HTMLInputElement).value).toBe("1");

    const elBsc = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickBsc(elBsc);
    expect((fieldOf(elBsc, "field-weight") as HTMLInputElement).value).toBe("1");
  });

  it("weight default is re-applied each time the modal re-opens (no leak)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(el);
    await setInput(el, "field-weight", "7");
    el.open = false;
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    await pickText(el);
    expect((fieldOf(el, "field-weight") as HTMLInputElement).value).toBe("1");
  });

  it("BSC current-value row aligns current-value, unit, and as-of date on one line (\u00a717.16)", async () => {
    // SPEC §17.16 — the three fields that together describe a single
    // measurement (number + unit + date) live on one `field-row`,
    // so the kiosk operator's eye stays on a horizontal line while
    // entering "42 % as of today". The unit field is no longer in the
    // weight row.
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickBsc(el);

    const cvRow = el.shadowRoot?.querySelector(
      '[data-testid="current-value-row"]',
    );
    expect(cvRow).not.toBeNull();
    const ids = Array.from(
      cvRow?.querySelectorAll<HTMLElement>("[data-testid]") ?? [],
    ).map((f) => f.getAttribute("data-testid"));
    expect(ids).toEqual([
      "field-current-value",
      "field-unit",
      "field-current-value-date",
    ]);

    // The weight row is now unit-less.
    const weightRow = el.shadowRoot?.querySelector(
      '[data-testid="weight-row"]',
    );
    expect(weightRow?.querySelector('[data-testid="field-unit"]')).toBeNull();
  });

  it("picking BusinessScoreCard exposes unit + objective + current-value + toggle fields", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickBsc(el);
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-unit"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-initial"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-target"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-target-date"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-current-value"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-current-value-date"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-computed"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-eligible"]'),
    ).not.toBeNull();
  });

  it("BSC 'as of' date defaults to today's local-calendar ISO date (SPEC §17.13)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickBsc(el);
    const expected = (() => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    })();
    const dateInput = fieldOf(el, "field-current-value-date") as HTMLInputElement;
    expect(dateInput.value).toBe(expected);
  });

  it("BSC 'as of' default is re-applied each time the modal re-opens (no leak)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickBsc(el);
    await setInput(el, "field-current-value-date", "2020-01-01");
    el.open = false;
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    await pickBsc(el);
    const today = (() => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    })();
    expect(
      (fieldOf(el, "field-current-value-date") as HTMLInputElement).value,
    ).toBe(today);
  });

  it("Confirm is disabled for TextNode until title + current value + as-of date are filled (\u00a717.14)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(el);
    const btn = confirmBtnOf(el);
    expect(btn.disabled).toBe(true);
    await setInput(el, "field-title", "Hello");
    // Title alone is no longer enough: TextNode now also requires a seed
    // `TimestampedValue<string>` (current text + as-of date).
    expect(confirmBtnOf(el).disabled).toBe(true);
    await setInput(el, "field-current-value", "First note");
    // The as-of date defaults to today on open, so once the current
    // value is filled Confirm should enable.
    expect(confirmBtnOf(el).disabled).toBe(false);
    await setInput(el, "field-current-value-date", "");
    expect(confirmBtnOf(el).disabled).toBe(true);
    await setInput(el, "field-current-value-date", "2026-04-30");
    expect(confirmBtnOf(el).disabled).toBe(false);
  });

  it("TextNode form's `as of` date defaults to today's local-calendar ISO (\u00a717.14)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(el);
    const expected = (() => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    })();
    const dateInput = fieldOf(el, "field-current-value-date") as HTMLInputElement;
    expect(dateInput.value).toBe(expected);
  });

  it("Confirm is disabled for BSC until title + unit + objective + current value are filled", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickBsc(el);
    expect(confirmBtnOf(el).disabled).toBe(true);
    await setInput(el, "field-title", "Revenue");
    expect(confirmBtnOf(el).disabled).toBe(true);
    await setInput(el, "field-unit", "%");
    await setInput(el, "field-initial", "0");
    await setInput(el, "field-target", "100");
    await setInput(el, "field-target-date", "2026-12-31");
    // Objective + identity fields filled, but the mandatory current-value
    // seed (SPEC §17.13) is still empty → Confirm stays disabled.
    expect(confirmBtnOf(el).disabled).toBe(true);
    await setInput(el, "field-current-value", "42");
    expect(confirmBtnOf(el).disabled).toBe(false);
    // Also: clearing the as-of date back to empty must re-disable Confirm.
    await setInput(el, "field-current-value-date", "");
    expect(confirmBtnOf(el).disabled).toBe(true);
    await setInput(el, "field-current-value-date", "2026-04-30");
    expect(confirmBtnOf(el).disabled).toBe(false);
  });

  it("clicking Confirm fires `add-child-confirm` with the parentId + a TextNode payload (history seeded, \u00a717.14)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
        e.parentId = "uuid-parent";
      },
    );
    const handler = vi.fn();
    el.addEventListener(ADD_CHILD_CONFIRM_EVENT, handler);

    await pickText(el);
    await setInput(el, "field-title", "Quick note");
    await setInput(el, "field-weight", "2");
    await setInput(el, "field-current-value", "Today's headline");
    await setInput(el, "field-current-value-date", "2026-04-30");
    confirmBtnOf(el).click();

    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0]?.[0] as
      | CustomEvent<AddChildConfirmDetail>
      | undefined;
    expect(evt?.bubbles).toBe(true);
    expect(evt?.composed).toBe(true);
    expect(evt?.detail.parentId).toBe("uuid-parent");
    const p = evt?.detail.payload;
    expect(p?.kind).toBe("TextNode");
    if (p?.kind !== "TextNode") return; // narrow
    expect(p.title).toBe("Quick note");
    // SPEC §17.15 — the TextNode payload variant carries no `description`
    // field at all; the current value IS the description for text cards.
    expect(p).not.toHaveProperty("description");
    expect(p.weight).toBe(2);
    expect(p.initialHistory).toHaveLength(1);
    const seed = p.initialHistory?.[0];
    expect(seed?.value).toBe("Today's headline");
    expect(seed?.asOf).toBeInstanceOf(Date);
    expect(seed?.asOf.toISOString()).toBe("2026-04-30T00:00:00.000Z");
  });

  it("clicking Confirm fires `add-child-confirm` with a BusinessScoreCard payload (numbers parsed, date as Date, history seeded)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
        e.parentId = "uuid-parent";
      },
    );
    const handler = vi.fn();
    el.addEventListener(ADD_CHILD_CONFIRM_EVENT, handler);

    await pickBsc(el);
    await setInput(el, "field-title", "Revenue");
    await setInput(el, "field-unit", "M€");
    await setInput(el, "field-initial", "10");
    await setInput(el, "field-target", "120");
    await setInput(el, "field-target-date", "2027-03-31");
    await setInput(el, "field-current-value", "55");
    await setInput(el, "field-current-value-date", "2026-04-30");
    confirmBtnOf(el).click();

    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0]?.[0] as
      | CustomEvent<AddChildConfirmDetail>
      | undefined;
    const p = evt?.detail.payload;
    expect(p?.kind).toBe("BusinessScoreCardNode");
    if (p?.kind !== "BusinessScoreCardNode") return; // narrow
    expect(p.title).toBe("Revenue");
    // SPEC §17.16 — weight defaults to `1` (the form pre-fills it). The
    // operator did not touch the weight field in this test, so the
    // payload carries the default value end-to-end.
    expect(p.weight).toBe(1);
    expect(p.unit).toBe("M€");
    expect(p.objective.initialValue).toBe(10);
    expect(p.objective.targetValue).toBe(120);
    expect(p.objective.targetDate).toBeInstanceOf(Date);
    expect(p.objective.targetDate.toISOString()).toBe("2027-03-31T00:00:00.000Z");
    expect(p.computed).toBe(false);
    expect(p.eligibleForParentComputation).toBe(true);
    // SPEC §17.13 — the seed TimestampedValue is in the payload exactly once.
    expect(p.initialHistory).toHaveLength(1);
    const seed = p.initialHistory?.[0];
    expect(seed?.value).toBe(55);
    expect(seed?.asOf).toBeInstanceOf(Date);
    expect(seed?.asOf.toISOString()).toBe("2026-04-30T00:00:00.000Z");
  });

  it("Cancel button fires `add-child-cancel`", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(ADD_CHILD_CANCEL_EVENT, handler);

    el.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-testid="modal-cancel"]')
      ?.click();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(
      (handler.mock.calls[0]?.[0] as CustomEvent | undefined)?.bubbles,
    ).toBe(true);
  });

  it("Escape key while open fires `add-child-cancel`", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(ADD_CHILD_CANCEL_EVENT, handler);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("Escape key while closed is a no-op", async () => {
    const el = await mountLitElement<AddChildModal>("add-child-modal");
    expect(el.open).toBe(false);
    const handler = vi.fn();
    el.addEventListener(ADD_CHILD_CANCEL_EVENT, handler);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("backdrop click fires `add-child-cancel`", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(ADD_CHILD_CANCEL_EVENT, handler);
    backdropOf(el).click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("opening the modal again resets the form (no leak from a prior unconfirmed session)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(el);
    await setInput(el, "field-title", "leak");
    el.open = false;
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    expect(panelOf(el)?.dataset["step"]).toBe("pick-kind");
  });

  it("Back returns to the type picker without firing cancel", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    const cancelHandler = vi.fn();
    el.addEventListener(ADD_CHILD_CANCEL_EVENT, cancelHandler);
    await pickText(el);
    el.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-testid="modal-back"]')
      ?.click();
    await el.updateComplete;
    expect(panelOf(el)?.dataset["step"]).toBe("pick-kind");
    expect(cancelHandler).not.toHaveBeenCalled();
  });

  it("renders an inline error when `errorMessage` is set", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(el);
    el.errorMessage = "boom";
    await el.updateComplete;
    expect(
      el.shadowRoot
        ?.querySelector('[data-testid="modal-error"]')
        ?.textContent?.trim(),
    ).toBe("boom");
    const form = el.shadowRoot?.querySelector<HTMLFormElement>(
      '[data-testid="modal-form"]',
    );
    expect(form?.hasAttribute("data-error")).toBe(true);
  });
});

describe("<add-child-modal> empty-field placeholder pattern (SPEC §6)", () => {
  // SPEC §6 (refined in §17.13): every modal placeholder reads
  // `<Field name> — e.g. <mock value>`. The capital-leading field name
  // (re-)states the input's purpose, the em-dash separates label from
  // example, and the `e.g.` clause carries a concrete sample value.
  const FIELD_NAME_AND_EG = /^[A-Z].* — e\.g\./;

  it("every input/textarea on the TextNode form has a placeholder of the form '<Field name> — e.g. <mock>'", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(el);
    // SPEC §17.14 — TextNode form now includes a `date` input (the seed
    // `as of` field), so the selector covers all four field types.
    const fields = Array.from(
      el.shadowRoot?.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement
      >(
        '[data-testid="modal-form"] input[type="text"], [data-testid="modal-form"] input[type="number"], [data-testid="modal-form"] input[type="date"], [data-testid="modal-form"] textarea',
      ) ?? [],
    );
    expect(fields.length).toBeGreaterThan(0);
    for (const f of fields) {
      expect(f.placeholder).toMatch(FIELD_NAME_AND_EG);
    }
  });

  it("every text/number/date/textarea on the BSC form has a placeholder of the form '<Field name> — e.g. <mock>'", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickBsc(el);
    const fields = Array.from(
      el.shadowRoot?.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement
      >(
        '[data-testid="modal-form"] input[type="text"], [data-testid="modal-form"] input[type="number"], [data-testid="modal-form"] input[type="date"], [data-testid="modal-form"] textarea',
      ) ?? [],
    );
    expect(fields.length).toBeGreaterThan(0);
    for (const f of fields) {
      expect(f.placeholder).toMatch(FIELD_NAME_AND_EG);
    }
  });

  it("the form has no <label> siblings on its text/number inputs (SPEC §6 — placeholders carry the purpose)", async () => {
    // The two checkboxes (computed + eligibleForParentComputation) ARE wrapped
    // in <label> for accessibility (checkboxes are non-textual and need a
    // visible accessible name); that is intentional. The §6 rule applies to
    // form fields where a placeholder example doubles as the label.
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickBsc(el);
    const labels = Array.from(
      el.shadowRoot?.querySelectorAll<HTMLLabelElement>(
        '[data-testid="modal-form"] label',
      ) ?? [],
    );
    for (const lab of labels) {
      const hasNonCheckboxField = lab.querySelector(
        'input[type="text"], input[type="number"], input[type="date"], textarea',
      );
      expect(hasNonCheckboxField).toBeNull();
    }
  });

  it("typing into the title field clears the visual placeholder (input value !== '')", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(el);
    const title = fieldOf(el, "field-title") as HTMLInputElement;
    expect(title.value).toBe("");
    await setInput(el, "field-title", "Filled");
    expect((fieldOf(el, "field-title") as HTMLInputElement).value).toBe("Filled");
  });
});
