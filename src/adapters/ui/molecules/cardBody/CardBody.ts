/**
 * `<card-body>` — shared body skeleton molecule for every `<card-frame>`
 * (SPEC §17.142 foundation + §17.142d refresh). Companion to the
 * §17.136 `<card-frame>` (header / body / footer): the frame gives
 * every kind a consistent title / footer skeleton; this molecule
 * brings the same consistency to the body region so BSC, Computed*,
 * Text, Workflow, Picture, URL, and future kinds share one visual
 * rhythm.
 *
 * Two layout variants, picked via `data-layout`:
 *
 * **Default ("split")** — 3-cell grid for kinds carrying a value
 * + objective columns (BSC + Computed* + CBSN):
 *
 *     Landscape (`2fr 1fr` columns):
 *         [   lead   ][ aux  ]      lead spans both rows on left
 *         [   lead   ][ meta ]      aux + meta stack on right
 *
 *     Portrait (`@container (orientation: portrait)` flip, host
 *     carries `container-type: size`):
 *         [   lead  ]   (2fr top half)
 *         [   aux   ]   (1fr middle band)
 *         [   meta  ]   (1fr bottom band)
 *
 * **Lead-only (`data-layout="lead-only"`)** — single column for
 * kinds with one content area (WorkflowNode / TextNode / PictureNode
 * / URLNode). The `aux` + `meta` cells render with `display: none`
 * so the lead spans the full body width AND height; the molecule's
 * outer grid drops to a single 1fr column / 1fr row track. Slotted
 * `aux` / `meta` content (if any) is dropped from the visible
 * layout but still in the DOM, so a future strand can flip the
 * variant per-VM without ABI churn.
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
 * border overrides on a specific cell.
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
    /* SPEC §17.142d -- lead-only variant for single-content kinds
       (Workflow / Text / Picture / URL). Single 1fr column / 1fr
       row track; aux + meta cells drop out of the visible layout
       so the lead fills the entire body. The slot wrappers stay
       in the DOM (display: none rather than removing the slots
       wholesale) so a future variant flip lands without rewiring
       the cell template. */
    :host([data-layout="lead-only"]) {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr;
      grid-template-areas: "lead";
    }
    :host([data-layout="lead-only"]) .cell--aux,
    :host([data-layout="lead-only"]) .cell--meta {
      display: none;
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
