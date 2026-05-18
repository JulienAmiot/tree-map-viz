import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../adapters/ui/modal/AddChildModal.js";
import {
  ADD_CHILD_CANCEL_EVENT,
  ADD_CHILD_CONFIRM_EVENT,
  ALL_ADD_CHILD_KINDS,
  type AddChildConfirmDetail,
  type AddChildKind,
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

/** §17.25 — the left-rail container that holds the per-kind buttons. */
function kindListOf(el: AddChildModal): HTMLElement {
  const list = el.shadowRoot?.querySelector<HTMLElement>(
    '[data-testid="kind-list"]',
  );
  if (!list) throw new Error("expected kind-list container");
  return list;
}

/** §17.25 — the per-kind picker button by kind id. */
function kindButtonOf(
  el: AddChildModal,
  kind: AddChildKind,
): HTMLButtonElement {
  const btn = el.shadowRoot?.querySelector<HTMLButtonElement>(
    `[data-testid="kind-btn"][data-kind="${kind}"]`,
  );
  if (!btn) throw new Error(`expected kind-btn for [${kind}]`);
  return btn;
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

async function pickKind(
  el: AddChildModal,
  kind: AddChildKind,
): Promise<void> {
  // SPEC §17.25 — picking a kind = clicking the matching button in the
  // left-rail list. We mirror the user's interaction instead of poking
  // the @state property directly.
  kindButtonOf(el, kind).click();
  await el.updateComplete;
}

async function pickText(el: AddChildModal): Promise<void> {
  await pickKind(el, "TextNode");
}

async function pickBsc(el: AddChildModal): Promise<void> {
  await pickKind(el, "BusinessScoreCardNode");
}

async function pickWorkflow(el: AddChildModal): Promise<void> {
  await pickKind(el, "Workflow");
}

async function setSelect(
  el: AddChildModal,
  testid: string,
  value: string,
): Promise<void> {
  const f = el.shadowRoot?.querySelector<HTMLSelectElement>(
    `[data-testid="${testid}"]`,
  );
  if (!f) throw new Error(`expected select [${testid}]`);
  f.value = value;
  f.dispatchEvent(new Event("change", { bubbles: true }));
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

  it("renders the left-rail kind list with one button per available kind when open=true (\u00a717.25)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
        e.parentId = "uuid-parent";
      },
    );
    const panel = panelOf(el);
    expect(panel).not.toBeNull();
    // §17.25 — list, not dropdown; the old `<select>` is gone.
    expect(
      el.shadowRoot?.querySelector('[data-testid="kind-select"]'),
    ).toBeNull();
    const list = kindListOf(el);
    const buttons = list.querySelectorAll<HTMLButtonElement>(
      '[data-testid="kind-btn"]',
    );
    // One button per kind, in registration order. §17.118 inserts the
    // `Workflow` kind between `TextNode` and `BusinessScoreCardNode`
    // (it's a TextNode-with-status; the catalogue keeps "general note"
    // → "note with status badge" → "measurable" reading order).
    // SPEC §17.119 appended `PictureNode` at the end of the catalogue;
    // a future kind addition lands at the end of this array.
    expect(Array.from(buttons).map((b) => b.dataset["kind"])).toEqual([
      "TextNode",
      "Workflow",
      "BusinessScoreCardNode",
      "PictureNode",
    ]);
    // Each button shows "Name — Description" (same content the pre-§17.19
    // kind-cards rendered, layout-agnostic since §17.25).
    expect(buttons[0]?.textContent).toMatch(/Text/);
    expect(buttons[0]?.textContent).toMatch(/note|free-form/);
    expect(buttons[1]?.textContent).toMatch(/Workflow/);
    expect(buttons[1]?.textContent).toMatch(/status badge|PLAN/);
    expect(buttons[2]?.textContent).toMatch(/Business Score Card/);
    expect(buttons[2]?.textContent).toMatch(/measurable|target/);
    // None are pressed before a kind is picked.
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("false");
    expect(buttons[2]?.getAttribute("aria-pressed")).toBe("false");
  });

  it("when no kind is chosen the right pane shows the empty-state hint and no form (\u00a717.25)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    // Form root is absent until a kind is picked; the right pane shows
    // the muted hint instead. (Pre-§17.25 the form root rendered with
    // the dropdown inside it; that contract is gone now.)
    expect(
      el.shadowRoot?.querySelector('[data-testid="modal-form"]'),
    ).toBeNull();
    const empty = el.shadowRoot?.querySelector(
      '[data-testid="form-empty"]',
    );
    expect(empty).not.toBeNull();
    expect(empty?.textContent?.toLowerCase()).toContain("pick a card type");
    // The actions row is always rendered (Cancel must work even before
    // a kind is picked — see the dedicated Cancel-button test). Confirm
    // is rendered but disabled until canConfirm() returns true.
    expect(confirmBtnOf(el).disabled).toBe(true);
  });

  it("picking a kind reveals the form for that kind on the right pane and pressed-flags the picked button (\u00a717.25)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(el);
    const form = el.shadowRoot?.querySelector<HTMLFormElement>(
      '[data-testid="modal-form"]',
    );
    expect(form?.dataset["kind"]).toBe("TextNode");
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-title"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-current-value"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-unit"]'),
    ).toBeNull();
    // SPEC §17.15 — TextNode form has NO description field. The current
    // value IS the description for text cards; collecting it twice would
    // be redundant.
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-description"]'),
    ).toBeNull();
    // §17.25 — the picked button reflects aria-pressed=true; the other
    // stays false.
    expect(kindButtonOf(el, "TextNode").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(
      kindButtonOf(el, "BusinessScoreCardNode").getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("switching the kind from TextNode to BusinessScoreCardNode swaps in the BSC form (\u00a717.25)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(el);
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-unit"]'),
    ).toBeNull();
    await pickBsc(el);
    const form = el.shadowRoot?.querySelector<HTMLFormElement>(
      '[data-testid="modal-form"]',
    );
    expect(form?.dataset["kind"]).toBe("BusinessScoreCardNode");
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-unit"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-description"]'),
    ).not.toBeNull();
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
    // of leaving the field empty with just a placeholder. SPEC §17.26 —
    // the default `1` shows up on BOTH halves of the slider/number pair.
    const elText = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(elText);
    expect((fieldOf(elText, "field-weight") as HTMLInputElement).value).toBe("1");
    expect(
      (fieldOf(elText, "field-weight-slider") as HTMLInputElement).value,
    ).toBe("1");

    const elBsc = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickBsc(elBsc);
    expect((fieldOf(elBsc, "field-weight") as HTMLInputElement).value).toBe("1");
    expect(
      (fieldOf(elBsc, "field-weight-slider") as HTMLInputElement).value,
    ).toBe("1");
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

  // SPEC §17.29 — every modal in the app carries a top-right close-X
  // (provided by `modalFrameStyles.renderModalCloseX`). It must fire
  // the same `add-child-cancel` event the Cancel button / backdrop /
  // Escape do, so all four close paths are interchangeable.
  it("renders a top-right close-X button (SPEC §17.29 — shared modal frame)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    const closeX = el.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-testid="modal-close-x"]',
    );
    expect(closeX).not.toBeNull();
    expect(closeX?.tagName).toBe("BUTTON");
    expect(closeX?.getAttribute("aria-label")).toBe("Close modal");
  });

  it("close-X click fires `add-child-cancel` (SPEC §17.29)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(ADD_CHILD_CANCEL_EVENT, handler);
    el.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-testid="modal-close-x"]')
      ?.click();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(
      (handler.mock.calls[0]?.[0] as CustomEvent | undefined)?.bubbles,
    ).toBe(true);
  });

  it("close-X is absent when the modal is closed (SPEC §17.29 — render gate is shared with the rest of the body)", async () => {
    const el = await mountLitElement<AddChildModal>("add-child-modal");
    expect(el.open).toBe(false);
    expect(
      el.shadowRoot?.querySelector('[data-testid="modal-close-x"]'),
    ).toBeNull();
  });

  it("opening the modal again resets the form (no leak from a prior unconfirmed session, \u00a717.19)", async () => {
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
    // §17.25 — the right pane reverts to the empty-state hint, no
    // type-specific fields render, and every kind button is un-pressed.
    expect(
      el.shadowRoot?.querySelector('[data-testid="modal-form"]'),
    ).toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="form-empty"]'),
    ).not.toBeNull();
    expect(kindButtonOf(el, "TextNode").getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(
      kindButtonOf(el, "BusinessScoreCardNode").getAttribute("aria-pressed"),
    ).toBe("false");
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

describe("<add-child-modal> weight slider + numeric pair (SPEC §17.26)", () => {
  // §17.26 — the weight field is a slider (0..10 step 0.5,
  // touch-friendly) bidirectionally synced with a narrow numeric input
  // (precise keyboard entry). Either control writes to the same
  // `weight` state, so editing one updates the other one keystroke at
  // a time. The pre-§17.26 single numeric input is gone; the
  // `field-weight` testid is re-used for the numeric half so the
  // existing kiosk flows ("fill in the weight with 7") keep working.

  it("renders both halves of the pair: a range slider + a number input", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(el);
    const slider = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-testid="field-weight-slider"]',
    );
    const num = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-testid="field-weight"]',
    );
    expect(slider).not.toBeNull();
    expect(slider?.type).toBe("range");
    expect(num).not.toBeNull();
    expect(num?.type).toBe("number");
    // Both live inside the dedicated weight-control wrapper (e2e + a11y
    // can group them via the wrapper's testid).
    const wrapper = el.shadowRoot?.querySelector(
      '[data-testid="weight-control"]',
    );
    expect(wrapper).not.toBeNull();
    expect(wrapper?.contains(slider!)).toBe(true);
    expect(wrapper?.contains(num!)).toBe(true);
  });

  it("slider runs 0.5..10 with step 0.5 (the user-facing weight range, \u00a717.31)", async () => {
    // SPEC §17.31 — slider min bumped from 0 to 0.5 (the smallest
    // valid Weight per the relaxed domain validator). Pre-§17.31
    // the slider advertised min=0 but the domain rejected 0 at
    // confirm time — a UX trap the operator only hit on confirm.
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(el);
    const slider = fieldOf(el, "field-weight-slider") as HTMLInputElement;
    expect(slider.min).toBe("0.5");
    expect(slider.max).toBe("10");
    expect(slider.step).toBe("0.5");
  });

  it("number input mirrors the slider's range + step (so direct typing snaps to the same axis, \u00a717.31)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(el);
    const num = fieldOf(el, "field-weight") as HTMLInputElement;
    expect(num.min).toBe("0.5");
    expect(num.max).toBe("10");
    expect(num.step).toBe("0.5");
  });

  it("dragging the slider updates the number input in real time (slider \u2192 number)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(el);
    await setInput(el, "field-weight-slider", "3.5");
    expect(
      (fieldOf(el, "field-weight") as HTMLInputElement).value,
    ).toBe("3.5");
    expect(
      (fieldOf(el, "field-weight-slider") as HTMLInputElement).value,
    ).toBe("3.5");
  });

  it("typing in the number input updates the slider in real time (number \u2192 slider)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(el);
    await setInput(el, "field-weight", "7");
    expect(
      (fieldOf(el, "field-weight-slider") as HTMLInputElement).value,
    ).toBe("7");
    expect(
      (fieldOf(el, "field-weight") as HTMLInputElement).value,
    ).toBe("7");
  });

  it("the slider value flows through to the AddChildModalPayload.weight", async () => {
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
    await setInput(el, "field-title", "Slider weight");
    await setInput(el, "field-weight-slider", "2.5");
    await setInput(el, "field-current-value", "Note");
    await setInput(el, "field-current-value-date", "2026-04-30");
    confirmBtnOf(el).click();
    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0]?.[0] as
      | CustomEvent<AddChildConfirmDetail>
      | undefined;
    expect(evt?.detail.payload.weight).toBe(2.5);
  });
});

describe("<add-child-modal> availableKinds (SPEC §17.25)", () => {
  // §17.25 — the kind list is parameterisable so a future per-parent
  // policy can restrict the kinds an operator can add to a given
  // parent. Default is "all of them"; the tests below pin both the
  // default contract and the override seam.

  it("defaults to ALL_ADD_CHILD_KINDS when the property is left unset", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    expect(el.availableKinds).toEqual(ALL_ADD_CHILD_KINDS);
    const buttons = el.shadowRoot?.querySelectorAll(
      '[data-testid="kind-btn"]',
    );
    expect(buttons?.length).toBe(ALL_ADD_CHILD_KINDS.length);
  });

  it("renders only buttons for the kinds in availableKinds (a future per-parent policy can narrow)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
        e.availableKinds = ["BusinessScoreCardNode"];
      },
    );
    const buttons = Array.from(
      el.shadowRoot?.querySelectorAll<HTMLButtonElement>(
        '[data-testid="kind-btn"]',
      ) ?? [],
    );
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.dataset["kind"]).toBe("BusinessScoreCardNode");
  });

  it("clicks on a kind that is not in availableKinds are guarded (defensive — button isn't rendered, but the handler refuses too)", async () => {
    // The button isn't in the DOM for the excluded kind, so users can't
    // hit this path through the UI. Pinned because pickKind is the
    // public seam: a future refactor that conditionally disables the
    // button (rather than omitting it) must not let an excluded kind
    // through.
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
        e.availableKinds = ["TextNode"];
      },
    );
    expect(
      el.shadowRoot?.querySelector(
        '[data-testid="kind-btn"][data-kind="BusinessScoreCardNode"]',
      ),
    ).toBeNull();
    // Sanity: picking the included kind still works.
    await pickText(el);
    expect(kindButtonOf(el, "TextNode").getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("narrowing availableKinds mid-edit clears a now-excluded chosen kind (form collapses to the empty state)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(el);
    expect(
      el.shadowRoot?.querySelector('[data-testid="modal-form"]'),
    ).not.toBeNull();
    el.availableKinds = ["BusinessScoreCardNode"];
    await el.updateComplete;
    // The TextNode form is gone; the right pane shows the empty hint;
    // no kind button is pressed.
    expect(
      el.shadowRoot?.querySelector('[data-testid="modal-form"]'),
    ).toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="form-empty"]'),
    ).not.toBeNull();
    expect(
      kindButtonOf(el, "BusinessScoreCardNode").getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("narrowing availableKinds preserves a chosen kind that is still in the list", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickBsc(el);
    el.availableKinds = ["BusinessScoreCardNode"];
    await el.updateComplete;
    // Still the BSC form, still pressed.
    const form = el.shadowRoot?.querySelector<HTMLFormElement>(
      '[data-testid="modal-form"]',
    );
    expect(form?.dataset["kind"]).toBe("BusinessScoreCardNode");
    expect(
      kindButtonOf(el, "BusinessScoreCardNode").getAttribute("aria-pressed"),
    ).toBe("true");
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

/**
 * SPEC §17.119 — `<add-child-modal>` Picture kind branch.
 *
 * Picture is the simplest of the three add-child forms: title +
 * weight + a non-empty image URL, no description / no objective /
 * no current-value seed / no toggles. The branch must:
 *   - render `field-image-url` (and only the picture-relevant
 *     fields) when `PictureNode` is picked;
 *   - gate Confirm on title AND imageUrl being non-empty;
 *   - dispatch an `AddChildConfirmDetail` with `kind: "PictureNode"`,
 *     the trimmed URL, and the chosen weight when Confirm fires;
 *   - reset the URL when the modal re-opens.
 */
async function pickPicture(el: AddChildModal): Promise<void> {
  // `pickKind` is the local helper used by sibling tests; reuse so
  // future "click route to a kind" tests stay consistent.
  const btn = el.shadowRoot?.querySelector<HTMLButtonElement>(
    '[data-testid="kind-btn"][data-kind="PictureNode"]',
  );
  if (!btn) throw new Error("expected PictureNode kind-btn");
  btn.click();
  await el.updateComplete;
}

describe("<add-child-modal> PictureNode branch (§17.119)", () => {
  it("PictureNode is part of the default availableKinds catalogue (ALL_ADD_CHILD_KINDS)", () => {
    expect(ALL_ADD_CHILD_KINDS).toContain("PictureNode");
  });

  it("picking PictureNode renders only the picture-relevant fields (title + weight + imageUrl)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickPicture(el);

    const form = el.shadowRoot?.querySelector<HTMLFormElement>(
      '[data-testid="modal-form"]',
    );
    expect(form).not.toBeNull();
    expect(form?.dataset["kind"]).toBe("PictureNode");

    expect(
      el.shadowRoot?.querySelector('[data-testid="field-title"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-image-url"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-weight"]'),
    ).not.toBeNull();
    // BSC-only fields stay hidden.
    expect(el.shadowRoot?.querySelector('[data-testid="field-description"]')).toBeNull();
    expect(el.shadowRoot?.querySelector('[data-testid="field-unit"]')).toBeNull();
    expect(el.shadowRoot?.querySelector('[data-testid="field-initial"]')).toBeNull();
    expect(el.shadowRoot?.querySelector('[data-testid="field-target"]')).toBeNull();
    // TextNode-only seed (current-value) field stays hidden.
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-current-value"]'),
    ).toBeNull();
  });

  it("placeholder on field-image-url matches the §6 '<Field name> — e.g. <mock>' pattern", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickPicture(el);
    const img = fieldOf(el, "field-image-url") as HTMLInputElement;
    expect(img.placeholder).toMatch(/^Image URL — e\.g\./);
    expect(img.type).toBe("url");
  });

  it("Confirm stays disabled when title is blank, even if imageUrl is filled", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickPicture(el);
    await setInput(el, "field-image-url", "https://example.com/p.jpg");
    expect(confirmBtnOf(el).disabled).toBe(true);
  });

  it("Confirm stays disabled when imageUrl is blank (or whitespace-only), even if title is filled", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickPicture(el);
    await setInput(el, "field-title", "Office photo");
    expect(confirmBtnOf(el).disabled).toBe(true);
    await setInput(el, "field-image-url", "   ");
    expect(confirmBtnOf(el).disabled).toBe(true);
  });

  it("Confirm enables once title + imageUrl are both non-empty", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickPicture(el);
    await setInput(el, "field-title", "Plan A");
    await setInput(el, "field-image-url", "https://example.com/x.png");
    expect(confirmBtnOf(el).disabled).toBe(false);
  });

  it("Confirm dispatches add-child-confirm with kind=PictureNode + trimmed imageUrl + chosen weight", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
        e.parentId = "uuid-parent-pic";
      },
    );
    await pickPicture(el);
    await setInput(el, "field-title", "Office plan");
    // Surrounding whitespace must be trimmed in the payload (matches
    // `PictureNode.normaliseImageUrl` domain contract).
    await setInput(el, "field-image-url", "  https://example.com/o.jpg  ");
    await setInput(el, "field-weight", "2");

    const handler = vi.fn();
    el.addEventListener("add-child-confirm", handler);
    confirmBtnOf(el).click();

    expect(handler).toHaveBeenCalledTimes(1);
    const ev = handler.mock.calls[0]![0] as CustomEvent<AddChildConfirmDetail>;
    expect(ev.bubbles).toBe(true);
    expect(ev.composed).toBe(true);
    expect(ev.detail.parentId).toBe("uuid-parent-pic");
    expect(ev.detail.payload).toEqual({
      kind: "PictureNode",
      title: "Office plan",
      weight: 2,
      imageUrl: "https://example.com/o.jpg",
    });
  });

  it("re-opening the modal clears the previously-entered imageUrl (resetForm runs on open=true)", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickPicture(el);
    await setInput(el, "field-image-url", "https://example.com/stale.jpg");
    // Close + reopen.
    el.open = false;
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    // No kind chosen yet on the fresh open; pick Picture again to
    // surface the image-url field.
    await pickPicture(el);
    const img = fieldOf(el, "field-image-url") as HTMLInputElement;
    expect(img.value).toBe("");
  });

  it("placeholder pattern: every text/number/url/date input on the Picture form matches '<Field name> — e.g. <mock>'", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickPicture(el);
    const fields = Array.from(
      el.shadowRoot?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        '[data-testid="modal-form"] input[type="text"], [data-testid="modal-form"] input[type="number"], [data-testid="modal-form"] input[type="url"], [data-testid="modal-form"] input[type="date"], [data-testid="modal-form"] textarea',
      ) ?? [],
    );
    expect(fields.length).toBeGreaterThan(0);
    for (const f of fields) {
      expect(f.placeholder).toMatch(/^[A-Z].* — e\.g\./);
    }
  });
});

/**
 * SPEC §17.118 — `Workflow` is a sibling of TextNode that adds a
 * board-level status badge. The form mirrors TextNode (title +
 * weight + current value + as-of date) and adds a single status
 * dropdown sourced from {@link AddChildModal.workflowStatuses}; the
 * payload is the TextNode payload plus a mandatory `statusId`.
 */
describe("<add-child-modal> Workflow form (SPEC §17.118)", () => {
  it("picking Workflow renders the form with the status dropdown and a current-value seed row", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickWorkflow(el);
    const form = el.shadowRoot?.querySelector<HTMLFormElement>(
      '[data-testid="modal-form"]',
    );
    expect(form?.dataset["kind"]).toBe("Workflow");
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-status"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-current-value"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-current-value-date"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-unit"]'),
    ).toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-initial"]'),
    ).toBeNull();
  });

  it("the status dropdown shows one option per `workflowStatuses` entry, pre-selecting the first", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickWorkflow(el);
    const select = el.shadowRoot?.querySelector<HTMLSelectElement>(
      '[data-testid="field-status"]',
    );
    expect(select).not.toBeNull();
    const options = Array.from(select?.querySelectorAll("option") ?? []);
    // §17.118 — default catalogue is PDCA (4 entries) seeded at modal init.
    expect(options.map((o) => o.value)).toEqual(["plan", "do", "check", "act"]);
    expect(select?.value).toBe("plan");
  });

  it("Confirm stays disabled until title + current value + as-of date + statusId are all set", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickWorkflow(el);
    // §17.13 -- the "as of" date pre-fills with today's ISO at open,
    // so we blank it here to test the gating contract end-to-end.
    await setInput(el, "field-current-value-date", "");
    expect(confirmBtnOf(el).disabled).toBe(true);
    await setInput(el, "field-title", "Sprint planning");
    expect(confirmBtnOf(el).disabled).toBe(true);
    await setInput(el, "field-current-value", "Define the backlog cut.");
    expect(confirmBtnOf(el).disabled).toBe(true);
    await setInput(el, "field-current-value-date", "2026-04-30");
    expect(confirmBtnOf(el).disabled).toBe(false);
  });

  it("clicking Confirm fires `add-child-confirm` with a Workflow payload carrying statusId + the TextNode seed", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
        e.parentId = "uuid-parent";
      },
    );
    const handler = vi.fn();
    el.addEventListener(ADD_CHILD_CONFIRM_EVENT, handler);

    await pickWorkflow(el);
    await setInput(el, "field-title", "Sprint planning");
    await setSelect(el, "field-status", "do");
    await setInput(el, "field-current-value", "Define the backlog cut.");
    await setInput(el, "field-current-value-date", "2026-04-30");
    confirmBtnOf(el).click();

    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0]?.[0] as
      | CustomEvent<AddChildConfirmDetail>
      | undefined;
    const p = evt?.detail.payload;
    expect(p?.kind).toBe("Workflow");
    if (p?.kind !== "Workflow") return;
    expect(p.title).toBe("Sprint planning");
    expect(p.statusId).toBe("do");
    expect(p.weight).toBe(1);
    expect(p.initialHistory).toHaveLength(1);
    const seed = p.initialHistory?.[0];
    expect(seed?.value).toBe("Define the backlog cut.");
    expect(seed?.asOf).toBeInstanceOf(Date);
    expect(seed?.asOf.toISOString()).toBe("2026-04-30T00:00:00.000Z");
  });

  it("narrowing `workflowStatuses` mid-edit drops an orphan pick and snaps to the first remaining entry", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickWorkflow(el);
    await setSelect(el, "field-status", "act");
    el.workflowStatuses = el.workflowStatuses.filter((s) => s.id !== "act");
    await el.updateComplete;
    const select = el.shadowRoot?.querySelector<HTMLSelectElement>(
      '[data-testid="field-status"]',
    );
    // §17.118 — the willUpdate guard reassigns `statusId` to the first
    // surviving entry so a stale pick can't sneak into a confirm payload.
    expect(select?.value).toBe("plan");
  });
});
