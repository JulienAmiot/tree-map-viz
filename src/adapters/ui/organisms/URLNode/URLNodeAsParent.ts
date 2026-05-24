/**
 * `<url-node-as-parent>` -- large parent-strip rendering for
 * `URLNode` (SPEC §17.120, §17.121j refresh, §17.123, §17.136 S11).
 *
 * §17.136 S11 -- the entire render output is wrapped in a `<card-frame>`
 * molecule with inline `--card-header-height: 14%` +
 * `--card-footer-height: 8%` overrides (same focused-panel ratio
 * every other AsParent strand uses; the molecule's 22% / 12%
 * defaults would dominate the ~85vh focused-panel host). Slot
 * routing (shares the §17.121j QR+description split-body layout with
 * the BSC AsParent's metric+description split):
 *
 *   - `slot="icons"`: the §17.121i disabled-switch toggle (URLNode
 *     has no aggregation flag, so no §17.116 sigma badge).
 *   - `slot="unit"`: empty (no unit chip on a URL card).
 *   - `slot="title"`: the inline-editable `<h1>` wrapped in a
 *     `<div slot="title">` (same wrap pattern as S3 / S7 / S9 --
 *     `InlineTitleEditController.renderTitle()` is presentation-
 *     agnostic, doesn't know about slots, so the per-view stamps
 *     the wrapper).
 *   - `slot="subtitle"`: the §17.121j universal-alignment placeholder
 *     (empty for URLNode -- no per-property content to surface).
 *   - `slot="body"`: a `<div class="body">` carrying the §17.121j
 *     split body row -- `.metric-pane` (LEFT, with the QR
 *     `.value-area`) + `.description` aside (RIGHT, with the
 *     §17.123 clickable URL anchor). When `url` is empty the
 *     `data-has-description="false"` modifier collapses the
 *     description and lets the metric-pane fill the row (same
 *     fallback as the BSC asParent's no-description branch).
 *   - `slot="footer-left"` + `slot="footer-right"` + `slot="header-
 *     actions"`: empty. **No timestamp** -- URLNode is a snapshot
 *     leaf (the domain inherits from `ValueNode<string>` rather than
 *     `HistorizableValueNode<string>`); same as PictureNode parent
 *     role (S9). S13's cutover may surface a `NodeIdentity.dateIso`
 *     fallback there, but S11 keeps it empty.
 *
 * Pre-§17.136 S11 the layout used a column-flex host with the
 * title / subtitle / body stacked manually (`display: flex;
 * flex-direction: column` on `:host`, `.title { flex: 0 0 auto }`,
 * `.body { flex: 1 1 auto }`); card-frame's three-row grid now
 * owns the vertical layout, so those rules retire. The `.body`
 * rule keeps its `display: flex; flex-direction: row` for the
 * QR + description split-body, but it's now applied to the
 * card-frame-slotted body wrapper rather than a child of the
 * column-flex host.
 *
 * §17.121j -- the QR `.metric-pane` (LEFT) + URL `.description`
 * aside (RIGHT) split mirrors `BusinessScoreCardNodeAsParent`'s
 * §17.45 metric + description split. §17.123 makes the URL
 * surface actionable via a `target="_blank" rel="noopener
 * noreferrer"` anchor on the operator's desktop kiosk.
 *
 * The §17.45 entering-state animation (drill-into morph hand-off
 * with a description fading in from the right) is intentionally
 * NOT replicated here. The BSC strand carries it because BSC's
 * description field is OPTIONAL -- a child BSC may have no
 * description while its parent does, so the focused-panel
 * description surfaces with a smooth slide-in. URLNode's
 * "description" is just the URL itself, and the URL is the
 * card's whole identity (a URLNode without a URL is a degenerate
 * state, not the typical drill-into target); a static 50/50 split
 * is the right read for the operator without animation overhead.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../../molecules/cardFrame/CardFrame.js";
import { disabledToggleStyles, renderDisabledSwitch } from "../../molecules/disabledToggle.js";
import {
  headerActionsStyles,
  renderHeaderActions,
} from "../../molecules/headerActions.js";
import {
  InlineTitleEditController,
  type InlineTitleEditTarget,
  titleInlineEditStyles,
} from "../../molecules/inlineTitleEdit.js";
import type { URLNodeViewModel } from "../../molecules/NodeViewModel.js";
import { tileLayoutStyles } from "../../atoms/tileLayoutStyles.js";

import { QRGenController } from "./qrGenController.js";
import { renderURLValueArea, urlBodyStyles } from "./urlBody.js";

@customElement("url-node-as-parent")
export class URLNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: URLNodeViewModel | null = null;

  /** SPEC §17.136 S13a -- focused-node parent id; consumed by the
      `header-actions` slot via `renderHeaderActions`. */
  @property({ attribute: "parent-id" })
  parentId = "";

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
    headerActionsStyles,
    css`
      /* SPEC §17.121j / §17.136 S11 -- horizontal flex row holding the QR
         metric-pane (left) and the URL description aside (right).
         Card-frame's body slot fills the body div with the host's
         current width; the row layout keeps the §17.121j split
         intact. The pre-§17.136 S11 column-flex host wrapper
         retires (card-frame's three-row grid drives the vertical
         layout now). When the URL is empty the
         data-has-description="false" modifier collapses the
         description and lets the metric-pane fill the row,
         matching the BSC asParent's no-description fallback. */
      .body {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        width: 100%;
        height: 100%;
        min-height: 0;
        min-width: 0;
      }
      .metric-pane {
        position: relative;
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        flex-shrink: 1;
        flex-basis: 50%;
        min-width: 0;
        min-height: 0;
      }
      .body[data-has-description="false"] .metric-pane {
        flex-basis: 100%;
      }
      /* SPEC §17.121j -- URL description aside. Italicised + muted so
         the QR (the card's primary affordance) keeps the visual
         weight; word-break: break-all because URLs frequently lack
         break opportunities; -webkit-line-clamp keeps a very long
         URL from pushing past the panel height. */
      .description {
        margin: 0;
        padding-left: 0.6rem;
        font-size: 1.5vh;
        line-height: 1.35;
        color: color-mix(in srgb, currentColor 65%, transparent);
        font-style: italic;
        word-break: break-all;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 8;
        -webkit-box-orient: vertical;
        flex-grow: 1;
        flex-shrink: 1;
        flex-basis: 50%;
      }
      /* SPEC §17.123 -- the URL text inside the description aside is
         now a real anchor. Inherits the aside's muted italic so the
         link reads as part of the same surface; the underline is
         the only affordance contrast. */
      .description a {
        color: inherit;
        text-decoration: underline;
        text-decoration-color: color-mix(
          in srgb,
          currentColor 40%,
          transparent
        );
        text-underline-offset: 0.15em;
        word-break: break-all;
        cursor: pointer;
      }
      .description a:hover,
      .description a:focus-visible {
        text-decoration-color: currentColor;
        outline: none;
      }
      /* SPEC §17.121j / §17.136 S11 -- value-area override. The
         metric-pane's column-flex layout handles vertical
         distribution; the value-area only needs to expand to fill
         whatever space is left after the metric-pane's siblings
         claim theirs. */
      .value-area {
        height: auto;
        flex: 1 1 auto;
        min-height: 0;
      }
      /* SPEC §17.121j -- landscape -> portrait fallback for narrow
         focused panels (parent strip rendered as the LEFT 25 %
         rail in landscape, see TreeMapScreen's data-orientation
         rule). The container query keys on the per-view's host
         aspect ratio, so the same rule resolves correctly whether
         the strip is across the top or down the side. Mirror of
         the BSC asParent's §17.46 portrait branch. */
      @container (orientation: portrait) {
        .body {
          flex-direction: column;
        }
        .description {
          padding-left: 0;
          padding-top: 0.4rem;
        }
      }
    `,
  ];

  render() {
    if (!this.vm) {
      return nothing;
    }
    const url = this.vm.url;
    const hasDescription = url.length > 0;
    // SPEC §17.136 S11 -- panel-relative header + footer heights
    // (focused-panel host is ~85vh; card-frame's 22% / 12% defaults
    // would dominate the value-area). Same literals as S1 / S3 / S5
    // / S7 / S9 AsParent migrations.
    const sizing = "--card-header-height: 14%; --card-footer-height: 8%";
    const titleH1 = this.titleEditor.renderTitle("URLNode", nothing);
    return html`<card-frame style=${sizing}>
      <span slot="icons" data-testid="icons-slot"
        >${renderDisabledSwitch(this, this.vm.id, this.vm.disabled ?? false)}</span
      >
      <span slot="header-actions"
        >${renderHeaderActions(this, { nodeId: this.vm.id, parentId: this.parentId })}</span
      >
      <div slot="title" data-testid="title-slot">${titleH1}</div>
      <div class="subtitle" slot="subtitle" data-testid="subtitle"></div>
      <div
        class="body"
        slot="body"
        data-has-description=${hasDescription ? "true" : "false"}
      >
        <div class="metric-pane" data-testid="metric-pane">
          ${renderURLValueArea(this.qr.dataUrl, this.vm.title, this.qr.hasError)}
        </div>
        ${hasDescription
          ? html`<aside class="description" data-testid="description">
              <a
                class="description-link"
                data-testid="description-link"
                href=${url}
                target="_blank"
                rel="noopener noreferrer"
                >${url}</a
              >
            </aside>`
          : nothing}
      </div>
    </card-frame>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "url-node-as-parent": URLNodeAsParent;
  }
}
