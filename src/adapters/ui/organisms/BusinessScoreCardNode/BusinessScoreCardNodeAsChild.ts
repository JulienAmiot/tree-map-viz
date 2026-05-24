/**
 * `<business-score-card-as-child>` — compact treemap-tile rendering for
 * `BusinessScoreCardNode` (SPEC §5 — refined in §17.14, §17.18,
 * §17.136 S2).
 *
 * Same fields and timestamp policy as `<business-score-card-as-parent>`
 * (§5 — uniform fields across roles); same shared `tileLayoutStyles`.
 *
 * SPEC §17.136 S2 — the AsChild render is wrapped in `<card-frame>`
 * and routed to the operator-pinned slot map:
 *   - disabled indicator + sigma badge → `slot="icons"`
 *   - unit chip → `slot="unit"`
 *   - title text → `slot="title"`
 *   - subtitle placeholder → `slot="subtitle"`
 *   - value-area (value + trend + target) → `slot="body"`
 *   - timestamp → `slot="footer-right"` (was bottom-right corner-
 *     anchored via tileLayoutStyles `.timestamp { position: absolute }`;
 *     overridden locally to `position: static` so the slotted
 *     timestamp sits in card-frame's natural footer flow)
 *   - `slot="footer-left"` stays empty in S2; S13 fills it with the
 *     `<weight-edit-button>` (the §17.52 affordance currently mounted
 *     as a corner overlay by `<children-grid>`)
 *   - `slot="header-actions"` stays empty on AsChild (AsParent gets
 *     close-X + edit-pencil in S13; child tiles never carried those
 *     affordances).
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../../atoms/icon/Icon.js";
import "../../molecules/cardFrame/CardFrame.js";
import "../../molecules/childWeight/WeightEditButton.js";
import {
  disabledToggleStyles,
  renderDisabledIndicator,
} from "../../molecules/disabledToggle.js";
import type { BusinessScoreCardNodeViewModel } from "../../molecules/NodeViewModel.js";
import { formatAge } from "../../atoms/ageFormat.js";
import { tileLayoutStyles } from "../../atoms/tileLayoutStyles.js";
import {
  renderUnitChip,
  unitChipStyles,
  unitFromBscValue,
} from "../../molecules/unitChip.js";
import {
  renderTargetRow,
  renderTrendArrow,
  renderValueTemplate,
  timestampForValue,
} from "./valueTemplate.js";

@customElement("business-score-card-as-child")
export class BusinessScoreCardNodeAsChild extends LitElement {
  @property({ attribute: false })
  vm: BusinessScoreCardNodeViewModel | null = null;

  /** SPEC §17.136 S13b -- per-child weight forwarded from
      `<children-grid>` via `<node-view>`; pre-fills the
      `<weight-edit-button>` stamped in card-frame's footer-left
      slot so the popover can seed its slider without a second VM
      lookup. */
  @property({ type: Number })
  weight = 1;

  static readonly styles = [
    tileLayoutStyles,
    disabledToggleStyles,
    unitChipStyles,
    css`
      /* SPEC §17.116 -- Σ prefix in the title row when the value
         branch is "computedMean". Same rule shape as the asParent
         role (cf. BSC asParent .computed-badge) and the §17.104
         Computed* cards. */
      .computed-badge {
        font-weight: 700;
        opacity: 0.75;
        margin-right: 0.25em;
        font-size: 0.95em;
      }
      /* SPEC 17.136 S2 -- the timestamp moved from the §17.18 absolute
         bottom-right corner-anchor into card-frame's footer-right slot.
         Override the tileLayoutStyles' position:absolute / bottom /
         right so the slotted timestamp sits in card-frame's natural
         footer flow. The age-color + font-size + tabular-nums + nowrap
         from tileLayoutStyles stay intact. */
      .timestamp {
        position: static;
        bottom: auto;
        right: auto;
      }
    `,
  ];

  render() {
    if (!this.vm) {
      return html``;
    }
    const dateIso = timestampForValue(this.vm);
    const dateColor = this.vm.dateColor;
    const showBadge = this.vm.value.kind === "computedMean";
    const disabled = this.vm.disabled ?? false;
    const unit = unitFromBscValue(this.vm.value);
    return html`<card-frame>
      <span slot="icons" data-testid="icons-slot"
        >${renderDisabledIndicator(disabled)}${showBadge
          ? html`<span class="computed-badge" data-testid="computed-badge" aria-label="Computed value"><ds-icon name="sigma"></ds-icon></span>`
          : nothing}</span
      >
      <span slot="unit" data-testid="unit-slot">${renderUnitChip(unit)}</span>
      <h2
        class="title"
        slot="title"
        data-testid="title"
        data-view-kind="BusinessScoreCardNode"
        data-id=${this.vm.id}
      >${this.vm.title}</h2>
      <div class="subtitle" slot="subtitle" data-testid="subtitle"></div>
      <div class="value-area" slot="body" data-testid="value-row">
        <div class="value-row">
          ${renderValueTemplate(this.vm)}
          ${renderTrendArrow(this.vm)}
        </div>
        ${renderTargetRow(this.vm)}
      </div>
      ${dateIso
        ? html`<time
            class="timestamp"
            slot="footer-right"
            data-testid="value-date"
            datetime=${dateIso}
            style=${dateColor ? `--age-color: ${dateColor}` : ""}
            >${formatAge(dateIso)}</time
          >`
        : nothing}
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
    "business-score-card-as-child": BusinessScoreCardNodeAsChild;
  }
}
