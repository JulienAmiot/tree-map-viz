/**
 * `<about-modal>` — read-only About surface (SPEC §17.84). Renders app
 * version + build date + repo link in the shared §17.29 modal frame.
 * Reached from `<burger-menu>` "About…". Dismissal: Close / close-X /
 * Escape / backdrop tap → `about-cancel`. No Confirm.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { APP_VERSION, BUILD_DATE } from "../../../version.js";
import {
  modalFrameStyles,
  renderModalCloseX,
} from "./modalFrameStyles.js";

export const ABOUT_CANCEL_EVENT = "about-cancel";
const REPO_URL = "https://github.com/JulienAmiot/tree-map-viz";

@customElement("about-modal")
export class AboutModal extends LitElement {
  @property({ type: Boolean, reflect: true })
  open = false;

  static readonly styles = [
    modalFrameStyles,
    css`
      .panel { display: grid; grid-template-rows: auto 1fr auto; gap: 1rem; padding: 1.5rem 2rem; padding-right: clamp(3.5rem, 5vw, 4.25rem); min-width: min(20rem, calc(100vw - 4rem)); min-height: 0; }
      .title-row { font-size: 1.25rem; font-weight: 600; }
      .body { display: flex; flex-direction: column; gap: 0.85rem; min-height: 0; overflow-y: auto; }
      .row { display: grid; grid-template-columns: 8rem 1fr; gap: 0.5rem 1rem; align-items: baseline; }
      .row .label { font-size: 0.85rem; color: color-mix(in srgb, currentColor 70%, transparent); }
      .row .value { font-size: 1rem; font-weight: 500; word-break: break-word; }
      .row a { color: inherit; }
      .actions { display: flex; justify-content: flex-end; }
      .btn { padding: 0.55rem 1.1rem; background: transparent; color: inherit; border: 1px solid color-mix(in srgb, currentColor 35%, transparent); border-radius: 6px; cursor: pointer; font: inherit; }
      .btn:hover, .btn:focus-visible { outline: none; background: color-mix(in srgb, currentColor 16%, transparent); }
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

  render() {
    if (!this.open) return nothing;
    return html`
      <div class="backdrop" data-testid="modal-backdrop" @click=${this.cancel}></div>
      <section class="panel" role="dialog" aria-modal="true" aria-labelledby="about-title" data-testid="about-modal">
        ${renderModalCloseX(this.cancel)}
        <header><h2 id="about-title" class="title-row">About Tree Map Viz</h2></header>
        <div class="body">
          <div class="row"><span class="label">Version</span><span class="value" data-testid="about-version">v${APP_VERSION}</span></div>
          <div class="row"><span class="label">Build date</span><span class="value" data-testid="about-build-date">${BUILD_DATE}</span></div>
          <div class="row"><span class="label">Repository</span><span class="value"><a href=${REPO_URL} target="_blank" rel="noopener noreferrer" data-testid="about-repo-link">${REPO_URL}</a></span></div>
        </div>
        <div class="actions"><button type="button" class="btn" data-testid="modal-cancel" @click=${this.cancel}>Close</button></div>
      </section>
    `;
  }

  private readonly cancel = (): void => {
    this.dispatchEvent(new CustomEvent(ABOUT_CANCEL_EVENT, { bubbles: true, composed: true }));
  };

  private readonly handleKeydown = (e: KeyboardEvent): void => {
    if (this.open && e.key === "Escape") this.cancel();
  };
}

declare global {
  interface HTMLElementTagNameMap { "about-modal": AboutModal }
  interface HTMLElementEventMap { "about-cancel": CustomEvent<void> }
}
