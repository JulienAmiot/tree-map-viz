/**
 * `<card-body>` — shared 3-cell layout molecule for the **body** slot
 * of every `<card-frame>` (SPEC §17.142). Companion to the §17.136
 * `<card-frame>` (header / body / footer): the frame gives every kind
 * a consistent title / footer skeleton; this molecule brings the same
 * consistency to the **body** region so BSC, Computed*, Text,
 * Workflow, Picture, URL, and future kinds share one visual rhythm.
 *
 * Landscape layout (host wider than tall — `2fr 1fr` columns):
 *     [   lead   ][ aux  ]      lead spans both rows on the left
 *     [   lead   ][ meta ]      aux + meta stack on the right
 *
 * Portrait layout (host taller than wide — picked up via the
 * `@container (orientation: portrait)` rule below; the host carries
 * `container-type: size` so the flip resolves against its own aspect
 * ratio, NOT a viewport media query):
 *     [   lead  ]   (2fr — top half)
 *     [   aux   ]   (1fr — middle band)
 *     [   meta  ]   (1fr — bottom band)
 *
 * Cells stretch to fill their tracks (`align-items: stretch;
 * justify-items: stretch`) so a `width="100%" height="auto"` SVG-mono
 * glyph inside `lead` reaches the bottom of its row instead of
 * leaving slack underneath — fixes the BSC AsChild "doesn't fill the
 * whole space" bug operator-flagged on the §17.141 showcase review.
 *
 * Per-view divergence rides on three knobs: `--card-body-lead-cols`
 * (default `2fr`) for kinds wanting a 3:1 or 1:1 split, `--card-body-
 * gap` (default `0`) for kinds wanting visible separators, and
 * `part="lead|aux|meta"` for kinds wanting shadow-piercing colour /
 * border overrides on a specific cell (WorkflowNode's PDCA-coloured
 * aux cell is the canonical example).
 */

import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("card-body")
export class CardBody extends LitElement {
  static readonly styles = css`
    :host {
      display: grid;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      box-sizing: border-box;
      container-type: size;
      overflow: hidden;
      color: inherit;
      grid-template-columns: var(--card-body-lead-cols, 2fr) 1fr;
      grid-template-rows: 1fr 1fr;
      grid-template-areas:
        "lead aux"
        "lead meta";
      align-items: stretch;
      justify-items: stretch;
      gap: var(--card-body-gap, 0);
    }
    /* SPEC §17.142 — portrait flip mirrors the §17.137 A2b BSC
       tile portrait layout (2fr lead on top, aux + meta stacked
       1fr / 1fr below) so a tile that flips orientations during a
       layout reflow lands on the same proportions on both sides. */
    @container (orientation: portrait) {
      :host {
        grid-template-columns: 1fr;
        grid-template-rows: 2fr 1fr 1fr;
        grid-template-areas:
          "lead"
          "aux"
          "meta";
      }
    }
    .cell {
      display: flex;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    .cell--lead {
      grid-area: lead;
      align-items: center;
      justify-content: flex-start;
    }
    .cell--aux {
      grid-area: aux;
      align-items: center;
      justify-content: flex-end;
      color: color-mix(in srgb, currentColor 80%, transparent);
    }
    .cell--meta {
      grid-area: meta;
      align-items: center;
      justify-content: flex-start;
      color: color-mix(in srgb, currentColor 80%, transparent);
      font-variant-numeric: tabular-nums;
    }
  `;

  render() {
    return html`
      <div class="cell cell--lead" part="lead" data-testid="card-body-lead">
        <slot name="lead"></slot>
      </div>
      <div class="cell cell--aux" part="aux" data-testid="card-body-aux">
        <slot name="aux"></slot>
      </div>
      <div class="cell cell--meta" part="meta" data-testid="card-body-meta">
        <slot name="meta"></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "card-body": CardBody;
  }
}
