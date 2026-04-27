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
    }
    .tile {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      min-height: 4rem;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem;
      background: transparent;
      color: inherit;
      font: inherit;
      border: 2px dashed color-mix(in srgb, currentColor 45%, transparent);
      border-radius: 8px;
      cursor: pointer;
    }
    .tile:hover,
    .tile:focus-visible {
      background: color-mix(in srgb, currentColor 6%, transparent);
      border-color: color-mix(in srgb, currentColor 65%, transparent);
      outline: none;
    }
    .plus {
      font-size: clamp(1.6rem, 3vw, 2.6rem);
      font-weight: 300;
      line-height: 1;
      user-select: none;
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
