/**
 * `<url-node-as-parent>` — large parent-strip rendering for
 * `URLNode` (SPEC §17.120, §17.121j refresh).
 *
 * Layout (post-§17.121j):
 *   - Title (top, `2.4vh` row, bright off-white from §17.42, click
 *     to inline-edit). Mirrors `PictureNodeAsParent` /
 *     `TextNodeAsParent` title affordances — pressing Enter /
 *     blurring commits via `INLINE_EDIT_TITLE_EVENT` so the
 *     composition root can apply it through
 *     `EditNodeService.editTitle`.
 *   - Subtitle slot (§17.121e + §17.121j universal reservation) —
 *     empty for URLNode; reserved so the value-area's vertical
 *     position aligns with every other tile across the kiosk wall.
 *   - Body row directly below the subtitle — a flex **row** with
 *     two children, mirroring `BusinessScoreCardNodeAsParent`'s
 *     §17.45 split:
 *       * `.metric-pane` (LEFT) — hosts the QR value-area with the
 *         same `object-fit: contain` rule as the child role.
 *       * `.description` (RIGHT) — the URL itself rendered as a
 *         **clickable anchor** (`<a target="_blank"
 *         rel="noopener noreferrer">`). Operator-requested upgrade
 *         from the §17.121j read-only text aside: on a desktop
 *         kiosk the QR code is overkill if the operator already
 *         has the device in front of them — a tap on the URL
 *         opens it directly in a new tab. The §17.120 contract
 *         still holds ("the URL IS the description for a URLNode" —
 *         one slot in the envelope, not two); §17.121j makes that
 *         contract visible on the focused panel by surfacing the
 *         URL string next to its QR encoding, and §17.123 makes
 *         the same surface actionable. The `noopener noreferrer`
 *         pair is the standard safety belt: prevents the opened
 *         tab from reaching back into `window.opener`, and strips
 *         the referrer header so the kiosk's internal route does
 *         not leak. A long URL still line-clamps gracefully so it
 *         can't push past the panel height.
 *   - When `url` is empty (the VM mapper still emits a vm even for
 *     a zero-length URL slot) the `.description` aside is omitted
 *     and the metric-pane fills 100 % of the body — same fallback
 *     shape as the BSC `[data-has-description="false"]` branch.
 *   - No timestamp (snapshot leaf).
 *
 * The §17.45 entering-state animation (drill-into morph hand-off
 * with a description fading in from the right) is intentionally
 * NOT replicated here. The BSC strand carries it because BSC's
 * description field is OPTIONAL — a child BSC may have no
 * description while its parent does, so the focused-panel
 * description surfaces with a smooth slide-in. URLNode's
 * "description" is just the URL itself, and the URL is the
 * card's whole identity (a URLNode without a URL is a degenerate
 * state, not the typical drill-into target); a static 50/50 split
 * is the right read for the operator without animation overhead.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { disabledToggleStyles, renderDisabledSwitch } from "../../molecules/disabledToggle.js";
import {
  InlineTitleEditController,
  type InlineTitleEditTarget,
  titleInlineEditStyles,
} from "../inlineTitleEdit.js";
import type { URLNodeViewModel } from "../NodeViewModel.js";
import { tileLayoutStyles } from "../../atoms/tileLayoutStyles.js";

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
      /* SPEC §17.121j — column-flex host so the title / subtitle /
         body stack vertically and the body fills the remaining
         space below the universal subtitle slot. Mirror of the
         BusinessScoreCardNodeAsParent column-flex layout. */
      :host {
        display: flex;
        flex-direction: column;
      }
      .title {
        flex: 0 0 auto;
      }
      /* SPEC §17.121j — horizontal flex row holding the QR
         metric-pane (left) and the URL description aside (right).
         When the URL is empty the data-has-description="false"
         modifier collapses the description and lets the metric-
         pane fill the row, matching the BSC asParent's no-
         description fallback. */
      .body {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        flex: 1 1 auto;
        min-height: 0;
        min-width: 0;
        width: 100%;
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
      /* SPEC §17.121j — URL description aside. Italicised + muted so
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
      /* SPEC §17.123 — the URL text inside the description aside is
         now a real anchor. Inherits the aside's muted italic so the
         link reads as part of the same surface; the underline is
         the only affordance contrast (operator-readable as "this
         is clickable" against the rest of the body row). The
         underline shifts from translucent to opaque on hover /
         focus so a keyboard-only operator gets the same affordance
         signal as a mouse user. The word-break: break-all rule on
         the anchor repeats the aside's rule so the inline-block
         anchor doesn't force a wider line than its parent. */
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
      /* SPEC §17.121j — value-area override: with the metric-pane
         carrying its own column-flex layout, the shared
         tileLayoutStyles calc(100% - 3vh - subtitle) is no longer
         the right sizing rule. Flex-grow the value-area so the QR
         fills whatever vertical space the metric-pane has after
         the timestamp / siblings claim theirs. */
      .value-area {
        height: auto;
        flex: 1 1 auto;
        min-height: 0;
        /* Mirror the BSC asParent override — the metric-pane's
           column-flex layout handles vertical distribution; the
           value-area only needs to expand to fill it. */
      }
      /* SPEC §17.121j — landscape -> portrait fallback for narrow
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
    return html`
      ${this.titleEditor.renderTitle(
        "URLNode",
        renderDisabledSwitch(this, this.vm.id, this.vm.disabled ?? false),
      )}
      <div class="subtitle" data-testid="subtitle"></div>
      <div
        class="body"
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
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "url-node-as-parent": URLNodeAsParent;
  }
}
