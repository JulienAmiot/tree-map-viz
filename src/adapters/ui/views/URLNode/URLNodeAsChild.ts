/**
 * `<url-node-as-child>` — compact treemap-tile rendering for
 * `URLNode` (SPEC §17.120).
 *
 * Layout:
 *   - Title row at the top (`3vh`, vh-sized font, ellipsis on
 *     overflow) — same shared `tileLayoutStyles` as every other
 *     tile, same `data-testid="title"` hook.
 *   - Value-area fills the rest of the tile and hosts an `<img>`
 *     of the QR code generated from `vm.url` (via the `qrcode`
 *     npm package, see {@link generateQRDataUrl}), sized to
 *     100 % × 100 % of the area with `object-fit: contain`
 *     (operator's contract: "displays a QR code on the card (css
 *     rule for object fit: contain)"). On QR-generation failure
 *     the view swaps the `<img>` for the same `warning-fill`
 *     glyph the `Computed*` tiles use (SPEC §17.116) — "display
 *     the same warning sign as the computed card on failure",
 *     mirroring §17.119 PictureNode parity.
 *   - No timestamp: `URLNode` is a snapshot leaf (no history, no
 *     asOf).
 *   - No inline editors on the child role (consistent with
 *     `TextNodeAsChild` / `PictureNodeAsChild` / BSC parity).
 *
 * Generation lifecycle: the QR generator is async (the qrcode
 * library returns a Promise even though SVG output is pure-JS
 * synchronous under the hood — see {@link generateQRDataUrl}).
 * `willUpdate` kicks off a fresh generation whenever `vm.url`
 * changes, races are guarded by a monotonically-increasing token
 * so a slow earlier generation cannot overwrite a fast later one,
 * and the resulting data: URL lands in `qrDataUrl` via reactive
 * state so the next render swaps `<nothing>` (or the warning
 * glyph) for the `<img>`.
 *
 * The `hasError` flag is reset on every URL change in `willUpdate`
 * so the moment the operator points the URL at a generatable
 * value the tile retries on the next render — the warning state
 * is not "sticky" across URL edits, matching §17.119 PictureNode
 * semantics.
 */

import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import {
  disabledToggleStyles,
  renderDisabledIndicator,
} from "../disabledToggle.js";
import { renderStaticTitle } from "../inlineTitleEdit.js";
import type { URLNodeViewModel } from "../NodeViewModel.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";

import { QRGenController } from "./qrGenController.js";
import { renderURLValueArea, urlBodyStyles } from "./urlBody.js";

@customElement("url-node-as-child")
export class URLNodeAsChild extends LitElement {
  @property({ attribute: false })
  vm: URLNodeViewModel | null = null;

  static readonly styles = [tileLayoutStyles, urlBodyStyles, disabledToggleStyles];

  private readonly qr = new QRGenController(this);

  getURL(): string | null {
    return this.vm?.url ?? null;
  }

  render() {
    if (!this.vm) {
      return nothing;
    }
    const disabled = this.vm.disabled ?? false;
    return html`
      ${renderStaticTitle({
        target: { nodeId: this.vm.id, title: this.vm.title },
        viewKind: "URLNode",
        prefix: renderDisabledIndicator(disabled),
      })}
      ${renderURLValueArea(this.qr.dataUrl, this.vm.title, this.qr.hasError)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "url-node-as-child": URLNodeAsChild;
  }
}
