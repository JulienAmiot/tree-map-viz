/**
 * `<url-node-as-child>` -- compact treemap-tile rendering for
 * `URLNode` (SPEC §17.120, §17.136 S12).
 *
 * §17.136 S12 -- the entire render output is wrapped in a `<card-frame>`
 * molecule with the molecule's default 22 % / 12 % header/footer
 * (small tree-map tile; defaults apply -- same as S2 / S4 / S6 / S8 /
 * S10). Closes out the URLNode kind end-to-end (S11 carries
 * AsParent). Slot routing:
 *
 *   - `slot="icons"`: the §17.121i disabled indicator. URLNode has
 *     no aggregation flag, so no §17.116 sigma badge.
 *   - `slot="unit"`: empty (no unit chip on a URL card).
 *   - `slot="title"`: the title text only -- a plain `<h2 slot="title">`
 *     stamped directly by this view rather than routed through
 *     `renderStaticTitle()`'s `prefix` arg (the disabled indicator
 *     moved to its own icons slot; the helper's prefix arg is now
 *     unused on this view, mirroring S10 PictureNode AsChild). The
 *     `renderStaticTitle` import retires from this file; it was the
 *     last per-view in the codebase still importing it.
 *   - `slot="subtitle"`: the §17.121j universal-alignment placeholder
 *     (empty content).
 *   - `slot="body"`: the §17.120 `.value-area` containing the
 *     `<img class="qr-img">` (with `object-fit: contain`) or the
 *     §17.116 warning-fill glyph when QR generation rejects.
 *     Stamped via the §17.136 S12 `renderURLValueArea(..., "body")`
 *     slot-parameter overload (mirror of the §17.136 S9
 *     `renderPictureValueArea` slot-arg extension).
 *   - `slot="footer-left"` + `slot="footer-right"` + `slot="header-
 *     actions"`: empty. **No timestamp** -- URLNode is a snapshot
 *     leaf (same as PictureNode AsChild, S10); the
 *     `tileLayoutStyles` `.timestamp` rule never matches because
 *     the per-view does not render a `.timestamp` element.
 *
 * Pre-§17.136 S12 the layout was a flat sibling chain:
 *   - Title row (`renderStaticTitle({ prefix: renderDisabledIndicator(...) })`).
 *   - Empty `.subtitle` placeholder (§17.121j universal alignment).
 *   - Value-area filling the rest of the tile (QR image + warning fallback).
 *
 * Generation lifecycle: the QR generator is async (the qrcode
 * library returns a Promise even though SVG output is pure-JS
 * synchronous under the hood -- see {@link generateQRDataUrl}).
 * `willUpdate` kicks off a fresh generation whenever `vm.url`
 * changes, races are guarded by a monotonically-increasing token
 * so a slow earlier generation cannot overwrite a fast later one,
 * and the resulting data: URL lands in `qrDataUrl` via reactive
 * state so the next render swaps `<nothing>` (or the warning
 * glyph) for the `<img>`. Behaviour unchanged by S12.
 */

import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../../molecules/cardFrame/CardFrame.js";
import {
  disabledToggleStyles,
  renderDisabledIndicator,
} from "../../molecules/disabledToggle.js";
import type { URLNodeViewModel } from "../../molecules/NodeViewModel.js";
import { tileLayoutStyles } from "../../atoms/tileLayoutStyles.js";

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
    return html`<card-frame>
      <span slot="icons" data-testid="icons-slot"
        >${renderDisabledIndicator(disabled)}</span
      >
      <h2
        class="title"
        slot="title"
        data-testid="title"
        data-view-kind="URLNode"
        data-id=${this.vm.id}
      >${this.vm.title}</h2>
      <div class="subtitle" slot="subtitle" data-testid="subtitle"></div>
      ${renderURLValueArea(this.qr.dataUrl, this.vm.title, this.qr.hasError, "body")}
    </card-frame>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "url-node-as-child": URLNodeAsChild;
  }
}
