/**
 * `<app-drawer>` — auto-hidden chrome panel pulled out of the top edge by a
 * tappable handle (SPEC §4 Drawer + §12.3 `shell/drawer.feature`).
 *
 * Surface contract:
 *  - `open` (boolean attribute, reflected) — whether the drawer body is
 *    revealed. Bound on the host so CSS can use `:host([open])` and
 *    e2e/page-object can assert it via `getAttribute("open")`.
 *  - default slot — the drawer body content (board name, breadcrumb,
 *    burger menu in the kiosk shell). The drawer is intentionally a thin
 *    layout-only wrapper; it does not know what the content is.
 *  - dispatches a bubbling + composed `drawer-toggle` `CustomEvent<{ open }>`
 *    on every state change, so `<tree-graph-screen>` (and tests) can react
 *    without reaching into the element.
 *
 * Auto-close behaviour:
 *  - **Tap outside the drawer host** while open → close. Implemented via a
 *    capture-phase `document` click listener that walks `composedPath()`
 *    so taps inside any open shadow root within the drawer (e.g. the
 *    burger menu, breadcrumb buttons) are treated as inside.
 *  - **Escape key** while open → close (a11y default for transient
 *    overlays; matches the kiosk's expectation that Esc is harmless).
 *  - **Tap on the handle** is a deliberate toggle (no auto-close
 *    interference because the handle is part of the drawer host's
 *    `composedPath`).
 *
 * Animation: pure CSS via `max-height` + `overflow: hidden`, honouring
 * `prefers-reduced-motion: reduce` (SPEC §2 — CSS-first animations, JS only
 * flips `aria-*` and the host attribute).
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

export const DRAWER_TOGGLE_EVENT = "drawer-toggle";

export type DrawerToggleDetail = {
  readonly open: boolean;
};

@customElement("app-drawer")
export class AppDrawer extends LitElement {
  /** Whether the drawer panel is currently revealed. */
  @property({ type: Boolean, reflect: true })
  open = false;

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 50;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      pointer-events: none;
    }
    .panel {
      pointer-events: auto;
      box-sizing: border-box;
      max-height: 0;
      overflow: hidden;
      background: color-mix(in srgb, currentColor 8%, var(--bg, #0c0f14));
      border-bottom: 1px solid
        color-mix(in srgb, currentColor 18%, transparent);
      transition: max-height 0.32s cubic-bezier(0.22, 1, 0.36, 1);
      will-change: max-height;
    }
    :host([open]) .panel {
      max-height: 20rem;
    }
    .handle {
      pointer-events: auto;
      align-self: center;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0.25rem 0 0;
      padding: 0.35rem 1rem;
      background: transparent;
      border: none;
      border-radius: 999px;
      cursor: pointer;
      color: inherit;
    }
    .handle::before {
      content: "";
      width: 4rem;
      height: 5px;
      border-radius: 999px;
      background: color-mix(in srgb, currentColor 35%, transparent);
      transition: background 0.18s ease;
    }
    .handle:hover::before,
    .handle:focus-visible::before {
      background: color-mix(in srgb, currentColor 60%, transparent);
    }
    .handle:focus-visible {
      outline: 2px solid color-mix(in srgb, currentColor 50%, transparent);
      outline-offset: 2px;
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
    @media (prefers-reduced-motion: reduce) {
      .panel {
        transition: none;
      }
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
      <section
        class="panel"
        role="region"
        aria-label="App drawer"
        data-testid="drawer-panel"
        aria-hidden=${this.open ? "false" : "true"}
      >
        <slot></slot>
      </section>
      <button
        class="handle"
        type="button"
        data-testid="drawer-handle"
        aria-expanded=${this.open}
        aria-controls="drawer-panel"
        @click=${this.toggle}
      >
        <span class="sr-only">${this.open ? "Hide drawer" : "Show drawer"}</span>
      </button>
    `;
  }

  /** Toggle the drawer's open state and dispatch `drawer-toggle`. */
  toggle = (): void => {
    this.setOpen(!this.open);
  };

  private setOpen(next: boolean): void {
    if (next === this.open) {
      return;
    }
    this.open = next;
    this.dispatchEvent(
      new CustomEvent<DrawerToggleDetail>(DRAWER_TOGGLE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { open: this.open },
      }),
    );
  }

  private readonly handleDocClick = (e: Event): void => {
    if (!this.open) {
      return;
    }
    const path = e.composedPath();
    if (path.includes(this)) {
      return;
    }
    this.setOpen(false);
  };

  private readonly handleKeydown = (e: KeyboardEvent): void => {
    if (!this.open) {
      return;
    }
    if (e.key === "Escape") {
      this.setOpen(false);
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "app-drawer": AppDrawer;
  }
  interface HTMLElementEventMap {
    "drawer-toggle": CustomEvent<DrawerToggleDetail>;
  }
}
