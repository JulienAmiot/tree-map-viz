/**
 * `<focus-breadcrumb>` — renders the focus path from root → focused node as
 * a row of tappable segments, with the focused segment marked
 * `aria-current="page"` (SPEC §4 Drawer + §12.3 `shell/breadcrumb.feature`).
 *
 * Surface contract:
 *  - `path` (property, no attribute) — `readonly BreadcrumbSegment[]` from
 *    root to focus. The composition root computes this from
 *    `walkPath(boardTree, focusedId)`.
 *  - dispatches a bubbling + composed `breadcrumb-navigate`
 *    `CustomEvent<{ nodeId }>` when a non-current segment is tapped. The
 *    composition root listens and calls `router.push({ … focusNodeUuid })`
 *    so the URL hash + focus state stay in sync (SPEC §11.3).
 *  - the last segment (the focus itself) is rendered as a non-button
 *    `<span>` — taps on the focus are a no-op by design.
 *
 * Truncation strategy (SPEC §4: "truncates from the left with leading `…`"):
 *  - One CSS-only line. The flex row uses `justify-content: flex-end` +
 *    `flex-shrink: 0` so the *most recent* segments anchor at the right edge.
 *    `overflow: hidden` clips the leftmost (oldest) ancestors.
 *  - A `mask-image` linear-gradient fades the left edge → the visual
 *    "leading `…`" indication, without measurement-driven re-renders.
 *  - Pixel-perfect head-keep + tail-keep + middle-`…` (the example shape
 *    `Root › … › Parent › Focus` from §4) is a deferred refinement; the
 *    coarse strategy here ships the spec contract today and is stable
 *    under arbitrary path lengths and viewport widths.
 *
 * No internal layout JS, no `ResizeObserver` — the host width is the only
 * input and CSS does the work, which keeps unit tests deterministic under
 * jsdom (where layout is not computed).
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

export type BreadcrumbSegment = {
  readonly id: string;
  readonly title: string;
};

export const BREADCRUMB_NAVIGATE_EVENT = "breadcrumb-navigate";

export type BreadcrumbNavigateDetail = {
  readonly nodeId: string;
};

@customElement("focus-breadcrumb")
export class FocusBreadcrumb extends LitElement {
  /** Path from root to focused node, in that order. Empty → render nothing. */
  @property({ attribute: false })
  path: readonly BreadcrumbSegment[] = [];

  static styles = css`
    :host {
      display: block;
      width: 100%;
      min-width: 0;
      color: inherit;
      font: inherit;
    }
    nav {
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      gap: 0.15rem;
      width: 100%;
      overflow: hidden;
      white-space: nowrap;
      justify-content: flex-end;
      -webkit-mask-image: linear-gradient(
        to right,
        transparent 0,
        black 1.25rem
      );
      mask-image: linear-gradient(to right, transparent 0, black 1.25rem);
    }
    .seg {
      flex: 0 1 auto;
      min-width: 0;
      max-width: 14rem;
      padding: 0.18rem 0.4rem;
      margin: 0;
      background: transparent;
      border: none;
      color: inherit;
      font: inherit;
      font-size: 0.95em;
      cursor: pointer;
      text-overflow: ellipsis;
      overflow: hidden;
      border-radius: 4px;
    }
    button.seg:hover,
    button.seg:focus-visible {
      background: color-mix(in srgb, currentColor 12%, transparent);
      outline: none;
    }
    .seg--current {
      cursor: default;
      font-weight: 600;
    }
    .sep {
      flex: 0 0 auto;
      color: color-mix(in srgb, currentColor 50%, transparent);
      user-select: none;
      padding: 0 0.05rem;
    }
  `;

  render() {
    if (this.path.length === 0) {
      return nothing;
    }
    const lastIndex = this.path.length - 1;
    return html`
      <nav aria-label="Breadcrumb" data-testid="breadcrumb">
        ${this.path.map((seg, i) => {
          const isCurrent = i === lastIndex;
          const sep =
            i > 0
              ? html`<span class="sep" aria-hidden="true">›</span>`
              : nothing;
          const segNode = isCurrent
            ? html`<span
                class="seg seg--current"
                data-testid="crumb"
                data-node-id=${seg.id}
                aria-current="page"
                >${seg.title}</span
              >`
            : html`<button
                class="seg"
                type="button"
                data-testid="crumb"
                data-node-id=${seg.id}
                @click=${() => this.handleNavigate(seg.id)}
              >
                ${seg.title}
              </button>`;
          return html`${sep}${segNode}`;
        })}
      </nav>
    `;
  }

  private handleNavigate(nodeId: string): void {
    this.dispatchEvent(
      new CustomEvent<BreadcrumbNavigateDetail>(BREADCRUMB_NAVIGATE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { nodeId },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "focus-breadcrumb": FocusBreadcrumb;
  }
  interface HTMLElementEventMap {
    "breadcrumb-navigate": CustomEvent<BreadcrumbNavigateDetail>;
  }
}
