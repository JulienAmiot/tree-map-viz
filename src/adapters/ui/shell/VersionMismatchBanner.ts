/** SPEC §17.86b -- non-blocking strip surfaced when the persistence adapter's §17.86 callback fires. Continue / Reset / Dismiss buttons each dispatch their own CustomEvent; composition root owns the side-effects. Not a modal. */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { VersionMismatchInfo } from "../../persistence/LocalStorageBoardCollectionRepository.js";

export const VERSION_MISMATCH_CONTINUE_READ_ONLY_EVENT = "version-mismatch-continue-read-only";
export const VERSION_MISMATCH_RESET_EVENT = "version-mismatch-reset";
export const VERSION_MISMATCH_DISMISS_EVENT = "version-mismatch-dismiss";

@customElement("version-mismatch-banner")
export class VersionMismatchBanner extends LitElement {
  @property({ attribute: false })
  info: VersionMismatchInfo | null = null;

  static readonly styles = css`
    :host { display: block; }
    :host([hidden]) { display: none; }
    .banner { display: grid; grid-template-columns: 1fr auto auto auto; gap: 0.6rem 1rem; align-items: center; padding: 0.75rem 1rem; background: color-mix(in srgb, currentColor 14%, transparent); border-bottom: 1px solid color-mix(in srgb, currentColor 32%, transparent); color: inherit; font: inherit; }
    .message { line-height: 1.35; font-size: 0.95rem; }
    .message strong { font-weight: 600; }
    .btn { padding: 0.45rem 0.9rem; background: transparent; color: inherit; border: 1px solid color-mix(in srgb, currentColor 35%, transparent); border-radius: 6px; cursor: pointer; font: inherit; white-space: nowrap; }
    .btn:hover, .btn:focus-visible { outline: none; background: color-mix(in srgb, currentColor 16%, transparent); }
    .btn-close { padding: 0.2rem 0.55rem; font-size: 1.1rem; line-height: 1; border-color: transparent; }
    .btn-close:hover, .btn-close:focus-visible { background: color-mix(in srgb, currentColor 16%, transparent); }
  `;

  render() {
    const info = this.info;
    if (info === null) return nothing;
    return html`
      <div class="banner" role="status" data-testid="version-mismatch-banner" data-kind=${info.kind}>
        <span class="message">${this.renderMessage(info)}</span>
        <button type="button" class="btn" data-testid="version-mismatch-continue-read-only" @click=${this.handleContinueReadOnly}>Continue read-only</button>
        <button type="button" class="btn" data-testid="version-mismatch-reset" @click=${this.handleReset}>Reset and lose data</button>
        <button type="button" class="btn btn-close" data-testid="version-mismatch-dismiss" aria-label="Dismiss" @click=${this.handleDismiss}>\u00d7</button>
      </div>
    `;
  }

  private renderMessage(info: VersionMismatchInfo) {
    const persisted = `v${info.persistedMajor.toString()}`;
    const running = `v${info.runningMajor.toString()}`;
    if (info.kind === "future-data") {
      return html`<strong>Saved data from a newer version (${persisted}).</strong> This kiosk runs ${running} and can't safely load ${persisted} data. A fresh seed is in use; pick an action to continue.`;
    }
    return html`<strong>Saved data from an older version (${persisted}).</strong> This kiosk runs ${running} and couldn't migrate the older data automatically. It loaded as-is; saves may corrupt it further.`;
  }

  private readonly handleContinueReadOnly = (): void => {
    this.dispatchEvent(new CustomEvent(VERSION_MISMATCH_CONTINUE_READ_ONLY_EVENT, { bubbles: true, composed: true }));
  };

  private readonly handleReset = (): void => {
    this.dispatchEvent(new CustomEvent(VERSION_MISMATCH_RESET_EVENT, { bubbles: true, composed: true }));
  };

  private readonly handleDismiss = (): void => {
    this.dispatchEvent(new CustomEvent(VERSION_MISMATCH_DISMISS_EVENT, { bubbles: true, composed: true }));
  };
}

declare global {
  interface HTMLElementTagNameMap { "version-mismatch-banner": VersionMismatchBanner }
  interface HTMLElementEventMap {
    "version-mismatch-continue-read-only": CustomEvent<void>;
    "version-mismatch-reset": CustomEvent<void>;
    "version-mismatch-dismiss": CustomEvent<void>;
  }
}
