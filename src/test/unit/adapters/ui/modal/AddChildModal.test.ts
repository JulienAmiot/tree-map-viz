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
  });

  it("picking BusinessScoreCard exposes unit + objective + toggle fields", async () => {
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
      el.shadowRoot?.querySelector('[data-testid="field-computed"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-eligible"]'),
    ).not.toBeNull();
  });

  it("Confirm is disabled until required fields are filled (TextNode = title only)", async () => {
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
    expect(confirmBtnOf(el).disabled).toBe(false);
  });

  it("Confirm is disabled for BSC until title + unit + objective fields are filled", async () => {
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
    expect(confirmBtnOf(el).disabled).toBe(false);
  });

  it("clicking Confirm fires `add-child-confirm` with the parentId + a TextNode payload", async () => {
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
    await setInput(el, "field-description", "Some context");
    await setInput(el, "field-weight", "2");
    confirmBtnOf(el).click();

    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0]?.[0] as
      | CustomEvent<AddChildConfirmDetail>
      | undefined;
    expect(evt?.bubbles).toBe(true);
    expect(evt?.composed).toBe(true);
    expect(evt?.detail.parentId).toBe("uuid-parent");
    expect(evt?.detail.payload).toEqual({
      kind: "TextNode",
      title: "Quick note",
      description: "Some context",
      weight: 2,
    });
  });

  it("clicking Confirm fires `add-child-confirm` with a BusinessScoreCard payload (numbers parsed, date as Date)", async () => {
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
    confirmBtnOf(el).click();

    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0]?.[0] as
      | CustomEvent<AddChildConfirmDetail>
      | undefined;
    const p = evt?.detail.payload;
    expect(p?.kind).toBe("BusinessScoreCardNode");
    if (p?.kind !== "BusinessScoreCardNode") return; // narrow
    expect(p.title).toBe("Revenue");
    expect(p.unit).toBe("M€");
    expect(p.objective.initialValue).toBe(10);
    expect(p.objective.targetValue).toBe(120);
    expect(p.objective.targetDate).toBeInstanceOf(Date);
    expect(p.objective.targetDate.toISOString()).toBe("2027-03-31T00:00:00.000Z");
    expect(p.computed).toBe(false);
    expect(p.eligibleForParentComputation).toBe(true);
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
  it("every input/textarea on the TextNode form has a placeholder starting with 'e.g.'", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    await pickText(el);
    const fields = Array.from(
      el.shadowRoot?.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement
      >('[data-testid="modal-form"] input[type="text"], [data-testid="modal-form"] input[type="number"], [data-testid="modal-form"] textarea') ?? [],
    );
    expect(fields.length).toBeGreaterThan(0);
    for (const f of fields) {
      expect(f.placeholder).toMatch(/^e\.g\./);
    }
  });

  it("every text/number/date/textarea on the BSC form has a placeholder starting with 'e.g.'", async () => {
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
      expect(f.placeholder).toMatch(/^e\.g\./);
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
