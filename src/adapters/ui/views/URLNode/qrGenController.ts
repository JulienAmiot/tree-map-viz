/**
 * Reactive controller that owns the QR-code generation lifecycle for
 * a URLNode view (SPEC §17.120).
 *
 * Pre-extraction both URLNodeAsParent + URLNodeAsChild duplicated:
 *
 *   - the `qrDataUrl` / `hasError` reactive slots,
 *   - the `qrGenToken` race guard counter,
 *   - the `lastUrl` change-tracker,
 *   - the `kickOffGeneration` async dispatcher that races
 *     monotonically-incremented tokens against the slow promise
 *     resolution so a fast later URL edit can't be clobbered by a
 *     slow earlier promise,
 *   - the `willUpdate` URL-diff hook that resets state + kicks off
 *     a new generation.
 *
 * The shared controller absorbs all of that. A view installs it,
 * implements {@link QRGenHost.getURL} to surface the current URL,
 * and reads `controller.dataUrl` + `controller.hasError` in its
 * render path. The controller also re-triggers a host update on
 * every state change so Lit's reactive render loop picks up the
 * async resolution.
 */

import type { ReactiveController, ReactiveControllerHost } from "lit";

import { generateQRDataUrl } from "./qrGenerator.js";

export interface QRGenHost extends ReactiveControllerHost {
  /** Returns the current URL to encode, or `null` if the view has no vm yet. */
  getURL(): string | null;
}

export class QRGenController implements ReactiveController {
  private readonly host: QRGenHost;
  private lastUrl: string | null = null;
  private qrGenToken = 0;

  /**
   * Generated QR-code data URL for the current source URL, or
   * `null` while the qrcode promise is still resolving / before
   * a URL is set.
   */
  dataUrl: string | null = null;

  /**
   * `true` once the qrcode library has rejected the URL (the
   * payload exceeded the max bit-density on every error-
   * correction level). Resets on every URL change so the view
   * gets a fresh chance once the operator edits the URL.
   */
  hasError = false;

  constructor(host: QRGenHost) {
    this.host = host;
    host.addController(this);
  }

  /**
   * Called by the host's own `willUpdate` (the only hook Lit
   * surfaces where reactive state mutations land before render).
   * The host shouldn't need to invoke this manually for normal
   * vm updates — but exposing the imperative seam means a view
   * with a non-standard refresh signal can still re-sync.
   */
  syncFromURL(currentUrl: string | null): void {
    if (currentUrl === this.lastUrl) return;
    this.lastUrl = currentUrl;
    // Reset both reactive states BEFORE the kicked-off promise
    // resolves so the value-area template falls back to its
    // pending-state (nothing / warning glyph swap) until the
    // new QR resolves — never paints a stale QR for the new
    // URL even for one frame.
    this.dataUrl = null;
    this.hasError = false;
    this.kickOffGeneration(currentUrl);
    this.host.requestUpdate();
  }

  hostUpdate(): void {
    this.syncFromURL(this.host.getURL());
  }

  /**
   * Fire-and-forget QR generation guarded by `qrGenToken`. We do
   * NOT await this from the host's lifecycle — Lit's render is
   * synchronous and we want the empty value-area to render
   * immediately while the qrcode promise resolves; the resolution
   * callback mutates `dataUrl` / `hasError` and re-requests the
   * host update.
   */
  private kickOffGeneration(url: string | null): void {
    if (url === null) return;
    const tag = ++this.qrGenToken;
    generateQRDataUrl(url).then(
      (data) => {
        if (tag !== this.qrGenToken) return;
        this.dataUrl = data;
        this.host.requestUpdate();
      },
      () => {
        if (tag !== this.qrGenToken) return;
        this.hasError = true;
        this.host.requestUpdate();
      },
    );
  }
}
