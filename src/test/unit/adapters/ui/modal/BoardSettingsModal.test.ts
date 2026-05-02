import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../adapters/ui/modal/BoardSettingsModal.js";
import {
  BOARD_SETTINGS_CANCEL_EVENT,
  BOARD_SETTINGS_CONFIRM_EVENT,
  BOARD_SETTINGS_DELETE_EVENT,
  type BoardSettingsConfirmDetail,
  type BoardSettingsDeleteDetail,
  type BoardSettingsModal,
  type BoardSettingsTarget,
} from "../../../../../adapters/ui/modal/BoardSettingsModal.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

const baseTarget: BoardSettingsTarget = {
  boardId: "uuid-board-1",
  name: "Showcase",
  canDelete: true,
};

function fieldOf(el: BoardSettingsModal, testid: string): HTMLElement {
  const f = el.shadowRoot?.querySelector<HTMLElement>(
    `[data-testid="${testid}"]`,
  );
  if (!f) throw new Error(`expected element [${testid}]`);
  return f;
}

function maybe(el: BoardSettingsModal, testid: string): HTMLElement | null {
  return (
    el.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testid}"]`) ??
    null
  );
}

async function setText(
  el: BoardSettingsModal,
  testid: string,
  value: string,
): Promise<void> {
  const inp = fieldOf(el, testid) as HTMLInputElement;
  inp.value = value;
  inp.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  await el.updateComplete;
}

describe("<board-settings-modal> (SPEC \u00a717.31, simplified by \u00a717.42)", () => {
  // §17.42 retired the per-board fresh-date colour. The modal's only
  // editable field is now `name`; the colour picker, hex text input,
  // and their validation flow are gone. Delete-with-inline-confirm
  // (§17.31) is unchanged.

  it("renders nothing when closed", async () => {
    const el = await mountLitElement<BoardSettingsModal>(
      "board-settings-modal",
    );
    expect(maybe(el, "board-settings-modal")).toBeNull();
  });

  it("renders the form pre-filled from the target when open (name only)", async () => {
    const el = await mountLitElement<BoardSettingsModal>(
      "board-settings-modal",
      (e) => {
        e.target = baseTarget;
        e.open = true;
      },
    );
    expect(maybe(el, "board-settings-modal")).not.toBeNull();
    expect((fieldOf(el, "field-name") as HTMLInputElement).value).toBe(
      "Showcase",
    );
    // §17.42 — colour controls are no longer rendered.
    expect(maybe(el, "field-color")).toBeNull();
    expect(maybe(el, "field-color-hex")).toBeNull();
    expect(maybe(el, "color-control")).toBeNull();
  });

  it("Save dispatches `board-settings-confirm` with the trimmed name", async () => {
    const el = await mountLitElement<BoardSettingsModal>(
      "board-settings-modal",
      (e) => {
        e.target = baseTarget;
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(BOARD_SETTINGS_CONFIRM_EVENT, handler);

    await setText(el, "field-name", "  Renamed Showcase  ");
    (fieldOf(el, "modal-confirm") as HTMLButtonElement).click();
    await el.updateComplete;

    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0]?.[0] as
      | CustomEvent<BoardSettingsConfirmDetail>
      | undefined;
    expect(evt?.detail.boardId).toBe("uuid-board-1");
    expect(evt?.detail.name).toBe("Renamed Showcase");
    // §17.42 — payload no longer carries a colour.
    expect((evt?.detail as Record<string, unknown>).freshDateColor).toBeUndefined();
    expect(evt?.bubbles).toBe(true);
    expect(evt?.composed).toBe(true);
  });

  it("Save is disabled when the name is blanked", async () => {
    // §17.31 — empty name is the only required-field gate. Mirrors
    // `BoardCollectionService.updateSettings` which rejects an empty
    // `name`. §17.42 removed the second gate (valid hex colour) so
    // name is now the *only* required field.
    const el = await mountLitElement<BoardSettingsModal>(
      "board-settings-modal",
      (e) => {
        e.target = baseTarget;
        e.open = true;
      },
    );
    await setText(el, "field-name", "   ");
    const btn = fieldOf(el, "modal-confirm") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("Cancel dispatches `board-settings-cancel`", async () => {
    const el = await mountLitElement<BoardSettingsModal>(
      "board-settings-modal",
      (e) => {
        e.target = baseTarget;
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(BOARD_SETTINGS_CANCEL_EVENT, handler);
    (fieldOf(el, "modal-cancel") as HTMLButtonElement).click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("close-X dispatches `board-settings-cancel` (SPEC \u00a717.29 shared frame)", async () => {
    const el = await mountLitElement<BoardSettingsModal>(
      "board-settings-modal",
      (e) => {
        e.target = baseTarget;
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(BOARD_SETTINGS_CANCEL_EVENT, handler);
    const xBtn = fieldOf(el, "modal-close-x") as HTMLButtonElement;
    xBtn.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  describe("delete-with-inline-confirm (\u00a717.31)", () => {
    it("Delete button is enabled when the collection has > 1 board", async () => {
      const el = await mountLitElement<BoardSettingsModal>(
        "board-settings-modal",
        (e) => {
          e.target = baseTarget;
          e.open = true;
        },
      );
      const btn = fieldOf(el, "delete-board") as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it("Delete button is disabled when canDelete=false (last remaining board)", async () => {
      const el = await mountLitElement<BoardSettingsModal>(
        "board-settings-modal",
        (e) => {
          e.target = { ...baseTarget, canDelete: false };
          e.open = true;
        },
      );
      const btn = fieldOf(el, "delete-board") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("a single tap arms the inline confirm prompt; second tap dispatches `board-settings-delete`", async () => {
      const el = await mountLitElement<BoardSettingsModal>(
        "board-settings-modal",
        (e) => {
          e.target = baseTarget;
          e.open = true;
        },
      );
      const handler = vi.fn();
      el.addEventListener(BOARD_SETTINGS_DELETE_EVENT, handler);

      (fieldOf(el, "delete-board") as HTMLButtonElement).click();
      await el.updateComplete;
      expect(maybe(el, "delete-confirm-prompt")).not.toBeNull();
      expect(handler).not.toHaveBeenCalled();

      (fieldOf(el, "confirm-delete") as HTMLButtonElement).click();
      await el.updateComplete;
      expect(handler).toHaveBeenCalledTimes(1);
      const evt = handler.mock.calls[0]?.[0] as
        | CustomEvent<BoardSettingsDeleteDetail>
        | undefined;
      expect(evt?.detail.boardId).toBe("uuid-board-1");
    });

    it("the Keep board button disarms the inline confirm without dispatching", async () => {
      const el = await mountLitElement<BoardSettingsModal>(
        "board-settings-modal",
        (e) => {
          e.target = baseTarget;
          e.open = true;
        },
      );
      const handler = vi.fn();
      el.addEventListener(BOARD_SETTINGS_DELETE_EVENT, handler);

      (fieldOf(el, "delete-board") as HTMLButtonElement).click();
      await el.updateComplete;
      (fieldOf(el, "cancel-delete") as HTMLButtonElement).click();
      await el.updateComplete;

      expect(handler).not.toHaveBeenCalled();
      expect(maybe(el, "delete-confirm-prompt")).toBeNull();
      expect(maybe(el, "delete-board")).not.toBeNull();
    });

    it("re-opening the modal disarms the inline confirm prompt", async () => {
      const el = await mountLitElement<BoardSettingsModal>(
        "board-settings-modal",
        (e) => {
          e.target = baseTarget;
          e.open = true;
        },
      );
      (fieldOf(el, "delete-board") as HTMLButtonElement).click();
      await el.updateComplete;
      expect(maybe(el, "delete-confirm-prompt")).not.toBeNull();

      el.open = false;
      await el.updateComplete;
      el.open = true;
      await el.updateComplete;

      expect(maybe(el, "delete-confirm-prompt")).toBeNull();
      expect(maybe(el, "delete-board")).not.toBeNull();
    });
  });

  it("renders the inline error when errorMessage is set", async () => {
    const el = await mountLitElement<BoardSettingsModal>(
      "board-settings-modal",
      (e) => {
        e.target = baseTarget;
        e.open = true;
        e.errorMessage = "Something went wrong";
      },
    );
    const err = fieldOf(el, "modal-error");
    expect(err.textContent?.trim()).toBe("Something went wrong");
  });
});
