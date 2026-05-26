/**
 * `<picture-node-as-parent>` -- large parent-strip rendering for
 * `PictureNode` (SPEC §17.119, §17.136 S9).
 *
 * §17.136 S9 -- the entire render output is wrapped in a `<card-frame>`
 * molecule with inline `--card-header-height: 18%` (§17.141) +
 * `--card-footer-height: 8%` overrides (same focused-panel ratio
 * S1 / S3 / S5 / S7 use; the molecule's 22 % / 12 % defaults would
 * dominate the ~85 vh focused-panel host). Slot routing (same shape
 * as S5 TextNode AsParent, minus the timestamp because Picture is
 * a snapshot leaf without a value history):
 *
 *   - `slot="icons"`: the §17.121i disabled-switch toggle (PictureNode
 *     has no aggregation flag, so no §17.116 sigma badge).
 *   - `slot="unit"`: empty (PictureNode has no unit chip).
 *   - `slot="title"`: the inline-editable `<h1>` wrapped in a
 *     `<div slot="title">` (same wrap pattern as the §17.136 S3
 *     Computed AsParent + §17.136 S7 Workflow AsParent that go
 *     through `InlineTitleEditController.renderTitle()`).
 *   - `slot="subtitle"`: the §17.121j placeholder div (kept so the
 *     focused-panel column reads consistently across kinds).
 *   - `slot="body"`: the §17.119 `.value-area` containing the
 *     `<img object-fit: cover>` (or the §17.116 warning-fill glyph
 *     when the image errors).
 *   - `slot="footer-left"` + `slot="footer-right"` + `slot="header-
 *     actions"`: empty. **No timestamp** -- PictureNode is a snapshot
 *     leaf (the domain inherits from `ValueNode<string>` rather than
 *     `HistorizableValueNode<string>`), so there is no value history
 *     to age-stamp. S13's cutover may surface the NodeIdentity
 *     creation-date fallback on `footer-right` so every card has an
 *     age signal, but S9 keeps it empty for now.
 *
 * Pre-§17.136 S9 the layout was:
 *   - Title (3vh row, click to inline-edit).
 *   - Empty `.subtitle` placeholder (§17.121j universal alignment).
 *   - Value-area filling the rest of the tile (image + warning fallback).
 *
 * Title affordance: pressing Enter / blurring commits via
 * `INLINE_EDIT_TITLE_EVENT` so the composition root can apply it
 * through `EditNodeService.editTitle`. The image is **not** inline-
 * editable -- changing the URL is a structural edit routed through
 * the `EditNodeModal`'s `imageUrl` field. The picture parent role
 * deliberately surfaces only one inline gesture (title) so the
 * read-only-ish "look at the image" interaction stays uncluttered.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../../molecules/cardFrame/CardFrame.js";
import { disabledToggleStyles } from "../../molecules/disabledToggle.js";
import {
  headerActionsStyles,
  renderHeaderActions,
} from "../../molecules/headerActions.js";
import {
  InlineTitleEditController,
  type InlineTitleEditTarget,
  titleInlineEditStyles,
} from "../../molecules/inlineTitleEdit.js";
import type { PictureNodeViewModel } from "../../molecules/NodeViewModel.js";
import { tileLayoutStyles } from "../../atoms/tileLayoutStyles.js";

import "../../molecules/cardBody/CardBody.js";
import { ImageErrorController } from "./imageErrorController.js";
import { pictureBodyStyles, renderPictureValueArea } from "./pictureBody.js";

@customElement("picture-node-as-parent")
export class PictureNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: PictureNodeViewModel | null = null;

  /** SPEC §17.136 S13a -- focused-node parent id; consumed by the
      `header-actions` slot via `renderHeaderActions`. */
  @property({ attribute: "parent-id" })
  parentId = "";

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
    headerActionsStyles,
    css`
      /* SPEC 17.136 S9 -- card-frame's body slot owns the value-area's
         vertical extent through the molecule's 3-row grid (header /
         1fr body / footer); the body's flex column already centres
         the .value-area's img/warning child, but the .value-area
         itself needs height: 100% to fill the body slot so the
         object-fit: cover rule on .picture-img has a known box to
         fit against (without it the img's intrinsic pixel size
         would drive layout and the cover behaviour would silently
         no-op on small viewports). */
      .value-area {
        height: 100%;
      }
    `,
  ];

  render() {
    if (!this.vm) {
      return nothing;
    }
    // SPEC 17.136 S9 -- panel-relative header + footer heights
    // (focused-panel host is ~85vh; card-frame's 22% / 12% defaults
    // would dominate the value-area). Same literals as S1 / S3 / S5
    // / S7 AsParent migrations.
    const sizing = "--card-header-height: 24%; --card-footer-height: 8%";
    const titleH1 = this.titleEditor.renderTitle("PictureNode", nothing);
    return html`<card-frame style=${sizing}>
      <span slot="icons" data-testid="icons-slot"></span>
      <span slot="header-actions"
        >${renderHeaderActions(this, { nodeId: this.vm.id, parentId: this.parentId })}</span
      >
      <div slot="title" data-testid="title-slot">${titleH1}</div>
      <div class="subtitle" slot="subtitle" data-testid="subtitle"></div>
      ${renderPictureValueArea(
        this.vm.imageUrl,
        this.vm.title,
        this.imageError.hasError,
        this.imageError.handleError,
        "body",
      )}
    </card-frame>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "picture-node-as-parent": PictureNodeAsParent;
  }
}
