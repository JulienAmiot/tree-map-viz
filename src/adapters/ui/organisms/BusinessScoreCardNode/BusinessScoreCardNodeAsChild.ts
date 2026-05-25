/**
 * `<business-score-card-as-child>` — compact treemap-tile rendering
 * for `BusinessScoreCardNode` (SPEC §5, §17.14, §17.18, §17.136 S2,
 * §17.139, §17.142a).
 *
 * SPEC §17.142a — migrates the body off the pre-§17.142a per-view
 * `.value-area` grid onto the shared `<card-body>` molecule. The
 * three SVG-mono cells (`current-value`, `target-value`, `target-date`)
 * now sit in the molecule's `lead` / `aux` / `meta` slots and inherit
 * the §17.142 stretch-alignment + container-query portrait flip "for
 * free". The pre-§17.142a `.value-area` grid declaration + the
 * `display: contents` `.target-row` flatten retire here (the wrapper
 * was a §17.139c workaround against the shared `tileLayoutStyles`
 * grid rule that no longer applies to AsChild).
 *
 * SPEC §17.142a also addresses three concrete §17.141 review items:
 *   - **"doesn't fill the whole space"** — `<card-body>` cells
 *     stretch (`align-items: stretch`) so the SVG-mono glyph reaches
 *     the bottom of its row instead of leaving slack underneath.
 *   - **"title relatively too big"** — the title text moves into an
 *     SVG-mono wrapper so it scales with the title slot's width
 *     (same `<svg width="100%" height="auto">` mechanic the value
 *     glyph uses); a long title renders as a shorter (squat) SVG
 *     that fits horizontally, a short title renders as a taller
 *     SVG. The §17.42 fixed `2vh` font-size on the shared `.title`
 *     rule was visually too dominant on small child tiles where the
 *     value glyph also competes for the limited canvas.
 *   - **"target and date are missing"** — falls out of the migration
 *     naturally: the new `aux` + `meta` cells render the target
 *     value + target date as direct grid items, no `display:
 *     contents` flatten hack needed.
 */

import { LitElement, css, html, nothing, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../../atoms/icon/Icon.js";
import "../../molecules/cardBody/CardBody.js";
import "../../molecules/cardFrame/CardFrame.js";
import "../../molecules/childWeight/WeightEditButton.js";
import {
  disabledToggleStyles,
  renderDisabledIndicator,
} from "../../molecules/disabledToggle.js";
import type { BusinessScoreCardNodeViewModel } from "../../molecules/NodeViewModel.js";
import { formatAge } from "../../atoms/ageFormat.js";
import { formatValue } from "../../atoms/numberFormat.js";
import { formatTargetDate } from "../../molecules/objective/TargetDate.js";
import { MONO_CHAR_WIDTH, renderMonoTextSvg } from "../../atoms/svgMonoText.js";
import { tileLayoutStyles } from "../../atoms/tileLayoutStyles.js";
import {
  TARGET_ICON_BG,
  TREND_ARROW_BG,
} from "../../molecules/trendArrowBg.js";
import {
  renderUnitChip,
  unitChipStyles,
  unitFromBscValue,
} from "../../molecules/unitChip.js";
import { timestampForValue } from "./valueTemplate.js";

const TREND_ARROW_LABELS = {
  up: "Trend: well ahead of schedule",
  "up-right": "Trend: on or near schedule",
  right: "Trend: flat",
  "down-right": "Trend: slight regression",
  down: "Trend: significant regression",
} as const satisfies Record<
  NonNullable<BusinessScoreCardNodeViewModel["objective"]["trendArrow"]>,
  string
>;

function valueTextOf(vm: BusinessScoreCardNodeViewModel): string | null {
  const value = vm.value;
  switch (value.kind) {
    case "computedMean":
      return formatValue(value.mean);
    case "recordedValue":
      return formatValue(value.value);
    case "childrenCount":
      return value.n === 0 ? null : `${value.n} children`;
  }
}

function dataValueKindOf(vm: BusinessScoreCardNodeViewModel): string {
  const value = vm.value;
  if (value.kind === "childrenCount" && value.n === 0) {
    return "childrenCount-empty";
  }
  return value.kind;
}

@customElement("business-score-card-as-child")
export class BusinessScoreCardNodeAsChild extends LitElement {
  @property({ attribute: false })
  vm: BusinessScoreCardNodeViewModel | null = null;

  /** SPEC §17.136 S13b — per-child weight forwarded from
   *  `<children-grid>`; see file docblock. */
  @property({ type: Number })
  weight = 1;

  static readonly styles = [
    tileLayoutStyles,
    disabledToggleStyles,
    unitChipStyles,
    css`
      .computed-badge {
        font-weight: 700;
        opacity: 0.75;
        margin-right: 0.25em;
        font-size: 0.95em;
      }
      .timestamp {
        position: static;
        bottom: auto;
        right: auto;
      }
      /* SPEC 17.142a -- title slot hosts an svgMonoText
         width=100%/height=auto SVG so the title scales with the
         slot width the same way the value glyph scales with its
         cell. Wrapper resets the inherited .title rule's 2vh
         font-size (the shared tileLayoutStyles default) +
         text-overflow ellipsis (no longer needed -- the SVG
         viewBox handles long-title fit). */
      .title {
        height: 100%;
        font-size: inherit;
        line-height: 1;
        white-space: normal;
        overflow: visible;
        text-overflow: clip;
      }
      .current-value,
      .target-value,
      .target-date {
        display: flex;
        align-items: center;
        height: 100%;
        width: 100%;
        min-width: 0;
        background-repeat: no-repeat;
      }
      .current-value {
        color: var(--bsc-value-color, currentColor);
        font-weight: 700;
        background-position: right center;
        background-size: auto 60%;
      }
      .current-value[data-direction="up"] {
        background-image: ${unsafeCSS(TREND_ARROW_BG.up)};
      }
      .current-value[data-direction="up-right"] {
        background-image: ${unsafeCSS(TREND_ARROW_BG["up-right"])};
      }
      .current-value[data-direction="right"] {
        background-image: ${unsafeCSS(TREND_ARROW_BG.right)};
      }
      .current-value[data-direction="down-right"] {
        background-image: ${unsafeCSS(TREND_ARROW_BG["down-right"])};
      }
      .current-value[data-direction="down"] {
        background-image: ${unsafeCSS(TREND_ARROW_BG.down)};
      }
      .target-value {
        position: relative;
        background-image: ${unsafeCSS(TARGET_ICON_BG)};
        background-position: left center;
        background-size: auto 80%;
      }
      .target-value > .warning-icon {
        position: absolute;
        right: 0.1em;
        top: 50%;
        transform: translateY(-50%);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 60%;
        aspect-ratio: 1 / 1;
        color: currentColor;
        pointer-events: none;
        user-select: none;
      }
      .target-value > .warning-icon > ds-icon {
        width: 100%;
        height: 100%;
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
    const valueText = valueTextOf(this.vm);
    const valueKind = dataValueKindOf(this.vm);
    const valueColor = this.vm.objective.valueColor;
    const direction = this.vm.objective.trendArrow;
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
      >${renderMonoTextSvg(this.vm.title, { fontWeight: 700 })}</h2>
      <div class="subtitle" slot="subtitle" data-testid="subtitle"></div>
      <card-body slot="body" data-testid="value-row">
        <div
          slot="lead"
          class="current-value"
          data-testid="value"
          data-value-kind=${valueKind}
          data-direction=${direction ?? ""}
          aria-label=${direction ? TREND_ARROW_LABELS[direction] : ""}
          style=${valueColor ? `--bsc-value-color: ${valueColor}` : ""}
        >${valueText === null
          ? nothing
          : renderMonoTextSvg(valueText, {
              rightPadding: valueText.length * MONO_CHAR_WIDTH * 0.1,
            })}</div>
        ${this.renderTargetCells()}
      </card-body>
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

  private renderTargetCells() {
    if (!this.vm) return nothing;
    if (this.vm.value.kind === "childrenCount" && this.vm.value.n === 0) {
      return nothing;
    }
    const obj = this.vm.objective;
    // SPEC §17.141 -- the target cell renders ONLY the bare numeric
    // value (the unit lives on the title-prefix chip per §17.125).
    const targetText = formatValue(obj.targetValue);
    return html`<div
        slot="aux"
        class="target-value"
        data-testid="target-text"
      >
        ${renderMonoTextSvg(targetText, { leftPadding: 28, fontWeight: 400 })}
        ${obj.warningColor
          ? html`<span
              class="warning-icon"
              data-testid="off-track-warning"
              role="img"
              aria-label="Trajectory predicts missing the deadline"
              style=${`color: ${obj.warningColor}`}
              ><ds-icon name="triangle-alert"></ds-icon
            ></span>`
          : nothing}
      </div>
      ${obj.targetDateIso
        ? html`<time
            slot="meta"
            class="target-date"
            data-testid="target-date"
            datetime=${obj.targetDateIso}
            >${renderMonoTextSvg(formatTargetDate(obj.targetDateIso), {
              leftPadding: 28,
              fontWeight: 400,
            })}</time
          >`
        : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "business-score-card-as-child": BusinessScoreCardNodeAsChild;
  }
}
