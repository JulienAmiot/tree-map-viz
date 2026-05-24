/**
 * `<picture-node-as-child>` -- compact treemap-tile rendering for
 * `PictureNode` (SPEC §17.119, §17.136 S10).
 *
 * §17.136 S10 -- the entire render output is wrapped in a `<card-frame>`
 * molecule with the molecule's default 22 % / 12 % header/footer
 * (small tree-map tile; defaults apply -- same as S2 BSC AsChild +
 * S4 Computed AsChild + S6 TextNode AsChild + S8 Workflow AsChild).
 * Slot routing:
 *
 *   - `slot="icons"`: the §17.121i disabled indicator. PictureNode
 *     has no aggregation flag, so no §17.116 sigma badge.
 *   - `slot="unit"`: empty (no unit chip on a picture card).
 *   - `slot="title"`: the title text only -- a plain `<h2 slot="title">`
 *     stamped directly by this view rather than routed through
 *     `renderStaticTitle()`'s `prefix` arg (the disabled indicator
 *     moved to its own icons slot; the helper's prefix arg is now
 *     unused on this view).
 *   - `slot="subtitle"`: the §17.121j universal-alignment placeholder
 *     (empty content).
 *   - `slot="body"`: the §17.119 `.value-area` containing the
 *     `<img>` with `object-fit: cover` (or the §17.116 warning-fill
 *     glyph when the image errors).
 *   - `slot="footer-left"` + `slot="footer-right"` + `slot="header-
 *     actions"`: empty. **No timestamp** -- PictureNode is a snapshot
 *     leaf (the domain inherits from `ValueNode<string>` rather than
 *     `HistorizableValueNode<string>`), so there is no value history
 *     to age-stamp. Picture AsParent (S9) keeps the same empty
 *     `footer-right` for the same reason; S13's cutover may surface
 *     a `NodeIdentity.dateIso` creation-date fallback there.
 *
 * Pre-§17.136 S10 the layout was a flat sibling chain:
 *   - Title row (`renderStaticTitle({ prefix: renderDisabledIndicator(...) })`).
 *   - Empty `.subtitle` placeholder (§17.121j universal alignment).
 *   - Value-area filling the rest of the tile (image + warning fallback).
 *
 * The `hasError` flag is reset on every `vm` change in `updated()`
 * so the moment the operator points the URL at a working source the
 * tile retries the load on the next render -- the warning state is
 * not "sticky" across URL edits. Behaviour unchanged by S10.
 *
 * Closes out the PictureNode kind end-to-end: both
 * `<picture-node-as-parent>` (S9) and `<picture-node-as-child>` (S10)
 * now share the unified `<card-frame>` primitive.
 */

import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../../molecules/cardFrame/CardFrame.js";
import "../../molecules/childWeight/WeightEditButton.js";
import {
  disabledToggleStyles,
  renderDisabledIndicator,
} from "../../molecules/disabledToggle.js";
import type { PictureNodeViewModel } from "../../molecules/NodeViewModel.js";
import { tileLayoutStyles } from "../../atoms/tileLayoutStyles.js";

import { ImageErrorController } from "./imageErrorController.js";
import { pictureBodyStyles, renderPictureValueArea } from "./pictureBody.js";

@customElement("picture-node-as-child")
export class PictureNodeAsChild extends LitElement {
  @property({ attribute: false })
  vm: PictureNodeViewModel | null = null;

  /** SPEC §17.136 S13b -- per-child weight forwarded from
      `<children-grid>` via `<node-view>`; pre-fills the
      `<weight-edit-button>` in card-frame's footer-left slot. */
  @property({ type: Number })
  weight = 1;

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
    return html`<card-frame>
      <span slot="icons" data-testid="icons-slot"
        >${renderDisabledIndicator(disabled)}</span
      >
      <h2
        class="title"
        slot="title"
        data-testid="title"
        data-view-kind="PictureNode"
        data-id=${this.vm.id}
      >${this.vm.title}</h2>
      <div class="subtitle" slot="subtitle" data-testid="subtitle"></div>
      ${renderPictureValueArea(
        this.vm.imageUrl,
        this.vm.title,
        this.imageError.hasError,
        this.imageError.handleError,
        "body",
      )}
      <weight-edit-button
        slot="footer-left"
        node-id=${this.vm.id}
        .weight=${this.weight}
      ></weight-edit-button>
    </card-frame>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "picture-node-as-child": PictureNodeAsChild;
  }
}
