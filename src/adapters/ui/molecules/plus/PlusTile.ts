/**
 * `<plus-tile>` — UI affordance for "add a child to the focused parent"
 * (SPEC §4 last bullet, §5 final sentence, §7).
 *
 * Not a node kind — deliberately **not** in `nodeViewRegistry`. The shell
 * decides whether to render it (per `domain/capacity/shouldRenderPlusTile`)
 * and supplies the `parentId` it should target.
 *
 * Activating the tile fires a bubbling, composed `plus-tile-activate`
 * `CustomEvent` carrying `{ parentId }`. The Phase 8 modal (DT-7) listens
 * for the event on the shell and never reaches into this element. The tile
 * itself never drills (it is not a navigation target).
 *
 * §17.24 — "+" glyph rendering:
 *   The visible cross is drawn with two CSS pseudo-elements (a horizontal
 *   bar via ::before and a vertical bar via ::after) sized in `cqmin`
 *   so the cross **fills the tile** regardless of viewport size, and
 *   has dramatic stroke thickness (≈18 % of the smaller dimension).
 *   This replaces the previous typographic `font-weight: 300` "+",
 *   which read as anaemic next to the dashed border.
 *
 *   The literal "+" character is still rendered inside the `.plus` span
 *   at `font-size: 0` so it's invisible in the viewport but present in
 *   the DOM. That preserves the contract pinned by both the unit test
 *   (`plus.textContent.trim() === "+"`) and the e2e step
 *   (`the plus tile shows "+"` → `toContainText("+")`); the visual
 *   cross is what the user sees, the text node is what the tests read.
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

export const PLUS_TILE_ACTIVATE_EVENT = "plus-tile-activate";

export type PlusTileActivateDetail = {
  readonly parentId: string;
};

@customElement("plus-tile")
export class PlusTile extends LitElement {
  /** Id of the focused parent the new child should be appended to. */
  @property({ attribute: "parent-id", reflect: true })
  parentId = "";

  static styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      /* §17.24 — enable container queries so the cross can be sized in
         cqmin (relative to the smaller of the host's width/height) and
         scales with the tile across orientations + treemap reflows. */
      container-type: size;
    }
    .tile {
      position: relative;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      min-height: 4rem;
      padding: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      border: 2px dashed color-mix(in srgb, currentColor 45%, transparent);
      border-radius: 8px;
      cursor: pointer;
      overflow: hidden;
    }
    .tile:hover,
    .tile:focus-visible {
      background: color-mix(in srgb, currentColor 6%, transparent);
      border-color: color-mix(in srgb, currentColor 75%, transparent);
      outline: none;
    }
    /* §17.24 — the visible "+" is two solid bars centred on the tile,
       sized in cqmin so they scale with the smaller dimension. Tuned
       to ~38 %% arm length × ~11 %% stroke thickness (half of the
       original §17.24 sketch). The bars use the kiosk's --muted token
       (rgb(139, 149, 168) on the dark theme) instead of full text
       brightness so the "add" affordance reads as a calmer, secondary
       action against the data tiles around it — visibly *darker* than
       the focused-tile titles, the same family of grey as the dashed
       border itself. The currentColor fallback keeps tests / unit
       fixtures (which don't load index.css) renderable.
       The text "+" character inside this span is hidden via font-size:0
       (kept for DOM-text assertions; see the JSDoc above). */
    .plus {
      position: absolute;
      inset: 0;
      display: block;
      font-size: 0;
      line-height: 0;
      color: var(--muted, currentColor);
      user-select: none;
    }
    .plus::before,
    .plus::after {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      background: currentColor;
      /* Tight corner radius — a "+" reads as a confident plus glyph
         when the strokes feel architectural; the 1 cqmin clamp just
         softens the ends enough for kiosk pixel rounding. */
      border-radius: clamp(1px, 1cqmin, 4px);
      transform: translate(-50%, -50%);
    }
    .plus::before {
      /* horizontal bar */
      width: 38cqmin;
      height: 11cqmin;
    }
    .plus::after {
      /* vertical bar */
      width: 11cqmin;
      height: 38cqmin;
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

  render() {
    return html`
      <button
        class="tile"
        type="button"
        data-testid="plus-tile"
        data-parent-id=${this.parentId}
        @click=${this.handleActivate}
      >
        <span class="plus" aria-hidden="true">+</span>
        <span class="sr-only">Add child</span>
      </button>
    `;
  }

  private handleActivate(e: Event): void {
    e.stopPropagation();
    const detail: PlusTileActivateDetail = { parentId: this.parentId };
    this.dispatchEvent(
      new CustomEvent(PLUS_TILE_ACTIVATE_EVENT, {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "plus-tile": PlusTile;
  }
  interface HTMLElementEventMap {
    "plus-tile-activate": CustomEvent<PlusTileActivateDetail>;
  }
}
