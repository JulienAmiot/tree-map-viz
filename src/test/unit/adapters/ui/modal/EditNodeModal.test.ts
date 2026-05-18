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
      // and objective are still modal-only. The v3-era `computed` +
      // `eligibleForParentComputation` checkboxes retired post-§17.99b/c.
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
      // Retired checkboxes must not be present in the BSC form anymore.
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-computed"]'),
      ).toBeNull();
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-eligible"]'),
      ).toBeNull();
    });

    it("dispatches edit-node-confirm with a BSC payload (no title) on confirm", async () => {
      // SPEC §17.50 -- the payload omits `title`; `EditNodeService`
      // treats undefined title as "do not touch". The other modal-
      // editable fields (description, unit, objective) still flow
      // through this confirm path. The v3-era `computed` +
      // `eligibleForParentComputation` checkboxes retired post-§17.99b/c.
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = bscTarget;
        e.open = true;
      });
      const handler = vi.fn();
      el.addEventListener(EDIT_NODE_CONFIRM_EVENT, handler);

      await setInput(el, "field-unit", "%");
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

  /**
   * SPEC §17.119 — `<edit-node-modal>` PictureNode branch.
   *
   * Picture is the simplest edit form: weight slider + image URL
   * input (no description / unit / objective / toggles). Title
   * lives on the inline editor per §17.50. The branch must:
   *   - seed `imageUrl` from `target.imageUrl` on open;
   *   - render `field-image-url` and only the picture-relevant
   *     fields;
   *   - hide every BSC-only field (unit / initial / target /
   *     target-date / computed / eligible / description);
   *   - keep Confirm enabled while `imageUrl` is non-empty (the
   *     domain requires a non-empty URL — the modal mirrors that
   *     gate);
   *   - disable Confirm if the operator blanks the URL;
   *   - dispatch a payload of shape
   *     `{ kind: "PictureNode", imageUrl, weight? }` on confirm.
   */
  describe("PictureNode target (§17.119)", () => {
    const pictureTarget: EditNodeTarget = {
      nodeId: "uuid-pic",
      kind: "PictureNode",
      title: "Office floor plan",
      weight: 1.5,
      imageUrl: "https://example.com/floor.jpg",
    };

    it("seeds weight + imageUrl from the target on open; no title field (§17.50 parity)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = pictureTarget;
        e.open = true;
      });
      expect(panelOf(el)?.dataset["kind"]).toBe("PictureNode");
      expect((fieldOf(el, "field-weight") as HTMLInputElement).value).toBe("1.5");
      expect(
        (fieldOf(el, "field-image-url") as HTMLInputElement).value,
      ).toBe("https://example.com/floor.jpg");
      // §17.50 — title is edited inline, not via the modal.
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-title"]'),
      ).toBeNull();
    });

    it("hides every BSC-only field (description / unit / objective)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = pictureTarget;
        e.open = true;
      });
      const hidden = [
        "field-description",
        "field-unit",
        "field-initial",
        "field-target",
        "field-target-date",
      ];
      for (const id of hidden) {
        expect(el.shadowRoot?.querySelector(`[data-testid="${id}"]`)).toBeNull();
      }
    });

    it("placeholder on field-image-url matches the §6 '<Field name> — e.g. <mock>' pattern + uses type=url", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = pictureTarget;
        e.open = true;
      });
      const img = fieldOf(el, "field-image-url") as HTMLInputElement;
      expect(img.placeholder).toMatch(/^Image URL — e\.g\./);
      expect(img.type).toBe("url");
    });

    it("Confirm stays enabled while imageUrl is non-empty (the seed URL is valid by construction)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = pictureTarget;
        e.open = true;
      });
      expect(confirmBtn(el).disabled).toBe(false);
    });

    it("Confirm disables when the operator blanks the URL (gates on PictureNode.normaliseImageUrl)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = pictureTarget;
        e.open = true;
      });
      await setInput(el, "field-image-url", "   ");
      expect(confirmBtn(el).disabled).toBe(true);
    });

    it("Confirm dispatches edit-node-confirm with kind=PictureNode + trimmed imageUrl + chosen weight", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = pictureTarget;
        e.open = true;
      });
      // Replace both fields with new values; whitespace around the
      // URL must be trimmed in the dispatched payload (matches
      // PictureNode.normaliseImageUrl).
      await setInput(el, "field-image-url", "  https://example.com/new.png  ");
      await setInput(el, "field-weight", "2.5");

      const handler = vi.fn();
      el.addEventListener(EDIT_NODE_CONFIRM_EVENT, handler);
      confirmBtn(el).click();

      expect(handler).toHaveBeenCalledTimes(1);
      const ev = handler.mock.calls[0]![0] as CustomEvent<EditNodeConfirmDetail>;
      expect(ev.bubbles).toBe(true);
      expect(ev.composed).toBe(true);
      expect(ev.detail.nodeId).toBe("uuid-pic");
      expect(ev.detail.payload).toEqual({
        kind: "PictureNode",
        weight: 2.5,
        imageUrl: "https://example.com/new.png",
      });
    });

    it("re-seeds the image URL when the target swaps mid-open (Text → Picture)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = textTarget;
        e.open = true;
      });
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-image-url"]'),
      ).toBeNull();
      el.editTarget = pictureTarget;
      await el.updateComplete;
      expect((fieldOf(el, "field-image-url") as HTMLInputElement).value).toBe(
        "https://example.com/floor.jpg",
      );
      // BSC-only fields stay hidden after the swap.
      expect(el.shadowRoot?.querySelector('[data-testid="field-unit"]')).toBeNull();
    });

    it("swapping Picture → BSC clears the imageUrl and brings the BSC-only fields back", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = pictureTarget;
        e.open = true;
      });
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-image-url"]'),
      ).not.toBeNull();
      el.editTarget = bscTarget;
      await el.updateComplete;
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-image-url"]'),
      ).toBeNull();
      expect(
        (fieldOf(el, "field-unit") as HTMLInputElement).value,
      ).toBe("M\u20ac");
    });
  });

  /**
   * SPEC §17.118 — the Workflow branch of `EditNodeTarget` exposes the
   * node's current `statusId`. The modal seeds the dropdown from that
   * id, the operator can swap it, and the confirm payload carries an
   * explicit `statusId` only when the operator typed (or selected) one.
   * Title is still edited inline (§17.50); the modal payload never
   * carries it.
   */
  describe("Workflow target (SPEC §17.118)", () => {
    const workflowTarget: EditNodeTarget = {
      nodeId: "uuid-workflow",
      kind: "Workflow",
      title: "Sprint planning",
      weight: 2,
      statusId: "do",
    };

    it("renders the status dropdown seeded with the target's statusId, and weight only (no BSC fields, no title)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = workflowTarget;
        e.open = true;
      });
      expect(panelOf(el)?.dataset["kind"]).toBe("Workflow");
      expect(
        el.shadowRoot?.querySelector('[data-testid="edit-modal-kind"]')
          ?.textContent?.trim(),
      ).toBe("Workflow");
      const select = el.shadowRoot?.querySelector<HTMLSelectElement>(
        '[data-testid="field-status"]',
      );
      expect(select?.value).toBe("do");
      expect((fieldOf(el, "field-weight") as HTMLInputElement).value).toBe("2");
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-unit"]'),
      ).toBeNull();
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-initial"]'),
      ).toBeNull();
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-title"]'),
      ).toBeNull();
    });

    it("dispatches edit-node-confirm with a Workflow payload carrying the new statusId on confirm", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = workflowTarget;
        e.open = true;
      });
      const handler = vi.fn();
      el.addEventListener(EDIT_NODE_CONFIRM_EVENT, handler);
      const select = el.shadowRoot?.querySelector<HTMLSelectElement>(
        '[data-testid="field-status"]',
      );
      if (!select) throw new Error("expected status dropdown");
      select.value = "check";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await el.updateComplete;
      confirmBtn(el).click();

      expect(handler).toHaveBeenCalledTimes(1);
      const evt = handler.mock.calls[0]![0] as CustomEvent<EditNodeConfirmDetail>;
      expect(evt.detail.nodeId).toBe("uuid-workflow");
      expect(evt.detail.payload).toEqual({
        kind: "Workflow",
        weight: 2,
        statusId: "check",
      });
    });

    it("surfaces an orphan statusId (board's catalogue trimmed) as a selected '— missing' option so the operator can swap it", async () => {
      const orphanTarget: EditNodeTarget = {
        ...workflowTarget,
        statusId: "ghost",
      };
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = orphanTarget;
        e.open = true;
      });
      const select = el.shadowRoot?.querySelector<HTMLSelectElement>(
        '[data-testid="field-status"]',
      );
      expect(select?.value).toBe("ghost");
      const options = Array.from(select?.querySelectorAll("option") ?? []);
      expect(options[0]?.value).toBe("ghost");
      expect(options[0]?.textContent).toMatch(/missing/);
      expect(options.map((o) => o.value)).toContain("plan");
    });
  });

  /**
   * SPEC §17.120 — `<edit-node-modal>` URLNode branch. Mirrors the
   * §17.119 Picture branch structurally: weight slider + a single
   * URL input (no description / unit / objective / toggles). Title
   * lives on the inline editor per §17.50. The branch must:
   *   - seed `url` from `target.url` on open (the target carries the
   *     URL on `url`, surfaced by the URLNode.url getter — the
   *     domain-internal description slot is intentionally invisible
   *     to the modal seam);
   *   - render `field-url` and only the URL-relevant fields;
   *   - hide every BSC-only / Picture-only field;
   *   - keep Confirm enabled while `url` is non-empty (the domain
   *     requires a non-empty URL — the modal mirrors that gate);
   *   - disable Confirm if the operator blanks the URL;
   *   - dispatch a payload of shape
   *     `{ kind: "URLNode", url, weight? }` on confirm.
   */
  describe("URLNode target (§17.120)", () => {
    const urlTarget: EditNodeTarget = {
      nodeId: "uuid-url",
      kind: "URLNode",
      title: "Docs",
      weight: 1.5,
      url: "https://example.com/docs",
    };

    it("seeds weight + url from the target on open; no title field (§17.50 parity)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = urlTarget;
        e.open = true;
      });
      expect(panelOf(el)?.dataset["kind"]).toBe("URLNode");
      expect((fieldOf(el, "field-weight") as HTMLInputElement).value).toBe("1.5");
      expect(
        (fieldOf(el, "field-url") as HTMLInputElement).value,
      ).toBe("https://example.com/docs");
      // §17.50 — title is edited inline, not via the modal.
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-title"]'),
      ).toBeNull();
    });

    it("hides every BSC-only / Picture-only field (description / unit / objective / toggles / field-image-url)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = urlTarget;
        e.open = true;
      });
      const hidden = [
        "field-description",
        "field-unit",
        "field-initial",
        "field-target",
        "field-target-date",
        "field-image-url",
      ];
      for (const id of hidden) {
        expect(el.shadowRoot?.querySelector(`[data-testid="${id}"]`)).toBeNull();
      }
    });

    it("placeholder on field-url matches the §6 '<Field name> — e.g. <mock>' pattern + uses type=url for the platform URL keyboard", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = urlTarget;
        e.open = true;
      });
      const input = fieldOf(el, "field-url") as HTMLInputElement;
      expect(input.placeholder).toMatch(/^URL — e\.g\./);
      expect(input.type).toBe("url");
    });

    it("Confirm stays enabled while url is non-empty (the seed URL is valid by construction)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = urlTarget;
        e.open = true;
      });
      expect(confirmBtn(el).disabled).toBe(false);
    });

    it("Confirm disables when the operator blanks the URL (gates on URLNode.normaliseUrl)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = urlTarget;
        e.open = true;
      });
      await setInput(el, "field-url", "   ");
      expect(confirmBtn(el).disabled).toBe(true);
    });

    it("Confirm dispatches edit-node-confirm with kind=URLNode + trimmed url + chosen weight", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = urlTarget;
        e.open = true;
      });
      // Replace both fields with new values; whitespace around the
      // URL must be trimmed in the dispatched payload (matches
      // URLNode.normaliseUrl).
      await setInput(el, "field-url", "  https://example.com/new  ");
      await setInput(el, "field-weight", "2.5");

      const handler = vi.fn();
      el.addEventListener(EDIT_NODE_CONFIRM_EVENT, handler);
      confirmBtn(el).click();

      expect(handler).toHaveBeenCalledTimes(1);
      const ev = handler.mock.calls[0]![0] as CustomEvent<EditNodeConfirmDetail>;
      expect(ev.bubbles).toBe(true);
      expect(ev.composed).toBe(true);
      expect(ev.detail.nodeId).toBe("uuid-url");
      expect(ev.detail.payload).toEqual({
        kind: "URLNode",
        weight: 2.5,
        url: "https://example.com/new",
      });
    });

    it("re-seeds the url when the target swaps mid-open (Text → URL)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = textTarget;
        e.open = true;
      });
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-url"]'),
      ).toBeNull();
      el.editTarget = urlTarget;
      await el.updateComplete;
      expect((fieldOf(el, "field-url") as HTMLInputElement).value).toBe(
        "https://example.com/docs",
      );
      // BSC-only fields stay hidden after the swap.
      expect(el.shadowRoot?.querySelector('[data-testid="field-unit"]')).toBeNull();
    });

    it("swapping URL → Picture clears the url and brings the field-image-url back (kind-specific seeds stay isolated)", async () => {
      // SPEC §17.120 — `seedFromTarget` clears every kind-specific
      // slot on transition, so an operator who edited a URL node
      // and then swapped to a Picture node sees a fresh imageUrl
      // input (no stale URL leak into the picture form).
      const pictureTarget: EditNodeTarget = {
        nodeId: "uuid-pic",
        kind: "PictureNode",
        title: "Floor plan",
        weight: 1,
        imageUrl: "https://example.com/floor.jpg",
      };
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = urlTarget;
        e.open = true;
      });
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-url"]'),
      ).not.toBeNull();
      el.editTarget = pictureTarget;
      await el.updateComplete;
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-url"]'),
      ).toBeNull();
      expect(
        (fieldOf(el, "field-image-url") as HTMLInputElement).value,
      ).toBe("https://example.com/floor.jpg");
    });

    it("swapping URL → BSC clears the url and brings the BSC-only fields back", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = urlTarget;
        e.open = true;
      });
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-url"]'),
      ).not.toBeNull();
      el.editTarget = bscTarget;
      await el.updateComplete;
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-url"]'),
      ).toBeNull();
      expect(
        (fieldOf(el, "field-unit") as HTMLInputElement).value,
      ).toBe("M\u20ac");
    });
  });

  /**
   * StrictRangeNode editing (SPEC §17.77 / §17.94).
   *
   * The application service's `StrictRange` edit shape is `CommonEdit`
   * only (title + weight + disabled + description). The modal therefore
   * collects only description + weight and surfaces the structural
   * `[min, max]` bounds as a read-only display so the operator sees the
   * active contract while editing. These tests cover:
   *   - seeding (description + weight + bounds row from the snapshot),
   *   - the hidden fields (every BSC/Picture/URL-only slot stays off),
   *   - the bounds row's read-only nature (no editable inputs),
   *   - the dispatched payload shape on confirm,
   *   - kind-swap isolation (StrictRange → BSC clears the bounds row).
   */
  describe("StrictRangeNode target (§17.77 / §17.94)", () => {
    const strictRangeTarget: EditNodeTarget = {
      nodeId: "uuid-srn",
      kind: "StrictRangeNode",
      title: "Latency budget",
      description: "p99 latency budget per request",
      weight: 1.25,
      bounds: { min: 0, max: 250 },
    };

    it("seeds weight + description + bounds row from the target on open; no title field (§17.50 parity)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = strictRangeTarget;
        e.open = true;
      });
      expect(panelOf(el)?.dataset["kind"]).toBe("StrictRangeNode");
      expect((fieldOf(el, "field-weight") as HTMLInputElement).value).toBe("1.25");
      expect(
        (fieldOf(el, "field-description") as HTMLTextAreaElement).value,
      ).toBe("p99 latency budget per request");
      const bounds = el.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="range-bounds"]',
      );
      expect(bounds?.textContent).toMatch(/0/);
      expect(bounds?.textContent).toMatch(/250/);
      // §17.50 — title is edited inline, not via the modal.
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-title"]'),
      ).toBeNull();
    });

    it("hides every BSC-only / Picture-only / URL-only field (unit / objective / image-url / url)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = strictRangeTarget;
        e.open = true;
      });
      const hidden = [
        "field-unit",
        "field-initial",
        "field-target",
        "field-target-date",
        "field-image-url",
        "field-url",
      ];
      for (const id of hidden) {
        expect(el.shadowRoot?.querySelector(`[data-testid="${id}"]`)).toBeNull();
      }
    });

    it("the range-bounds row carries no editable input (bounds are structural)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = strictRangeTarget;
        e.open = true;
      });
      const row = el.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="range-bounds-row"]',
      );
      expect(row).not.toBeNull();
      // No <input> / <textarea> / <select> inside the bounds row —
      // the bounds are read-only and the application service's
      // `StrictRange` edit shape is `CommonEdit` only.
      expect(row?.querySelector("input")).toBeNull();
      expect(row?.querySelector("textarea")).toBeNull();
      expect(row?.querySelector("select")).toBeNull();
    });

    it("Confirm stays enabled for a StrictRange target (description / weight always usable)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = strictRangeTarget;
        e.open = true;
      });
      expect(confirmBtn(el).disabled).toBe(false);
    });

    it("Confirm dispatches edit-node-confirm with kind=StrictRangeNode + trimmed description + chosen weight", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = strictRangeTarget;
        e.open = true;
      });
      await setInput(el, "field-description", "  p99 budget revised  ");
      await setInput(el, "field-weight", "2");

      const handler = vi.fn();
      el.addEventListener(EDIT_NODE_CONFIRM_EVENT, handler);
      confirmBtn(el).click();

      expect(handler).toHaveBeenCalledTimes(1);
      const ev = handler.mock.calls[0]![0] as CustomEvent<EditNodeConfirmDetail>;
      expect(ev.detail.nodeId).toBe("uuid-srn");
      expect(ev.detail.payload).toEqual({
        kind: "StrictRangeNode",
        weight: 2,
        description: "p99 budget revised",
      });
    });

    it("re-seeds bounds + description when the target swaps mid-open (Text → StrictRange)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = textTarget;
        e.open = true;
      });
      expect(
        el.shadowRoot?.querySelector('[data-testid="range-bounds"]'),
      ).toBeNull();
      el.editTarget = strictRangeTarget;
      await el.updateComplete;
      const bounds = el.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="range-bounds"]',
      );
      expect(bounds?.textContent).toMatch(/0/);
      expect(bounds?.textContent).toMatch(/250/);
      expect(
        (fieldOf(el, "field-description") as HTMLTextAreaElement).value,
      ).toBe("p99 latency budget per request");
    });

    it("swapping StrictRange → BSC clears the bounds row and brings BSC-only fields back (kind-specific seeds stay isolated)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = strictRangeTarget;
        e.open = true;
      });
      expect(
        el.shadowRoot?.querySelector('[data-testid="range-bounds-row"]'),
      ).not.toBeNull();
      el.editTarget = bscTarget;
      await el.updateComplete;
      expect(
        el.shadowRoot?.querySelector('[data-testid="range-bounds-row"]'),
      ).toBeNull();
      expect(
        (fieldOf(el, "field-unit") as HTMLInputElement).value,
      ).toBe("M\u20ac");
    });
  });

  /**
   * ComputedNode editing (SPEC §17.94 / §17.95).
   *
   * The application service's `Computed` edit shape is `CommonEdit`
   * + an optional `computationKind` swap. The modal collects
   * description + weight + a `<select>` dropdown bound to
   * `ComputationKind.ALL`, pre-selecting the snapshot's current
   * strategy. Tests cover:
   *   - seeding (description + weight + selected `<option>`),
   *   - the hidden fields (every BSC/Picture/URL/StrictRange-only
   *     slot stays off),
   *   - the dropdown catalogue (all six kinds listed, friendly
   *     labels from the shared `COMPUTATION_KIND_LABELS`),
   *   - the dispatched payload shape on confirm (canonical
   *     `ComputationKind.name` flows through the wire),
   *   - kind-swap isolation (Text → Computed seeds the dropdown;
   *     Computed → BSC clears it).
   */
  describe("ComputedNode target (§17.94 / §17.95)", () => {
    const computedTarget: EditNodeTarget = {
      nodeId: "uuid-cn",
      kind: "ComputedNode",
      title: "Team velocity",
      description: "Rolling sprint velocity",
      weight: 2,
      computationKindName: "SUM",
    };

    function selectOf(el: EditNodeModal, testid: string): HTMLSelectElement {
      const s = el.shadowRoot?.querySelector<HTMLSelectElement>(
        `[data-testid="${testid}"]`,
      );
      if (!s) throw new Error(`expected <select> [${testid}]`);
      return s;
    }

    it("seeds weight + description + computation-kind dropdown from the target on open", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = computedTarget;
        e.open = true;
      });
      expect(panelOf(el)?.dataset["kind"]).toBe("ComputedNode");
      expect((fieldOf(el, "field-weight") as HTMLInputElement).value).toBe("2");
      expect(
        (fieldOf(el, "field-description") as HTMLTextAreaElement).value,
      ).toBe("Rolling sprint velocity");
      expect(selectOf(el, "field-computation-kind").value).toBe("SUM");
      // §17.50 — title is edited inline, not via the modal.
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-title"]'),
      ).toBeNull();
    });

    it("hides every BSC/Picture/URL/StrictRange-only field (unit / objective / image-url / url / range-bounds)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = computedTarget;
        e.open = true;
      });
      const hidden = [
        "field-unit",
        "field-initial",
        "field-target",
        "field-target-date",
        "field-image-url",
        "field-url",
        "range-bounds-row",
      ];
      for (const id of hidden) {
        expect(el.shadowRoot?.querySelector(`[data-testid="${id}"]`)).toBeNull();
      }
    });

    it("the dropdown lists every `ComputationKind.ALL` inhabitant with the shared friendly label", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = computedTarget;
        e.open = true;
      });
      const opts = Array.from(selectOf(el, "field-computation-kind").options);
      const names = opts.map((o) => o.value);
      expect(names).toEqual(["SUM", "AVERAGE", "MIN", "MAX", "WEIGHTED_AVERAGE", "COUNT"]);
      expect(opts.find((o) => o.value === "SUM")?.textContent).toMatch(/Sum/);
    });

    it("Confirm dispatches edit-node-confirm with kind=ComputedNode + chosen strategy + trimmed description", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = computedTarget;
        e.open = true;
      });
      const select = selectOf(el, "field-computation-kind");
      select.value = "AVERAGE";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await el.updateComplete;
      await setInput(el, "field-description", "  Velocity (rolling)  ");
      await setInput(el, "field-weight", "3");

      const handler = vi.fn();
      el.addEventListener(EDIT_NODE_CONFIRM_EVENT, handler);
      confirmBtn(el).click();

      expect(handler).toHaveBeenCalledTimes(1);
      const ev = handler.mock.calls[0]![0] as CustomEvent<EditNodeConfirmDetail>;
      expect(ev.detail.nodeId).toBe("uuid-cn");
      expect(ev.detail.payload).toEqual({
        kind: "ComputedNode",
        weight: 3,
        description: "Velocity (rolling)",
        computationKindName: "AVERAGE",
      });
    });

    it("swapping Computed → BSC clears the dropdown and brings BSC-only fields back (kind-specific seeds stay isolated)", async () => {
      const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
        e.editTarget = computedTarget;
        e.open = true;
      });
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-computation-kind"]'),
      ).not.toBeNull();
      el.editTarget = bscTarget;
      await el.updateComplete;
      expect(
        el.shadowRoot?.querySelector('[data-testid="field-computation-kind"]'),
      ).toBeNull();
      expect(
        (fieldOf(el, "field-unit") as HTMLInputElement).value,
      ).toBe("M\u20ac");
    });
  });
});
