/**
 * `<card-frame>` — shared header / body / footer layout molecule
 * (SPEC §17.136 S0b). 3-row CSS grid: header (panel-relative via
 * `--card-header-height`, default 22%) with `icons` + `unit` +
 * `title` + `header-actions` title-row sub-slots and a `subtitle`
 * below; body (1fr, overflow:hidden) for kind-specific
 * shrink-to-fit content; footer (`--card-footer-height`, 12%) with
 * `footer-left` + `footer-right` anchored via space-between. Empty
 * slots collapse so each kind fills only what it carries.
 * No production callsite migrated in S0b — S1-S12 migrate each
 * (kind, role); S13 retires `<parent-identity-strip>` + the
 * `<children-grid>` corner-overlay weight button.
 */

import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("card-frame")
export class CardFrame extends LitElement {
  static readonly styles = css`
    :host {
      display: grid;
      grid-template-rows: var(--card-header-height, 22%) 1fr var(--card-footer-height, 12%);
      width: 100%;
      height: 100%;
      min-height: 0;
      min-width: 0;
      box-sizing: border-box;
      container-type: size;
      overflow: hidden;
      color: inherit;
    }
    .header {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding: 0.35rem 0.55rem 0;
      min-height: 0;
      overflow: hidden;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      min-width: 0;
    }
    .title-row__lead,
    .title-row__actions {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      flex: 0 0 auto;
    }
    .title-row__title {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
    }
    .subtitle { min-width: 0; overflow: hidden; }
    .body {
      min-height: 0;
      min-width: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      padding: 0 0.55rem;
    }
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0 0.55rem 0.35rem;
      min-height: 0;
    }
    .footer__slot { display: inline-flex; align-items: center; min-width: 0; }
  `;

  render() {
    return html`
      <div class="header" part="header" data-testid="card-frame-header">
        <div class="title-row" data-testid="card-frame-title-row">
          <span class="title-row__lead"><slot name="icons"></slot><slot name="unit"></slot></span>
          <span class="title-row__title"><slot name="title"></slot></span>
          <span class="title-row__actions"><slot name="header-actions"></slot></span>
        </div>
        <div class="subtitle"><slot name="subtitle"></slot></div>
      </div>
      <div class="body" part="body" data-testid="card-frame-body"><slot name="body"></slot></div>
      <div class="footer" part="footer" data-testid="card-frame-footer">
        <span class="footer__slot" data-testid="card-frame-footer-left"><slot name="footer-left"></slot></span>
        <span class="footer__slot" data-testid="card-frame-footer-right"><slot name="footer-right"></slot></span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "card-frame": CardFrame; }
}
