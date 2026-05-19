/**
 * `<url-node-as-parent>` — large parent-strip rendering for
 * `URLNode` (SPEC §17.120).
 *
 * Layout:
 *   - Title (top, `2.4vh` row, bright off-white from §17.42, click
 *     to inline-edit). Mirrors `PictureNodeAsParent` /
 *     `TextNodeAsParent` title affordances — pressing Enter /
 *     blurring commits via `INLINE_EDIT_TITLE_EVENT` so the
 *     composition root can apply it through
 *     `EditNodeService.editTitle`.
 *   - Value-area fills the rest of the tile and hosts the QR
 *     `<img>` (object-fit: contain) with the same warning fallback
 *     as the child role; the URL is **not** inline-editable —
 *     changing it is a structural edit routed through the
 *     `EditNodeModal`'s `url` field. The URL parent role
 *     deliberately surfaces only one inline gesture (title) so
 *     the read-only-ish "scan the QR" interaction stays
 *     uncluttered. Parity with §17.119 PictureNode parent role.
 *   - No timestamp (snapshot leaf).
 *   - No description shown separately — the URL IS the description
 *     per the §17.120 contract, and the QR code renders it.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { disabledToggleStyles, renderDisabledToggleFor } from "../disabledToggle.js";
import {
  InlineTitleEditController,
  type InlineTitleEditTarget,
  titleInlineEditStyles,
} from "../inlineTitleEdit.js";
import type { URLNodeViewModel } from "../NodeViewModel.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";

import { QRGenController } from "./qrGenController.js";
import { renderURLValueArea, urlBodyStyles } from "./urlBody.js";

@customElement("url-node-as-parent")
export class URLNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: URLNodeViewModel | null = null;

  private readonly titleEditor = new InlineTitleEditController(this);
  private readonly qr = new QRGenController(this);

  getInlineTitleEditTarget(): InlineTitleEditTarget | null {
    return this.vm ? { nodeId: this.vm.id, title: this.vm.title } : null;
  }

  getURL(): string | null {
    return this.vm?.url ?? null;
  }

  static readonly styles = [
    tileLayoutStyles,
    urlBodyStyles,
    titleInlineEditStyles,
    disabledToggleStyles,
    css`
      :host {
        --subtitle-row-height: 2vh;
      }
    `,
  ];

  render() {
    if (!this.vm) {
      return nothing;
    }
    return html`
      ${this.titleEditor.renderTitle("URLNode")}
      <div class="subtitle" data-testid="subtitle">
        ${renderDisabledToggleFor(this, this.vm.id, this.vm.disabled ?? false)}
      </div>
      ${renderURLValueArea(this.qr.dataUrl, this.vm.title, this.qr.hasError)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "url-node-as-parent": URLNodeAsParent;
  }
}
