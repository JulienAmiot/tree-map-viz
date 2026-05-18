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

import { LitElement, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { renderStaticTitle } from "../inlineTitleEdit.js";
import type { URLNodeViewModel } from "../NodeViewModel.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";

import { generateQRDataUrl } from "./qrGenerator.js";
import { renderURLValueArea, urlBodyStyles } from "./urlBody.js";

@customElement("url-node-as-child")
export class URLNodeAsChild extends LitElement {
  @property({ attribute: false })
  vm: URLNodeViewModel | null = null;

  /**
   * Generated QR-code SVG data: URL for the current `vm.url`, or
   * `null` while the qrcode-library promise is still resolving (or
   * while there is no `vm` to encode). Updated by
   * {@link kickOffGeneration} via the resolved-promise callback.
   */
  @state()
  private qrDataUrl: string | null = null;

  /**
   * §17.120 — flips to `true` when QR generation throws (extremely
   * long payloads exceeding the library's max bit-density at any
   * error-correction level) so the warning glyph renders.
   */
  @state()
  private hasError = false;

  /**
   * Monotonically-increasing token used to guard against the
   * race "URL A's generator promise resolves AFTER URL B's
   * because B was pasted while A was still mid-flight". Each call
   * to {@link kickOffGeneration} bumps the token; only the
   * resolution whose token still matches `qrGenToken` is allowed
   * to mutate `qrDataUrl` / `hasError`.
   */
  private qrGenToken = 0;

  /**
   * Last URL the view kicked off a QR generation for. Tracked
   * separately from `vm.url` so `willUpdate` can distinguish "vm
   * changed but URL is the same" (preserve the current QR — no
   * regeneration) from "URL actually changed" (clear state, kick
   * off a new generation).
   */
  private lastUrl: string | null = null;

  static readonly styles = [tileLayoutStyles, urlBodyStyles];

  override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has("vm")) return;
    const currentUrl = this.vm?.url ?? null;
    if (currentUrl !== this.lastUrl) {
      this.lastUrl = currentUrl;
      // Reset both reactive states BEFORE render so the value-area
      // template falls back to `nothing` (the briefly-blank slot)
      // until the new QR resolves — never paints a stale QR for the
      // new URL even for one frame. Mirrors §17.119 PictureNode's
      // willUpdate hasError reset pattern.
      this.qrDataUrl = null;
      this.hasError = false;
      this.kickOffGeneration(currentUrl);
    }
  }

  /**
   * Fire-and-forget QR generation guarded by `qrGenToken`. We do
   * NOT await this from `willUpdate` — Lit's lifecycle is
   * synchronous and we want the empty value-area to render
   * immediately while the qrcode promise resolves; the resolution
   * callback mutates state which re-triggers a render with the
   * new data: URL.
   */
  private kickOffGeneration(url: string | null): void {
    if (url === null) return;
    const tag = ++this.qrGenToken;
    generateQRDataUrl(url).then(
      (dataUrl) => {
        if (tag !== this.qrGenToken) return;
        this.qrDataUrl = dataUrl;
      },
      () => {
        if (tag !== this.qrGenToken) return;
        this.hasError = true;
      },
    );
  }

  render() {
    if (!this.vm) {
      return nothing;
    }
    return html`
      ${renderStaticTitle({
        target: { nodeId: this.vm.id, title: this.vm.title },
        viewKind: "URLNode",
      })}
      ${renderURLValueArea(this.qrDataUrl, this.vm.title, this.hasError)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "url-node-as-child": URLNodeAsChild;
  }
}
