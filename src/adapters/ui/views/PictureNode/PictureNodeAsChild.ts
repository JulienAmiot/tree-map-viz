/**
 * `<picture-node-as-child>` — compact treemap-tile rendering for
 * `PictureNode` (SPEC §17.119).
 *
 * Layout:
 *   - Title row at the top (`3vh`, vh-sized font, ellipsis on
 *     overflow) — same shared `tileLayoutStyles` as every other
 *     tile, same `data-testid="title"` hook.
 *   - Value-area fills the rest of the tile and hosts an `<img>`
 *     sized to 100 % × 100 % of the area with `object-fit: cover`
 *     (operator's contract: "contain an image, css rule object-fit:
 *     cover"). On the image's `error` event the view swaps the
 *     `<img>` for the same `warning-fill` glyph the `Computed*`
 *     tiles use (SPEC §17.116) — "display the same warning sign as
 *     the computed card on failure".
 *   - No timestamp: `PictureNode` is a snapshot leaf (no history,
 *     no asOf).
 *   - No inline editors on the child role (consistent with
 *     `TextNodeAsChild` and `BusinessScoreCardNodeAsChild`).
 *
 * The `hasError` flag is reset on every `vm` change in `updated()`
 * so the moment the operator points the URL at a working source the
 * tile retries the load on the next render — the warning state is
 * not "sticky" across URL edits.
 */

import { LitElement, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { renderStaticTitle } from "../inlineTitleEdit.js";
import type { PictureNodeViewModel } from "../NodeViewModel.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";

import { pictureBodyStyles, renderPictureValueArea } from "./pictureBody.js";

@customElement("picture-node-as-child")
export class PictureNodeAsChild extends LitElement {
  @property({ attribute: false })
  vm: PictureNodeViewModel | null = null;

  /**
   * Local UI state: `true` once the `<img>`'s `error` event has
   * fired for the current `vm.imageUrl`. Reset whenever the URL
   * changes in `updated()` so a previously-broken URL that has
   * since been replaced renders an `<img>` retry rather than a
   * permanent warning.
   */
  @state()
  private hasError = false;

  /**
   * Last URL the view rendered an `<img>` for. Tracked separately
   * from `vm.imageUrl` so `willUpdate()` can distinguish "vm changed
   * but URL is the same" (preserve the warning state) from "URL
   * actually changed" (clear it and let the new `<img>` retry).
   *
   * Reset in `willUpdate` rather than `updated` so the `hasError`
   * mutation lands BEFORE the render pass — mutating reactive state
   * in `updated` triggers Lit's "scheduled an update after an update
   * completed" warning and forces an extra reconcile, which on a
   * URL swap would briefly paint the stale warning glyph for the
   * new URL before swapping to the fresh `<img>`.
   */
  private lastUrl: string | null = null;

  static readonly styles = [tileLayoutStyles, pictureBodyStyles];

  override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has("vm")) return;
    const currentUrl = this.vm?.imageUrl ?? null;
    if (currentUrl !== this.lastUrl) {
      this.lastUrl = currentUrl;
      if (this.hasError) {
        this.hasError = false;
      }
    }
  }

  private readonly handleImageError = (): void => {
    this.hasError = true;
  };

  render() {
    if (!this.vm) {
      return nothing;
    }
    return html`
      ${renderStaticTitle({
        target: { nodeId: this.vm.id, title: this.vm.title },
        viewKind: "PictureNode",
      })}
      ${renderPictureValueArea(
        this.vm.imageUrl,
        this.vm.title,
        this.hasError,
        this.handleImageError,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "picture-node-as-child": PictureNodeAsChild;
  }
}
