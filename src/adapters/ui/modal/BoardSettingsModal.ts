/**
 * `<board-settings-modal>` — board-level theme settings (SPEC §17.31).
 *
 * Reached from the `<burger-menu>` "Settings…" item (added in §17.31
 * alongside the existing Import / Export / Boards entries). Lets the
 * operator edit the **mutable** board fields:
 *
 *   - `name` — text input, required, trimmed (same rule as
 *     `BoardCollectionService.rename` / `createBoard`).
 *   - `freshDateColor` — `<input type="color">` paired with a read-only
 *     hex display. The colour drives both the per-tile timestamp's
 *     fresh endpoint (`dateAgeColor`) and the focused-panel title
 *     colour (§17.31), so a change here ripples to every coloured
 *     surface on the next refresh.
 *   - **Delete board** — destructive action with an **inline
 *     confirmation step** (no nested modal). Disabled when the
 *     collection holds a single board (the
 *     `BoardCollectionService.getCurrentBoard()` invariant requires
 *     at least one). The service-side guard in
 *     `BoardCollectionService.deleteBoard` is the defence-in-depth
 *     contract.
 *
 * Surface contract:
 *   - `open` (boolean attribute, reflected) — modal visible.
 *   - `target` (property) — the pre-edit snapshot for the current
 *     board (`{ boardId, name, freshDateColor, canDelete }`). The
 *     composition root populates this from
 *     `BoardCollectionService.getCurrentBoard()` + `list().length > 1`
 *     before flipping `open` to true. When `open=false` the modal
 *     renders nothing.
 *   - dispatches **three** event types, all bubbling + composed:
 *     - `board-settings-confirm` `{ boardId, name, freshDateColor }`
 *       on Confirm. The composition root calls
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
} from "./modalFrameStyles.js";

export const BOARD_SETTINGS_CONFIRM_EVENT = "board-settings-confirm";
export const BOARD_SETTINGS_DELETE_EVENT = "board-settings-delete";
export const BOARD_SETTINGS_CANCEL_EVENT = "board-settings-cancel";

export type BoardSettingsTarget = {
  readonly boardId: string;
  readonly name: string;
  /**
   * The board's current fresh-date colour, or empty string if
   * unset. The modal seeds the colour picker from this value (or
   * from the application-wide default fallback if empty — which the
   * composition root resolves before passing the snapshot in).
   */
  readonly freshDateColor: string;
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
  readonly freshDateColor: string;
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
   * The **canonical resolved colour**, always a valid 7-char `#rrggbb`
   * hex once the modal has opened (or empty before first open). The
   * Save button dispatches this exact string. The native colour
   * picker's `.value` is bound to this; any picker drag overwrites
   * both `formColor` and `formColorHex` so they stay in lockstep.
   */
  @state()
  private formColor = "";

  /**
   * The **editable hex text** — what the operator is typing in the
   * paired `<input type="text">`. May be partial / invalid
   * mid-typing (e.g. `"#90"`). When the input matches the
   * `^#[0-9a-fA-F]{6}$` shape we mirror it into `formColor` (which
   * repaints the picker thumb). When it doesn't, `formColor` stays
   * put (picker thumb doesn't lurch around) and the Save button is
   * gated until the operator either fixes the typo or clears the
   * field back to a valid hex. Keeping the two in lockstep on
   * picker drags is essential — the picker emits a 7-char hex on
   * every `input`, so we always have a known-valid ground truth to
   * fall back to.
   */
  @state()
  private formColorHex = "";

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
        /* Settings is a small form (name + colour + delete); the
           min-width is narrower than EditNodeModal's 28rem because
           a fresh-colour picker is naturally compact. */
        min-width: min(24rem, calc(100vw - 4rem));
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
        /* SPEC 17.31 -- force the cross-axis to stay clipped.
           Per the CSS spec, setting overflow-y: auto computes
           overflow-x to auto as well when the other axis is left
           visible; that produced a horizontal scrollbar whenever
           the inline-help span pushed the colour-control row past
           the panel width. The form is single-column at fixed
           gaps so there is nothing legitimate to scroll
           horizontally. */
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
      .color-control {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        /* SPEC 17.31 -- wrap when the optional help span on
           invalid hex makes the row too wide for the panel.
           Picker + hex input always share the first row; help
           wraps below if needed. Without this the row would
           force the form-pane to scroll horizontally. */
        flex-wrap: wrap;
      }
      .color-control input[type="color"] {
        flex: 0 0 auto;
        width: 3rem;
        height: 2.4rem;
        padding: 0;
        background: transparent;
        border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
        border-radius: 6px;
        cursor: pointer;
      }
      /* SPEC 17.31 -- compound selector to beat the
         input[type=text] rule above (attribute selectors carry
         specificity 11; a bare class is 10, so the generic
         width: 100% rule was winning the cascade and the hex
         input rendered full-width). Adding the type attribute
         to our selector lifts specificity to 21 so the explicit
         7ch width actually applies. The hex input is sized to
         exactly fit its maxlength=7 monospace characters: 7ch
         of content area plus the 0.4rem horizontal padding
         (each side) and 1px border. No wasted space, and the
         maxlength=7 cap means the operator never types past
         the visible edge. */
      input[type="text"].color-hex-input {
        flex: 0 0 auto;
        width: calc(7ch + 0.8rem + 2px);
        padding: 0.55rem 0.4rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.9rem;
        text-transform: lowercase;
      }
      input[type="text"].color-hex-input.is-invalid {
        border-color: #ff8e8e;
      }
      .color-hex-help {
        flex: 1 1 100%;
        font-size: 0.85em;
        color: #ff8e8e;
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
      // Seed both hex slots from the target. If the target stores a
      // non-hex colour (legacy `rgb(...)` / named colour), the
      // canonical `formColor` falls back to a sensible default for
      // the picker thumb while the editable text input shows the
      // raw stored value so the operator can see what's persisted
      // and edit it explicitly.
      const seedHex = this.target.freshDateColor;
      this.formColorHex = seedHex;
      this.formColor = normalizeHexForPicker(seedHex);
      this.deleteArmed = false;
    }
  }

  render() {
    if (!this.open || !this.target) {
      return nothing;
    }
    const trimmed = this.formName.trim();
    const hexValid = isValidHexColor(this.formColorHex);
    // §17.31 — Save is gated on BOTH a non-empty trimmed name AND a
    // valid hex. The picker only ever emits valid hex, so the gate
    // is reachable only via a malformed text-input edit; surfacing
    // the issue at the form level (disabled button + per-field
    // colouring) is more discoverable than waiting for a confirm-
    // time error from the service.
    const canConfirm = trimmed.length > 0 && hexValid;
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
            <div class="field">
              <label for="bsm-color">Fresh date colour</label>
              <div class="color-control" data-testid="color-control">
                <input
                  id="bsm-color"
                  data-testid="field-color"
                  type="color"
                  .value=${this.formColor}
                  @input=${this.onPickerInput}
                />
                <input
                  data-testid="field-color-hex"
                  class="color-hex-input ${hexValid ? "" : "is-invalid"}"
                  type="text"
                  maxlength="7"
                  spellcheck="false"
                  autocomplete="off"
                  placeholder="#9000ff"
                  aria-label="Hex colour"
                  .value=${this.formColorHex}
                  @input=${this.onHexInput}
                />
                ${hexValid
                  ? nothing
                  : html`<span
                      class="color-hex-help"
                      data-testid="color-hex-help"
                      >Enter a 7-character hex (e.g. #9000ff)</span
                    >`}
              </div>
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

  /**
   * Picker drag → overwrite both hex slots. The native picker
   * always emits a 7-char `#rrggbb` so we can treat its value as
   * known-valid. Lower-case for canonical form (the picker already
   * lower-cases on every browser we target, but we re-normalise
   * defensively).
   */
  private onPickerInput = (e: Event): void => {
    const v = (e.target as HTMLInputElement).value.toLowerCase();
    this.formColor = v;
    this.formColorHex = v;
  };

  /**
   * Hex text input → update the editable slot unconditionally so
   * the operator's typing reflects in the field. If the typed
   * value matches the strict 7-char hex shape, also mirror it into
   * `formColor` (which repaints the picker thumb on the next
   * render). Otherwise leave the picker thumb where it was — a
   * partial value like `#90` shouldn't make the picker lurch.
   */
  private onHexInput = (e: Event): void => {
    const raw = (e.target as HTMLInputElement).value;
    this.formColorHex = raw;
    if (isValidHexColor(raw)) {
      this.formColor = raw.toLowerCase();
    }
  };

  private onSubmit = (e: Event): void => {
    e.preventDefault();
    if (!this.target) return;
    const trimmed = this.formName.trim();
    if (trimmed.length === 0) return;
    if (!isValidHexColor(this.formColorHex)) return;
    this.dispatchEvent(
      new CustomEvent<BoardSettingsConfirmDetail>(BOARD_SETTINGS_CONFIRM_EVENT, {
        bubbles: true,
        composed: true,
        detail: {
          boardId: this.target.boardId,
          name: trimmed,
          // Dispatch the canonical lower-case hex so both the
          // service and the persisted JSON see a normalised value
          // regardless of whether the operator typed `#9000FF`,
          // `#9000ff`, or dragged the picker.
          freshDateColor: this.formColorHex.toLowerCase(),
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

/**
 * `<input type="color">` only accepts 7-character `#rrggbb` hex
 * strings. Boards may carry `rgb(r, g, b)`, named colours, or
 * 4-digit shorthand from older saves; in those cases we fall back
 * to a sensible default so the picker has a starting position. The
 * editable hex `<input type="text">` continues to show the raw
 * stored value so the operator can see what's persisted and edit
 * it explicitly.
 */
function normalizeHexForPicker(raw: string): string {
  if (isValidHexColor(raw)) {
    return raw.toLowerCase();
  }
  return "#743089";
}

/**
 * Strict 7-char `#rrggbb` hex match (case-insensitive). 3-digit
 * shorthand (`#abc`) is intentionally rejected: the native colour
 * picker doesn't emit it, the wire format would benefit from a
 * single canonical shape, and the operator who types `#9000FF`
 * gets a known-good full hex anyway. The empty string is invalid
 * (we want to gate Save on the field actually carrying a colour).
 */
function isValidHexColor(raw: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(raw);
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
