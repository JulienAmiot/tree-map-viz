/**
 * `<parent-identity-strip>` — Lit element that renders the focused node in
 * the parent role at the top of the kiosk viewport (SPEC §4 / §12.1).
 *
 * Sizing (20–25 % of the viewport, always visible at the top in both
 * orientations per option c1) is owned by the shell's CSS grid; this
 * element just slots in. It is intentionally thin: a `data-testid` /
 * `data-focused-id` wrapper around `<node-view view-role="asParent">`.
 *
 * Importing `../views/index.js` is the side-effect import that registers
 * + freezes `nodeViewRegistry`; the strip never registers entries itself.
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../views/index.js";
import type { NodeViewModel } from "../views/NodeViewModel.js";

@customElement("parent-identity-strip")
export class ParentIdentityStrip extends LitElement {
  @property({ attribute: false })
  vm: NodeViewModel | null = null;

  static styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
    }
    .strip {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      padding: clamp(0.5rem, 1.5vw, 1.25rem);
      border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    }
    node-view {
      display: block;
      width: 100%;
      height: 100%;
    }
  `;

  render() {
    const focusedId = this.vm?.id ?? "";
    return html`<header
      class="strip"
      data-testid="parent-strip"
      data-focused-id=${focusedId}
    >
      ${this.vm
        ? html`<node-view view-role="asParent" .vm=${this.vm}></node-view>`
        : html``}
    </header>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "parent-identity-strip": ParentIdentityStrip;
  }
}
