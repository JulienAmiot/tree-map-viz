/**
 * `<burger-menu>` — small triple-bar trigger that opens a popup menu with
 * the three top-level kiosk actions (SPEC §4 Drawer + §12.3
 * `shell/burger_menu.feature`):
 *
 *   - Import…  → caller is expected to seed a tree from a JSON file
 *                (Phase 10 wiring; the menu just emits the action).
 *   - Export…  → caller is expected to serialize the current board.
 *   - Boards…  → caller is expected to open the boards panel
 *                (rename / switch / create — also Phase 10 wiring).
 *
 * Surface contract:
 *  - dispatches a bubbling + composed `burger-menu-action`
 *    `CustomEvent<{ action }>` when an item is activated. The kiosk shell
 *    `<tree-graph-screen>` re-emits / forwards as needed; today the
 *    composition root logs a placeholder until Phase 10 wires the real
 *    `ImportExportService` + `BoardCollectionService` consumers (§17.3).
 *  - closes itself **after every item activation** (standard menu UX +
 *    deterministic for BDD: "after I tap Import, the menu is gone").
 *  - closes itself on **outside tap** (`composedPath`-based, walks shadow
 *    DOM correctly so taps inside the trigger and inside the items are
 *    treated as inside).
 *  - closes itself on **Escape** while open (a11y default).
 *
 * The menu is purely presentational; it does not know what Import/Export
 * mean. That keeps the action surface small (one event with three string
 * literals) and lets the composition root grow new menu items without
 * round-tripping through the shell.
 */

import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";

export const BURGER_MENU_ACTION_EVENT = "burger-menu-action";

export type BurgerMenuAction = "import" | "export" | "boards";

export type BurgerMenuActionDetail = {
  readonly action: BurgerMenuAction;
};

const ITEMS: readonly { readonly action: BurgerMenuAction; readonly label: string }[] =
  [
    { action: "import", label: "Import…" },
    { action: "export", label: "Export…" },
    { action: "boards", label: "Boards…" },
  ] as const;

@customElement("burger-menu")
export class BurgerMenu extends LitElement {
  @state()
  private menuOpen = false;

  static styles = css`
    :host {
      position: relative;
      display: inline-flex;
      align-items: center;
      color: inherit;
      font: inherit;
    }
    .trigger {
      width: 2.4rem;
      height: 2.4rem;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      color: inherit;
    }
    .trigger:hover,
    .trigger:focus-visible {
      background: color-mix(in srgb, currentColor 12%, transparent);
      outline: none;
    }
    .bar {
      display: block;
      width: 1.2rem;
      height: 2px;
      background: currentColor;
      border-radius: 2px;
    }
    .menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin: 0.25rem 0 0;
      padding: 0.25rem 0;
      list-style: none;
      background: color-mix(in srgb, currentColor 10%, var(--bg, #0c0f14));
      border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
      border-radius: 6px;
      min-width: 12rem;
      box-shadow: 0 8px 24px color-mix(in srgb, #000 50%, transparent);
      z-index: 60;
    }
    .menu[hidden] {
      display: none;
    }
    .item {
      width: 100%;
      padding: 0.55rem 0.85rem;
      background: transparent;
      border: none;
      color: inherit;
      text-align: left;
      cursor: pointer;
      font: inherit;
    }
    .item:hover,
    .item:focus-visible {
      background: color-mix(in srgb, currentColor 14%, transparent);
      outline: none;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("click", this.handleDocClick, true);
    document.addEventListener("keydown", this.handleKeydown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("click", this.handleDocClick, true);
    document.removeEventListener("keydown", this.handleKeydown);
  }

  render() {
    return html`
      <button
        class="trigger"
        type="button"
        data-testid="burger-trigger"
        aria-haspopup="menu"
        aria-expanded=${this.menuOpen}
        @click=${this.toggle}
      >
        <span class="bar" aria-hidden="true"></span>
        <span class="bar" aria-hidden="true"></span>
        <span class="bar" aria-hidden="true"></span>
        <span class="sr-only">Menu</span>
      </button>
      <ul
        class="menu"
        role="menu"
        data-testid="burger-menu"
        ?hidden=${!this.menuOpen}
      >
        ${ITEMS.map(
          (it) => html`
            <li role="none">
              <button
                class="item"
                type="button"
                role="menuitem"
                data-testid="burger-item"
                data-action=${it.action}
                @click=${() => this.handleAction(it.action)}
              >
                ${it.label}
              </button>
            </li>
          `,
        )}
      </ul>
    `;
  }

  private toggle = (): void => {
    this.menuOpen = !this.menuOpen;
  };

  private handleAction(action: BurgerMenuAction): void {
    this.menuOpen = false;
    this.dispatchEvent(
      new CustomEvent<BurgerMenuActionDetail>(BURGER_MENU_ACTION_EVENT, {
        bubbles: true,
        composed: true,
        detail: { action },
      }),
    );
  }

  private readonly handleDocClick = (e: Event): void => {
    if (!this.menuOpen) {
      return;
    }
    const path = e.composedPath();
    if (path.includes(this)) {
      return;
    }
    this.menuOpen = false;
  };

  private readonly handleKeydown = (e: KeyboardEvent): void => {
    if (!this.menuOpen) {
      return;
    }
    if (e.key === "Escape") {
      this.menuOpen = false;
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "burger-menu": BurgerMenu;
  }
  interface HTMLElementEventMap {
    "burger-menu-action": CustomEvent<BurgerMenuActionDetail>;
  }
}
