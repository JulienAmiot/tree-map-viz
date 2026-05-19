/**
 * `<picture-node-as-parent>` — large parent-strip rendering for
 * `PictureNode` (SPEC §17.119).
 *
 * Layout:
 *   - Title (top, `2.4vh` row, bright off-white from §17.42, click
 *     to inline-edit). Mirrors `TextNodeAsParent`'s title affordance
 *     — pressing Enter / blurring commits via
 *     `INLINE_EDIT_TITLE_EVENT` so the composition root can apply
 *     it through `EditNodeService.editTitle`.
 *   - Value-area fills the rest of the tile and hosts the `<img>`
 *     (object-fit: cover) with the same warning fallback as the
 *     child role; the image is **not** inline-editable — changing
 *     the URL is a structural edit routed through the
 *     `EditNodeModal`'s `imageUrl` field. The picture parent role
 *     deliberately surfaces only one inline gesture (title) so the
 *     read-only-ish "look at the image" interaction stays
 *     uncluttered.
 *   - No timestamp (snapshot leaf).
 *   - No description.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { disabledToggleStyles, renderDisabledToggleFor } from "../disabledToggle.js";
import {
  InlineTitleEditController,
  type InlineTitleEditTarget,
  titleInlineEditStyles,
} from "../inlineTitleEdit.js";
import type { PictureNodeViewModel } from "../NodeViewModel.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";

import { ImageErrorController } from "./imageErrorController.js";
import { pictureBodyStyles, renderPictureValueArea } from "./pictureBody.js";

@customElement("picture-node-as-parent")
export class PictureNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: PictureNodeViewModel | null = null;

  private readonly titleEditor = new InlineTitleEditController(this);
  private readonly imageError = new ImageErrorController(this);

  getInlineTitleEditTarget(): InlineTitleEditTarget | null {
    return this.vm ? { nodeId: this.vm.id, title: this.vm.title } : null;
  }

  getURL(): string | null {
    return this.vm?.imageUrl ?? null;
  }

  static readonly styles = [
    tileLayoutStyles,
    pictureBodyStyles,
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
      ${this.titleEditor.renderTitle("PictureNode")}
      <div class="subtitle" data-testid="subtitle">
        ${renderDisabledToggleFor(this, this.vm.id, this.vm.disabled ?? false)}
      </div>
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
    "picture-node-as-parent": PictureNodeAsParent;
  }
}
