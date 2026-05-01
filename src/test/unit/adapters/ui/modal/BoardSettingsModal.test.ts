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
  freshDateColor: "#743089",
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

describe("<board-settings-modal> (SPEC \u00a717.31)", () => {
  it("renders nothing when closed", async () => {
    const el = await mountLitElement<BoardSettingsModal>(
      "board-settings-modal",
    );
    expect(maybe(el, "board-settings-modal")).toBeNull();
  });

  it("renders the form pre-filled from the target when open (name + picker + hex input)", async () => {
    // §17.31 — the modal seeds its inputs from the target on every
    // open so the operator sees the current board's settings rather
    // than blank fields. The hex value lands in BOTH the native
    // colour picker (so the thumb starts at the right hue) AND the
    // editable hex `<input type="text">` (so the operator can type
    // a full hex like `#9000ff`).
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
    expect((fieldOf(el, "field-color") as HTMLInputElement).value).toBe(
      "#743089",
    );
    expect((fieldOf(el, "field-color-hex") as HTMLInputElement).value).toBe(
      "#743089",
    );
  });

  it("Save dispatches `board-settings-confirm` with the trimmed name and current colour", async () => {
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
    expect(evt?.detail.freshDateColor).toBe("#743089");
    expect(evt?.bubbles).toBe(true);
    expect(evt?.composed).toBe(true);
  });

  describe("hex colour text input (\u00a717.31)", () => {
    // SPEC §17.31 — the colour control is a paired native picker +
    // editable hex `<input type="text">`. Both bind to the same
    // canonical state; typing a valid hex repaints the picker, and
    // dragging the picker overwrites the hex field. Save dispatches
    // the canonical lower-case hex regardless of how it was set.

    it("typing a valid hex updates the picker AND dispatches the typed colour", async () => {
      const el = await mountLitElement<BoardSettingsModal>(
        "board-settings-modal",
        (e) => {
          e.target = baseTarget;
          e.open = true;
        },
      );
      const handler = vi.fn();
      el.addEventListener(BOARD_SETTINGS_CONFIRM_EVENT, handler);

      await setText(el, "field-color-hex", "#9000FF");

      // Picker thumb follows the typed value (lower-cased
      // canonical form so the picker accepts it).
      expect((fieldOf(el, "field-color") as HTMLInputElement).value).toBe(
        "#9000ff",
      );

      (fieldOf(el, "modal-confirm") as HTMLButtonElement).click();
      await el.updateComplete;

      expect(handler).toHaveBeenCalledTimes(1);
      const evt = handler.mock.calls[0]?.[0] as
        | CustomEvent<BoardSettingsConfirmDetail>
        | undefined;
      // Dispatched as the canonical lower-case hex regardless of
      // the operator's casing.
      expect(evt?.detail.freshDateColor).toBe("#9000ff");
    });

    it("dragging the picker overwrites the hex text input", async () => {
      const el = await mountLitElement<BoardSettingsModal>(
        "board-settings-modal",
        (e) => {
          e.target = baseTarget;
          e.open = true;
        },
      );
      // Simulate a picker drag (browsers emit `input` events on
      // picker changes with a 7-char hex value).
      await setText(el, "field-color", "#1ea76a");
      expect((fieldOf(el, "field-color-hex") as HTMLInputElement).value).toBe(
        "#1ea76a",
      );
    });

    it("typing an invalid hex disables Save and surfaces an inline help message", async () => {
      // §17.31 — a partial value like `#90` shouldn't reach the
      // service. Save is gated and the input is flagged red so the
      // operator can see why.
      const el = await mountLitElement<BoardSettingsModal>(
        "board-settings-modal",
        (e) => {
          e.target = baseTarget;
          e.open = true;
        },
      );
      await setText(el, "field-color-hex", "#90");
      const btn = fieldOf(el, "modal-confirm") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(maybe(el, "color-hex-help")).not.toBeNull();
    });

    it("typing an invalid hex does NOT lurch the picker (last-known-valid colour stays)", async () => {
      const el = await mountLitElement<BoardSettingsModal>(
        "board-settings-modal",
        (e) => {
          e.target = baseTarget;
          e.open = true;
        },
      );
      const pickerBefore = (fieldOf(el, "field-color") as HTMLInputElement)
        .value;
      await setText(el, "field-color-hex", "not a colour");
      // Picker still shows the seeded colour — the malformed text
      // input doesn't overwrite the canonical `formColor`.
      expect((fieldOf(el, "field-color") as HTMLInputElement).value).toBe(
        pickerBefore,
      );
    });

    it("clears help / re-enables Save when the typo is fixed", async () => {
      const el = await mountLitElement<BoardSettingsModal>(
        "board-settings-modal",
        (e) => {
          e.target = baseTarget;
          e.open = true;
        },
      );
      await setText(el, "field-color-hex", "#90");
      expect(
        (fieldOf(el, "modal-confirm") as HTMLButtonElement).disabled,
      ).toBe(true);
      await setText(el, "field-color-hex", "#9000ff");
      expect(maybe(el, "color-hex-help")).toBeNull();
      expect(
        (fieldOf(el, "modal-confirm") as HTMLButtonElement).disabled,
      ).toBe(false);
    });
  });

  it("Save is disabled when the name is blanked", async () => {
    // §17.31 — empty name is the only required-field gate. Mirrors
    // `BoardCollectionService.updateSettings` which rejects an empty
    // `name`.
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
    // §17.29 — every shipping modal carries a top-right close-X via
    // `renderModalCloseX`. The shared testid is `modal-close-x`.
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
      // §17.31 — `BoardCollectionService.deleteBoard` refuses on
      // the last-remaining board; the modal also disables the
      // button so the operator never reaches the confirm step.
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
      // §17.31 — destructive action takes two explicit taps. The
      // first arms the inline prompt (no nested modal), the second
      // commits.
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
      // §17.31 — `deleteArmed` is reset on every open so a stale
      // armed state from a previous interaction can't leak into a
      // fresh open.
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
