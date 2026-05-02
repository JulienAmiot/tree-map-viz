/**
 * `<boards-panel-modal>` — collection-level boards panel (SPEC §17.34).
 *
 * Reached from the `<burger-menu>` "Boards…" item. Lets the operator
 * **switch** to another board and **create** a new one. Renaming and
 * deletion remain on the per-board `<board-settings-modal>` (§17.31)
 * — keeping the surfaces small was a §17.32-era decision the user
 * confirmed in the §17.34 design pass: Settings… is single-board-
 * level (rename / colour / delete the *current* board); Boards… is
 * collection-level (list / switch / create).
 *
 * Surface contract:
 *  - `open` (boolean attribute, reflected) — modal visible.
 *  - `target` (property) — the snapshot the composition root assembles
 *    from `BoardCollectionService.list()` + `getCurrentBoardId()`. The
 *    component does NOT see `Board` (domain type); the `tree` field
 *    is intentionally absent. When `open=false` the modal renders
 *    nothing (same idiom as the other §17.29 modals).
 *  - dispatches **three** event types, all bubbling + composed:
 *    - `boards-panel-switch` `{ boardId }` on a non-current row's
 *      Switch tap. The composition root drives
 *      `BoardCollectionService.switchTo(...)` and on success calls
 *      `screen.closeBoardsPanelModal()`.
 *    - `boards-panel-create` `{ name }` on the Create form's
 *      submit. Composition root calls
 *      `BoardCollectionService.createBoard(name, seed)` then re-seats
 *      navigation + router + refresh.
 *    - `boards-panel-cancel` (no payload) on Cancel / Escape /
 *      backdrop / close-X (SPEC §17.29).
 *  - `errorMessage` (property) — surfaced inline by the composition
 *    root after a failed service call (e.g. duplicate name); the
 *    modal stays open for retry.
 *
 * The list rows render with `data-testid="board-row"` + the board's
 * id on `data-board-id` so e2e can target "Switch to <id>" without
 * coupling to the user-visible label. The current row is marked with
 * `data-current="true"` and renders a "(current)" badge instead of a
 * Switch button. The current board CANNOT be switched-to from the
 * panel (would be a no-op anyway through `switchTo`'s same-id guard).
 *
 * Layered styling per SPEC §17.29 — `static styles = [modalFrameStyles,
 * css\`<per-modal layout>\`]` so the host overlay, backdrop, panel
 * sizing cap, and the top-right close-X glyph are inherited.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import {
  modalFrameStyles,
  renderModalCloseX,
} from "./modalFrameStyles.js";

export const BOARDS_PANEL_SWITCH_EVENT = "boards-panel-switch";
export const BOARDS_PANEL_CREATE_EVENT = "boards-panel-create";
export const BOARDS_PANEL_CANCEL_EVENT = "boards-panel-cancel";

export type BoardsPanelTarget = {
  /** Plain projection of `BoardCollectionService.list()` — id + name only. */
  readonly boards: readonly { readonly id: string; readonly name: string }[];
  readonly currentBoardId: string;
};

export type BoardsPanelSwitchDetail = {
  readonly boardId: string;
};

export type BoardsPanelCreateDetail = {
  readonly name: string;
};

@customElement("boards-panel-modal")
export class BoardsPanelModal extends LitElement {
  @property({ type: Boolean, reflect: true })
  open = false;

  @property({ attribute: false })
  target: BoardsPanelTarget | null = null;

  @property({ attribute: false })
  errorMessage: string | null = null;

  /** Local form state for the "Create new board" input. */
  @state()
  private newName = "";

  static styles = [
    modalFrameStyles,
    css`
      .panel {
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 1rem 1.25rem;
        padding: 1.5rem 2rem;
        /* §17.29 -- room for the top-right close-X corner button. */
        padding-right: clamp(3.5rem, 5vw, 4.25rem);
        /* The list dominates the width; cap it slightly wider than
           the settings modal so multi-board names don't wrap awkwardly. */
        min-width: min(28rem, calc(100vw - 4rem));
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
      .body {
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .section-label {
        font-size: 0.85rem;
        color: color-mix(in srgb, currentColor 70%, transparent);
        margin-bottom: 0.35rem;
      }
      ul.board-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      li.board-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.6rem;
        padding: 0.55rem 0.7rem;
        background: color-mix(in srgb, currentColor 4%, transparent);
        border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
        border-radius: 6px;
      }
      li.board-row[data-current="true"] {
        border-color: color-mix(in srgb, currentColor 45%, transparent);
        background: color-mix(in srgb, currentColor 8%, transparent);
      }
      .row-name {
        flex: 1 1 auto;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .row-current {
        flex: 0 0 auto;
        font-size: 0.85em;
        color: color-mix(in srgb, currentColor 70%, transparent);
        font-style: italic;
      }
      .create-form {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding-top: 0.85rem;
        border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent);
      }
      .create-row {
        display: flex;
        gap: 0.6rem;
        align-items: stretch;
        flex-wrap: wrap;
      }
      input[type="text"] {
        box-sizing: border-box;
        flex: 1 1 14rem;
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
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.6rem;
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
    // Reset the create form on every open so a stale half-typed
    // name from a previous open doesn't leak into a fresh session.
    if (changed.has("open") && this.open) {
      this.newName = "";
    }
  }

  render() {
    if (!this.open || !this.target) {
      return nothing;
    }
    const trimmed = this.newName.trim();
    const canCreate = trimmed.length > 0;
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
        aria-labelledby="boards-panel-title"
        data-testid="boards-panel-modal"
      >
        ${renderModalCloseX(this.cancel)}
        <header class="header">
          <h2 id="boards-panel-title" class="title-row">Boards</h2>
        </header>
        <div class="body">
          <div>
            <div class="section-label">Switch board</div>
            <ul class="board-list" data-testid="board-list">
              ${this.target.boards.map((b) => {
                const isCurrent = b.id === this.target!.currentBoardId;
                return html`
                  <li
                    class="board-row"
                    data-testid="board-row"
                    data-board-id=${b.id}
                    data-current=${isCurrent ? "true" : "false"}
                  >
                    <span class="row-name" data-testid="row-name"
                      >${b.name}</span
                    >
                    ${isCurrent
                      ? html`<span
                          class="row-current"
                          data-testid="row-current-badge"
                          >(current)</span
                        >`
                      : html`<button
                          type="button"
                          class="btn"
                          data-testid="row-switch"
                          data-board-id=${b.id}
                          @click=${() => this.dispatchSwitch(b.id)}
                        >
                          Switch
                        </button>`}
                  </li>
                `;
              })}
            </ul>
          </div>
          <form class="create-form" @submit=${this.onSubmit}>
            <div class="section-label">Create new board</div>
            <div class="create-row">
              <input
                type="text"
                data-testid="field-new-name"
                placeholder="Board name"
                maxlength="120"
                .value=${this.newName}
                @input=${(e: Event) =>
                  (this.newName = (e.target as HTMLInputElement).value)}
              />
              <button
                type="submit"
                class="btn btn--primary"
                data-testid="create-board"
                ?disabled=${!canCreate}
              >
                Create
              </button>
            </div>
          </form>
          ${this.errorMessage
            ? html`<p class="error" data-testid="modal-error">
                ${this.errorMessage}
              </p>`
            : nothing}
        </div>
        <div class="actions">
          <button
            type="button"
            class="btn"
            data-testid="modal-cancel"
            @click=${this.cancel}
          >
            Cancel
          </button>
        </div>
      </section>
    `;
  }

  private dispatchSwitch(boardId: string): void {
    this.dispatchEvent(
      new CustomEvent<BoardsPanelSwitchDetail>(BOARDS_PANEL_SWITCH_EVENT, {
        bubbles: true,
        composed: true,
        detail: { boardId },
      }),
    );
  }

  private onSubmit = (e: Event): void => {
    e.preventDefault();
    const trimmed = this.newName.trim();
    if (trimmed.length === 0) return;
    this.dispatchEvent(
      new CustomEvent<BoardsPanelCreateDetail>(BOARDS_PANEL_CREATE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { name: trimmed },
      }),
    );
  };

  private cancel = (): void => {
    this.dispatchEvent(
      new CustomEvent(BOARDS_PANEL_CANCEL_EVENT, {
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
    "boards-panel-modal": BoardsPanelModal;
  }
  interface HTMLElementEventMap {
    "boards-panel-switch": CustomEvent<BoardsPanelSwitchDetail>;
    "boards-panel-create": CustomEvent<BoardsPanelCreateDetail>;
    "boards-panel-cancel": CustomEvent<void>;
  }
}
