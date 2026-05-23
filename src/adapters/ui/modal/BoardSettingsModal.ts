/**
 * `<board-settings-modal>` — board-level settings (SPEC §17.31, simplified
 * by §17.42).
 *
 * Reached from the `<burger-menu>` "Settings…" item alongside the
 * existing Import / Export / Boards entries. Lets the operator edit
 * the **mutable** board fields:
 *
 *   - `name` — text input, required, trimmed (same rule as
 *     `BoardCollectionService.rename` / `createBoard`).
 *   - **Delete board** — destructive action with an **inline
 *     confirmation step** (no nested modal). Disabled when the
 *     collection holds a single board (the
 *     `BoardCollectionService.getCurrentBoard()` invariant requires
 *     at least one). The service-side guard in
 *     `BoardCollectionService.deleteBoard` is the defence-in-depth
 *     contract.
 *
 * §17.42 retired the per-board "fresh date colour" picker the
 * §17.31 design carried. The kiosk's dark theme already gives the
 * timestamp + parent-title enough emphasis with a flat near-white
 * (now hard-coded into `dateAgeColor` and `*AsParent.ts`); the
 * operator-facing colour picker added a personalisation surface
 * that nobody used. Removing it shrinks the modal to "name + delete"
 * and lets the wire payload, service, and downstream colour
 * pipeline collapse to a single source of truth.
 *
 * Surface contract:
 *   - `open` (boolean attribute, reflected) — modal visible.
 *   - `target` (property) — the pre-edit snapshot for the current
 *     board (`{ boardId, name, canDelete }`). The composition root
 *     populates this from `BoardCollectionService.getCurrentBoard()`
 *     + `list().length > 1` before flipping `open` to true. When
 *     `open=false` the modal renders nothing.
 *   - dispatches **three** event types, all bubbling + composed:
 *     - `board-settings-confirm` `{ boardId, name }` on Confirm. The
 *       composition root calls
 *       `BoardCollectionService.updateSettings(...)` and on success
 *       calls `screen.closeBoardSettingsModal()`.
 *     - `board-settings-delete` `{ boardId }` on the **second** tap
 *       of the inline-armed Delete button. Composition root calls
 *       `BoardCollectionService.deleteBoard(...)` then refresh.
 *     - `board-settings-cancel` (no payload) on Cancel / Escape /
 *       backdrop tap / close-X (SPEC §17.29).
 *   - `errorMessage` (property) — surfaced inline by the composition
 *     root after a failed service call (e.g. invalid name); the
 *     modal stays open for retry.
 *
 * The modal owns its **inline-armed** state for Delete: a single tap
 * flips a local `deleteArmed` flag rendering "Are you sure?" + a
 * confirmation button; a second tap dispatches; cancel / change / ESC
 * disarms. This keeps the destructive path explicit without
 * stacking a second modal.
 *
 * Layered styling per SPEC §17.29 — `static styles = [modalFrameStyles,
 * css\`<per-modal layout>\`]` so the host overlay, backdrop, panel
 * sizing cap, and the top-right close-X glyph are all inherited.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import {
  modalFrameStyles,
  renderModalCloseX,
} from "../atoms/modalFrameStyles.js";

export const BOARD_SETTINGS_CONFIRM_EVENT = "board-settings-confirm";
export const BOARD_SETTINGS_DELETE_EVENT = "board-settings-delete";
export const BOARD_SETTINGS_CANCEL_EVENT = "board-settings-cancel";

export type BoardSettingsTarget = {
  readonly boardId: string;
  readonly name: string;
  /**
   * `false` when the collection holds a single board (delete would
   * violate the `getCurrentBoard` invariant). The Delete button is
   * disabled in that case.
   */
  readonly canDelete: boolean;
};

export type BoardSettingsConfirmDetail = {
  readonly boardId: string;
  readonly name: string;
};

export type BoardSettingsDeleteDetail = {
  readonly boardId: string;
};

@customElement("board-settings-modal")
export class BoardSettingsModal extends LitElement {
  @property({ type: Boolean, reflect: true })
  open = false;

  @property({ attribute: false })
  target: BoardSettingsTarget | null = null;

  @property({ attribute: false })
  errorMessage: string | null = null;

  // NB: cannot be named `name` — would shadow `HTMLElement.name`.
  @state()
  private formName = "";

  /**
   * §17.31 — inline-armed state for the destructive Delete action.
   * `false` → renders "Delete board" (single tap arms). `true` →
   * renders "Are you sure? Confirm delete" + "Keep board"; a second
   * tap on Confirm dispatches `board-settings-delete`. Reset to
   * `false` on every modal open and on every Keep-board tap.
   */
  @state()
  private deleteArmed = false;

  static styles = [
    modalFrameStyles,
    css`
      .panel {
        display: grid;
        grid-template-rows: auto 1fr;
        gap: 1rem 1.25rem;
        padding: 1.5rem 2rem;
        /* §17.29 -- room for the top-right close-X corner button. */
        padding-right: clamp(3.5rem, 5vw, 4.25rem);
        /* Settings is a small form (name + delete); §17.42 retired
           the colour picker so the panel is narrower than the §17.31
           original. */
        min-width: min(22rem, calc(100vw - 4rem));
        min-height: 0;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }
      .title-row {
        font-size: 1.25rem;
        font-weight: 600;
      }
      .form-pane {
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
      }
      form {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      .field > label {
        font-size: 0.85rem;
        color: color-mix(in srgb, currentColor 70%, transparent);
      }
      input[type="text"] {
        box-sizing: border-box;
        width: 100%;
        padding: 0.55rem 0.7rem;
        background: color-mix(in srgb, currentColor 4%, transparent);
        color: inherit;
        border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
        border-radius: 6px;
        font: inherit;
      }
      input[type="text"]:focus {
        outline: none;
        border-color: color-mix(in srgb, currentColor 55%, transparent);
        background: color-mix(in srgb, currentColor 8%, transparent);
      }
      .danger-zone {
        margin-top: 0.5rem;
        padding-top: 0.85rem;
        border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent);
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .danger-zone .label {
        font-size: 0.85rem;
        color: color-mix(in srgb, currentColor 70%, transparent);
      }
      .danger-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
      }
      .danger-prompt {
        font-size: 0.95rem;
        color: #ff8e8e;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.6rem;
        margin-top: 0.5rem;
      }
      .btn {
        padding: 0.55rem 1.1rem;
        background: transparent;
        color: inherit;
        border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
        border-radius: 6px;
        cursor: pointer;
        font: inherit;
      }
      .btn--primary {
        background: color-mix(in srgb, currentColor 28%, transparent);
        border-color: color-mix(in srgb, currentColor 55%, transparent);
      }
      .btn--danger {
        color: #ff8e8e;
        border-color: color-mix(in srgb, #ff8e8e 55%, transparent);
      }
      .btn--danger:hover:not(:disabled),
      .btn--danger:focus-visible {
        background: color-mix(in srgb, #ff8e8e 18%, transparent);
        outline: none;
      }
      .btn:hover:not(:disabled),
      .btn:focus-visible {
        outline: none;
        background: color-mix(in srgb, currentColor 16%, transparent);
      }
      .btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .error {
        color: #ff8e8e;
        font-size: 0.95em;
      }
    `,
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("keydown", this.handleKeydown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleKeydown);
  }

  override willUpdate(changed: Map<string, unknown>): void {
    // Re-seed the form when the modal opens (so a stale `target`
    // from a previous open doesn't leak into a fresh edit).
    if (changed.has("open") && this.open && this.target) {
      this.formName = this.target.name;
      this.deleteArmed = false;
    }
  }

  render() {
    if (!this.open || !this.target) {
      return nothing;
    }
    const trimmed = this.formName.trim();
    const canConfirm = trimmed.length > 0;
    return html`
      <div
        class="backdrop"
        data-testid="modal-backdrop"
        @click=${this.cancel}
      ></div>
      <section
        class="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="board-settings-title"
        data-testid="board-settings-modal"
      >
        ${renderModalCloseX(this.cancel)}
        <header class="header">
          <h2 id="board-settings-title" class="title-row">Board settings</h2>
        </header>
        <div class="form-pane">
          <form @submit=${this.onSubmit}>
            <div class="field">
              <label for="bsm-name">Name</label>
              <input
                id="bsm-name"
                data-testid="field-name"
                type="text"
                maxlength="120"
                .value=${this.formName}
                @input=${(e: Event) =>
                  (this.formName = (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="danger-zone" data-testid="danger-zone">
              <span class="label">Danger zone</span>
              ${this.deleteArmed
                ? html`<div class="danger-row">
                    <span class="danger-prompt" data-testid="delete-confirm-prompt"
                      >Delete this board permanently?</span
                    >
                    <button
                      type="button"
                      class="btn btn--danger"
                      data-testid="confirm-delete"
                      @click=${this.confirmDelete}
                    >
                      Confirm delete
                    </button>
                    <button
                      type="button"
                      class="btn"
                      data-testid="cancel-delete"
                      @click=${this.disarmDelete}
                    >
                      Keep board
                    </button>
                  </div>`
                : html`<div class="danger-row">
                    <button
                      type="button"
                      class="btn btn--danger"
                      data-testid="delete-board"
                      ?disabled=${!this.target.canDelete}
                      title=${this.target.canDelete
                        ? "Delete this board permanently"
                        : "Cannot delete the last remaining board"}
                      @click=${this.armDelete}
                    >
                      Delete board
                    </button>
                  </div>`}
            </div>
            ${this.errorMessage
              ? html`<p class="error" data-testid="modal-error">
                  ${this.errorMessage}
                </p>`
              : nothing}
            <div class="actions">
              <button
                type="button"
                class="btn"
                data-testid="modal-cancel"
                @click=${this.cancel}
              >
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn--primary"
                data-testid="modal-confirm"
                ?disabled=${!canConfirm}
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </section>
    `;
  }

  private armDelete = (): void => {
    this.deleteArmed = true;
  };

  private disarmDelete = (): void => {
    this.deleteArmed = false;
  };

  private confirmDelete = (): void => {
    if (!this.target) return;
    this.dispatchEvent(
      new CustomEvent<BoardSettingsDeleteDetail>(BOARD_SETTINGS_DELETE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { boardId: this.target.boardId },
      }),
    );
  };

  private onSubmit = (e: Event): void => {
    e.preventDefault();
    if (!this.target) return;
    const trimmed = this.formName.trim();
    if (trimmed.length === 0) return;
    this.dispatchEvent(
      new CustomEvent<BoardSettingsConfirmDetail>(BOARD_SETTINGS_CONFIRM_EVENT, {
        bubbles: true,
        composed: true,
        detail: {
          boardId: this.target.boardId,
          name: trimmed,
        },
      }),
    );
  };

  private cancel = (): void => {
    this.dispatchEvent(
      new CustomEvent(BOARD_SETTINGS_CANCEL_EVENT, {
        bubbles: true,
        composed: true,
      }),
    );
  };

  private readonly handleKeydown = (e: KeyboardEvent): void => {
    if (!this.open) return;
    if (e.key === "Escape") {
      this.cancel();
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "board-settings-modal": BoardSettingsModal;
  }
  interface HTMLElementEventMap {
    "board-settings-confirm": CustomEvent<BoardSettingsConfirmDetail>;
    "board-settings-delete": CustomEvent<BoardSettingsDeleteDetail>;
    "board-settings-cancel": CustomEvent<void>;
  }
}
