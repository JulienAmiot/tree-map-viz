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

import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import {
  disabledToggleStyles,
  renderDisabledIndicator,
} from "../../molecules/disabledToggle.js";
import { renderStaticTitle } from "../inlineTitleEdit.js";
import type { PictureNodeViewModel } from "../NodeViewModel.js";
import { tileLayoutStyles } from "../../atoms/tileLayoutStyles.js";

import { ImageErrorController } from "./imageErrorController.js";
import { pictureBodyStyles, renderPictureValueArea } from "./pictureBody.js";

@customElement("picture-node-as-child")
export class PictureNodeAsChild extends LitElement {
  @property({ attribute: false })
  vm: PictureNodeViewModel | null = null;

  static readonly styles = [tileLayoutStyles, pictureBodyStyles, disabledToggleStyles];

  private readonly imageError = new ImageErrorController(this);

  getURL(): string | null {
    return this.vm?.imageUrl ?? null;
  }

  render() {
    if (!this.vm) {
      return nothing;
    }
    const disabled = this.vm.disabled ?? false;
    return html`
      ${renderStaticTitle({
        target: { nodeId: this.vm.id, title: this.vm.title },
        viewKind: "PictureNode",
        prefix: renderDisabledIndicator(disabled),
      })}
      <div class="subtitle" data-testid="subtitle"></div>
      ${renderPictureValueArea(
        this.vm.imageUrl,
        this.vm.title,
        this.imageError.hasError,
        this.imageError.handleError,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "picture-node-as-child": PictureNodeAsChild;
  }
}
