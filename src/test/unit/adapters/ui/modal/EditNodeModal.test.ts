import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../adapters/ui/modal/EditNodeModal.js";
import {
  EDIT_NODE_CANCEL_EVENT,
  EDIT_NODE_CONFIRM_EVENT,
  type EditNodeConfirmDetail,
  type EditNodeModal,
  type EditNodeTarget,
} from "../../../../../adapters/ui/modal/EditNodeModal.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

const textTarget: EditNodeTarget = {
  nodeId: "uuid-text",
  kind: "TextNode",
  title: "Quarterly review",
  weight: 2,
};

const bscTarget: EditNodeTarget = {
  nodeId: "uuid-bsc",
  kind: "BusinessScoreCardNode",
  title: "Revenue",
  description: "EU-North revenue",
  weight: 3,
  unit: "M\u20ac",
  objective: {
    initialValue: 0,
    targetValue: 100,
    targetDateIso: "2026-12-31",
  },
  computed: false,
  eligibleForParentComputation: true,
};

function panelOf(el: EditNodeModal): HTMLElement | null {
  return (
    el.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="edit-node-modal"]',
    ) ?? null
  );
}

function fieldOf(
  el: EditNodeModal,
  testid: string,
): HTMLInputElement | HTMLTextAreaElement {
  const f = el.shadowRoot?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[data-testid="${testid}"]`,
  );
  if (!f) throw new Error(`expected field [${testid}]`);
  return f;
}

function confirmBtn(el: EditNodeModal): HTMLButtonElement {
  const b = el.shadowRoot?.querySelector<HTMLButtonElement>(
    '[data-testid="edit-modal-confirm"]',
  );
  if (!b) throw new Error("expected edit-modal-confirm button");
  return b;
}

function cancelBtn(el: EditNodeModal): HTMLButtonElement {
  const b = el.shadowRoot?.querySelector<HTMLButtonElement>(
    '[data-testid="edit-modal-cancel"]',
  );
  if (!b) throw new Error("expected edit-modal-cancel button");
  return b;
}

async function setInput(
  el: EditNodeModal,
  testid: string,
  value: string,
): Promise<void> {
  const f = fieldOf(el, testid);
  f.value = value;
  f.dispatchEvent(new Event("input", { bubbles: true }));
  await el.updateComplete;
}

async function setCheckbox(
  el: EditNodeModal,
  testid: string,
  checked: boolean,
): Promise<void> {
  const f = fieldOf(el, testid) as HTMLInputElement;
  f.checked = checked;
  f.dispatchEvent(new Event("change", { bubbles: true }));
  await el.updateComplete;
}

describe("<edit-node-modal>", () => {
  it("renders nothing when open=false (no panel, no backdrop)", async () => {
    const el = await mountLitElement<EditNodeModal>("edit-node-modal");
    expect(el.open).toBe(false);
    expect(panelOf(el)).toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="edit-modal-backdrop"]'),
    ).toBeNull();
  });

  it("renders nothing when open=true but editTarget is null (defensive)", async () => {
    const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
      e.open = true;
    });
    expect(panelOf(el)).toBeNull();
  });

  describe("TextNode target", () => {
    it("seeds weight from the target on open (SPEC \u00a717.50 \u2014 no title field)", async () => {
      // SPEC §17.50 -- title is edited inline from the focused-panel
      // strip; the modal therefore renders no `field-title`. Weight
      // is the only TextNode-editable field through the modal flow.
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = textTarget;
        e.open = true;
      });
      expect(panelOf(el)).not.toBeNull();
      expect((fieldOf(el, "field-weight") as HTMLInputElement).value).toBe("2");
      expect(
        (fieldOf(el, "field-weight-slider") as HTMLInputElement).value,
      ).toBe("2");
    });

    it("does NOT render the title field (SPEC \u00a717.50 \u2014 inline edit only)", async () => {
      // SPEC §17.50 -- the modal MUST NOT carry a title input. Every
      // rename happens through the focused-panel inline editor; the
      // modal covers only fields that have no inline equivalent.
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = textTarget;
        e.open = true;
      });
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-title"]'),
      ).toBeNull();
    });

    it("does NOT render BSC-specific fields (description / unit / objective / toggles)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = textTarget;
        e.open = true;
      });
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-description"]'),
      ).toBeNull();
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-unit"]'),
      ).toBeNull();
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-target-date"]'),
      ).toBeNull();
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-computed"]'),
      ).toBeNull();
    });

    it("dispatches edit-node-confirm with a TextNode payload (no title) on confirm", async () => {
      // SPEC §17.50 -- the payload is title-less by construction; the
      // service skips `payload.title` when undefined, so the focused
      // node's title is preserved across modal-confirm.
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = textTarget;
        e.open = true;
      });
      const handler = vi.fn();
      el.addEventListener(EDIT_NODE_CONFIRM_EVENT, handler);

      await setInput(el, "field-weight", "5");
      confirmBtn(el).click();

      expect(handler).toHaveBeenCalledTimes(1);
      const detail = (
        handler.mock.calls[0]![0] as CustomEvent<EditNodeConfirmDetail>
      ).detail;
      expect(detail.nodeId).toBe("uuid-text");
      expect(detail.payload).toEqual({
        kind: "TextNode",
        weight: 5,
      });
      // SPEC §17.50 -- explicit guard: payload must not carry a title.
      expect(
        (detail.payload as { title?: unknown }).title,
      ).toBeUndefined();
    });

    it("Confirm stays enabled for a TextNode (only weight is editable, slider always has a value)", async () => {
      // SPEC §17.50 -- with the title field gone there is no required
      // text input for TextNode. The slider always has a value, so
      // Confirm stays enabled regardless of the weight input's text.
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = textTarget;
        e.open = true;
      });
      expect(confirmBtn(el).disabled).toBe(false);
    });
  });

  describe("BusinessScoreCardNode target", () => {
    it("seeds every modal-editable field from the target on open (SPEC \u00a717.50 \u2014 no title)", async () => {
      // SPEC §17.50 -- title is intentionally NOT in the modal; it is
      // edited inline from the focused-panel strip. Description, unit,
      // objective, and the two boolean toggles are still modal-only.
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = bscTarget;
        e.open = true;
      });
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-title"]'),
      ).toBeNull();
      expect(
        (fieldOf(el, "field-description") as HTMLTextAreaElement).value,
      ).toBe("EU-North revenue");
      expect((fieldOf(el, "field-unit") as HTMLInputElement).value).toBe(
        "M\u20ac",
      );
      expect((fieldOf(el, "field-initial") as HTMLInputElement).value).toBe(
        "0",
      );
      expect((fieldOf(el, "field-target") as HTMLInputElement).value).toBe(
        "100",
      );
      expect((fieldOf(el, "field-target-date") as HTMLInputElement).value).toBe(
        "2026-12-31",
      );
      expect(
        (fieldOf(el, "field-computed") as HTMLInputElement).checked,
      ).toBe(false);
      expect(
        (fieldOf(el, "field-eligible") as HTMLInputElement).checked,
      ).toBe(true);
    });

    it("dispatches edit-node-confirm with a BSC payload (no title) on confirm", async () => {
      // SPEC §17.50 -- the payload omits `title`; `EditNodeService`
      // treats undefined title as "do not touch". The other modal-
      // editable fields (description, unit, objective, computed,
      // eligible) still flow through this confirm path.
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = bscTarget;
        e.open = true;
      });
      const handler = vi.fn();
      el.addEventListener(EDIT_NODE_CONFIRM_EVENT, handler);

      await setInput(el, "field-unit", "%");
      await setCheckbox(el, "field-computed", true);
      confirmBtn(el).click();

      expect(handler).toHaveBeenCalledTimes(1);
      const detail = (
        handler.mock.calls[0]![0] as CustomEvent<EditNodeConfirmDetail>
      ).detail;
      expect(detail.nodeId).toBe("uuid-bsc");
      expect(detail.payload.kind).toBe("BusinessScoreCardNode");
      if (detail.payload.kind !== "BusinessScoreCardNode") return;
      // SPEC §17.50 -- explicit guard: payload must not carry a title.
      expect(
        (detail.payload as { title?: unknown }).title,
      ).toBeUndefined();
      expect(detail.payload.unit).toBe("%");
      expect(detail.payload.computed).toBe(true);
      expect(detail.payload.objective).toEqual({
        initialValue: 0,
        targetValue: 100,
        targetDate: new Date("2026-12-31T00:00:00.000Z"),
      });
    });

    it("disables Confirm when the unit is blanked", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = bscTarget;
        e.open = true;
      });
      await setInput(el, "field-unit", "");
      expect(confirmBtn(el).disabled).toBe(true);
    });
  });

  describe("close paths", () => {
    it("dispatches edit-node-cancel on Cancel button click", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = textTarget;
        e.open = true;
      });
      const handler = vi.fn();
      el.addEventListener(EDIT_NODE_CANCEL_EVENT, handler);
      cancelBtn(el).click();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("dispatches edit-node-cancel on backdrop tap", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = textTarget;
        e.open = true;
      });
      const handler = vi.fn();
      el.addEventListener(EDIT_NODE_CANCEL_EVENT, handler);
      const bd = el.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="edit-modal-backdrop"]',
      );
      bd?.click();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("dispatches edit-node-cancel on Escape", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = textTarget;
        e.open = true;
      });
      const handler = vi.fn();
      el.addEventListener(EDIT_NODE_CANCEL_EVENT, handler);
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      expect(handler).toHaveBeenCalledTimes(1);
    });

    // SPEC §17.29 — every modal in the app carries a top-right close-X
    // provided by `modalFrameStyles.renderModalCloseX`. Same `data-testid`
    // selector across all modals; firing the same `*-cancel` contract as
    // Cancel / Escape / backdrop.
    it("renders a top-right close-X button (SPEC §17.29 — shared modal frame)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = textTarget;
        e.open = true;
      });
      const closeX = el.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-testid="modal-close-x"]',
      );
      expect(closeX).not.toBeNull();
      expect(closeX?.tagName).toBe("BUTTON");
      expect(closeX?.getAttribute("aria-label")).toBe("Close modal");
    });

    it("dispatches edit-node-cancel on close-X click (SPEC §17.29)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = textTarget;
        e.open = true;
      });
      const handler = vi.fn();
      el.addEventListener(EDIT_NODE_CANCEL_EVENT, handler);
      el.shadowRoot
        ?.querySelector<HTMLButtonElement>('[data-testid="modal-close-x"]')
        ?.click();
      expect(handler).toHaveBeenCalledTimes(1);
      expect(
        (handler.mock.calls[0]?.[0] as CustomEvent | undefined)?.bubbles,
      ).toBe(true);
    });

    it("close-X is absent when the modal is closed (SPEC §17.29)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal");
      expect(el.open).toBe(false);
      expect(
        el.shadowRoot?.querySelector('[data-testid="modal-close-x"]'),
      ).toBeNull();
    });
  });

  it("re-seeds the form when the target swaps mid-open (SPEC \u00a717.50 \u2014 weight + BSC fields)", async () => {
    // SPEC §17.50 -- the modal no longer carries `field-title`. Re-
    // seeding is observable through the weight slider/input (always
    // present) and the BSC-only fields (which appear / disappear
    // when swapping kinds) and the BSC field values when swapping
    // BSC <-> BSC.
    const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
      e.editTarget = textTarget;
      e.open = true;
    });
    expect((fieldOf(el, "field-weight") as HTMLInputElement).value).toBe("2");
    // BSC-only fields are absent on a TextNode target.
    expect(
      el.shadowRoot?.querySelector('[data-testid="field-unit"]'),
    ).toBeNull();
    el.editTarget = bscTarget;
    await el.updateComplete;
    expect((fieldOf(el, "field-weight") as HTMLInputElement).value).toBe("3");
    expect((fieldOf(el, "field-unit") as HTMLInputElement).value).toBe(
      "M\u20ac",
    );
  });

  it("renders the inline error when errorMessage is set after open (composition-root failure path)", async () => {
    // §17.28 -- the modal resets `errorMessage` to null on every open
    // (so a stale message from a previous session never leaks). The
    // composition root sets the error AFTER a failed confirm, by which
    // point `willUpdate` has already run and won't reset.
    const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
      e.editTarget = textTarget;
      e.open = true;
    });
    el.errorMessage = "Title too long";
    await el.updateComplete;
    const err = el.shadowRoot?.querySelector('[data-testid="edit-modal-error"]');
    expect(err?.textContent?.trim()).toBe("Title too long");
  });
});
