/**
 * `<card-frame>` — shared header / body / footer layout molecule
 * (SPEC §17.136 S0b, refined §17.140, §17.141). 3-row CSS grid:
 * header (panel-relative via `--card-header-height`, default
 * `28%` per §17.141 — the pre-§17.141 `22%` clipped the Workflow
 * PDCA status pill on small child tiles where the title row +
 * subtitle row don't fit in 22% of the tile height) with
 * `icons` + `unit` + `title` + `header-actions` title-row sub-
 * slots and a `subtitle` below; body (1fr, overflow:hidden) for
 * kind-specific shrink-to-fit content; footer
 * (`--card-footer-height`, default `1.4em` per §17.140 — sized to
 * the inline content rather than a tile-relative percentage) with
 * `footer-left` + `footer-right` anchored via space-between. Empty
 * slots collapse so each kind fills only what it carries.
 */

import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("card-frame")
export class CardFrame extends LitElement {
  static readonly styles = css`
    :host {
      display: grid;
      /* SPEC 17.140 -- footer now sizes to the inline content
         (1.4em ~= 1em footer text + a small line-height halo)
         rather than a tile-relative 12%. The pre-17.140 12%
         oversized the footer-row on tall tiles (the timestamp +
         weight icon do not need that much vertical real estate)
         and the freed space falls into the 1fr body row where
         the SVG-mono value glyph can grow. */
      grid-template-rows: var(--card-header-height, 28%) 1fr var(--card-footer-height, 1.4em);
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
      /* SPEC 17.140 -- tight footer padding (lateral 0.55rem to
         match header / body, vertical 0.15rem just enough to keep
         the timestamp + weight icon clear of the tile's rounded
         corner) lets the 1.4em row carry both affordances
         without crowding. */
      padding: 0 0.55rem 0.15rem;
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
