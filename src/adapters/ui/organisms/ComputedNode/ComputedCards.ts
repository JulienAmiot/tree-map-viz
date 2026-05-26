/**
 * `<computed-card>` + `<computed-business-score-card>` (SPEC §17.104,
 * §17.116, §17.124, §17.136, §17.142c).
 *
 * §17.142c migrates both classes' body content onto the shared
 * `<card-body>` molecule (`lead`/`aux`/`meta`): numeric value renders
 * as SVG-mono in `lead` with the trend arrow as a CSS background
 * keyed by `data-direction` (mirror of BSC AsChild §17.139/§17.140);
 * CBSN-only target value + target date land in `aux` + `meta` with
 * the bullseye CSS background + off-track warning glyph. Non-numeric
 * branches bypass card-body and render `renderWarningFill` directly.
 * AsChild titles also become SVG-mono so a long title shrinks; the
 * §17.124 inline-edit `<h1>` on AsParent is unchanged.
 *
 * The shared `dispatchComputationKindChange` helper keeps both
 * classes feeding the same `COMPUTATION_KIND_CHANGE_EVENT` payload
 * routed by `main.ts` to `EditNodeService.editFields`.
 */

import { LitElement, html, css, nothing, unsafeCSS, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../../atoms/icon/Icon.js";
import "../../molecules/cardBody/CardBody.js";
import "../../molecules/cardFrame/CardFrame.js";
import "../../molecules/childWeight/WeightEditButton.js";
import { ComputationKind } from "../../../../domain/computation/ComputationKind.js";
import { COMPUTATION_KIND_LABELS } from "../modal/AddChildModal.js";
import type {
  BusinessScoreCardObjectiveViewModel,
  ComputationKindName,
  ComputedBusinessScoreNodeViewModel,
  ComputedNodeViewModel,
  ComputedValueViewModel,
  NodeRole,
} from "../../molecules/NodeViewModel.js";
import { formatAge } from "../../atoms/ageFormat.js";
import {
  disabledToggleStyles,
  renderDisabledIndicator,
} from "../../molecules/disabledToggle.js";
import {
  headerActionsStyles,
  renderHeaderActions,
} from "../../molecules/headerActions.js";
import {
  InlineTitleEditController,
  type InlineTitleEditTarget,
  titleInlineEditStyles,
} from "../../molecules/inlineTitleEdit.js";
import { formatValue } from "../../atoms/numberFormat.js";
import { formatTargetDate } from "../../atoms/targetDateFormat.js";
import { MONO_CHAR_WIDTH, renderMonoTextSvg } from "../../atoms/svgMonoText.js";
import { tileLayoutStyles } from "../../atoms/tileLayoutStyles.js";
import { TARGET_ICON_BG, TREND_ARROW_BG } from "../../molecules/trendArrowBg.js";
import {
  InlineUnitEditController,
  type InlineUnitEditTarget,
  renderUnitChip,
  unitChipStyles,
  unitFromComputedValue,
} from "../../molecules/unitChip.js";

/** SPEC §17.104 — custom event name + payload shape. Retained for the §17.116-followup modal wiring. */
export const COMPUTATION_KIND_CHANGE_EVENT = "computation-kind-change";
export type ComputationKindChangeDetail = { readonly nodeId: string; readonly newKind: ComputationKindName };

/**
 * SPEC §17.121e — short labels for the active computation kind,
 * rendered as the `.subtitle` row's static text on the AsChild
 * Computed* tile. Kept separate from the verbose
 * `COMPUTATION_KIND_LABELS` map in `AddChildModal.ts` (which carries
 * the dropdown-menu descriptors like "Sum (Σ children)") because a
 * tile subtitle must read at a glance — a single noun phrase that
 * fits the cqi-clamped row. The picker's `<option>` text still uses
 * the verbose map so the operator sees the same labels in the
 * AddChildModal kind list, the EditNode modal strategy field, and
 * the parent-tile strategy picker dropdown.
 */
const COMPUTATION_KIND_SHORT_LABELS: Readonly<Record<ComputationKindName, string>> = {
  SUM: "Sum",
  AVERAGE: "Average",
  MIN: "Min",
  MAX: "Max",
  WEIGHTED_AVERAGE: "Weighted average",
  COUNT: "Count",
};

/**
 * SPEC §17.104 / §17.116-followup / §17.121e — strategy picker
 * dispatched from the focused-panel Computed* tile
 * (`viewRole === "asParent"`). One-tap swap without opening
 * `<edit-node-modal>` — the picker fires the
 * `computation-kind-change` event with `{ nodeId, newKind }`, already
 * wired in `main.ts` to `EditNodeService.editFields` via the
 * `computedKindFor` discriminator.
 *
 * SPEC §17.121e — the picker now lives inside the shared `.subtitle`
 * slot (declared in `tileLayoutStyles`) directly under the title.
 * Pre-§17.121e it was absolutely positioned at the tile's top-left
 * corner (an awkward visual location that crowded the title row on
 * narrow panels); centering it under the title aligns it with the
 * AsChild static kind-label and matches the §17.121e generic "one
 * property under the title" contract operators get on the
 * WorkflowNode tile too. The shared `COMPUTATION_KIND_LABELS` map
 * from `AddChildModal.ts` keeps the friendly option labels identical
 * to the modal's strategy dropdown (operator sees the same labels in
 * both surfaces).
 */
function renderStrategyPicker(
  hostNodeId: string,
  currentKind: ComputationKindName,
  onChange: (next: ComputationKindName) => void,
): TemplateResult {
  return html`<div class="strategy-picker" data-testid="strategy-picker">
    <select
      data-testid="strategy-select"
      data-node-id=${hostNodeId}
      .value=${currentKind}
      @change=${(e: Event) => {
        const target = e.target as HTMLSelectElement;
        onChange(target.value as ComputationKindName);
      }}
    >
      ${ComputationKind.ALL.map(
        (k) => html`<option value=${k.name} ?selected=${k.name === currentKind}>
          ${COMPUTATION_KIND_LABELS[k.name] ?? k.name}
        </option>`,
      )}
    </select>
  </div>`;
}

/**
 * SPEC §17.121e — static kind label rendered in the `.subtitle` slot
 * on the AsChild Computed* tile (no inline editing on child tiles,
 * mirror of the AsChild WorkflowNode's read-only status badge). The
 * `data-testid="kind-label"` hook is the same testid the
 * pre-§17.116c kind-label rule carried; the §17.116-followup-2
 * retirement removed the rule + the consumer, the §17.121e refresh
 * re-introduces both with a clearer semantic — "subtitle slot
 * content" rather than "computation-kind ticker".
 */
function renderKindLabel(currentKind: ComputationKindName): TemplateResult {
  return html`<span class="kind-label" data-testid="kind-label"
    >${COMPUTATION_KIND_SHORT_LABELS[currentKind] ?? currentKind}</span
  >`;
}

const sharedStyles = css`
  /* SPEC §17.121e — both Computed cards opt into the shared
     .subtitle slot from tileLayoutStyles. The 2vh row reserves
     space directly under the title for the active computation kind
     (AsChild: a static span.kind-label; AsParent: the
     select.strategy-picker that fires computation-kind-change). */
  :host {
    --subtitle-row-height: 2vh;
  }
  /* SPEC §17.142c -- AsChild title is SVG-mono; reset shared
     tileLayoutStyles' 2vh + ellipsis (mirror of BSC AsChild). */
  :host([view-role="asChild"]) .title {
    height: 100%;
    font-size: inherit;
    line-height: 1;
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
  }
  /* SPEC §17.142c -- 2fr lead matches §17.142a/b BSC ratio. */
  .metric-pane {
    --card-body-lead-cols: 2fr;
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
  /* SPEC §17.142c -- full-body warning glyph for non-numeric. */
  .warning-fill {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: color-mix(in srgb, currentColor 55%, transparent);
  }
  .warning-fill > ds-icon {
    width: clamp(2rem, 30cqmin, 8rem);
    height: clamp(2rem, 30cqmin, 8rem);
  }
  /* SPEC §17.116 — Σ prefix in the title row. Sized at ~0.85em of
     the title's font-size so it reads as a glyph attached to the
     title text rather than a separate element; muted opacity keeps
     the operator's eye on the title text proper. */
  .computed-badge {
    font-weight: 700;
    opacity: 0.75;
    margin-right: 0.25em;
    font-size: 0.95em;
  }
  /* SPEC §17.121e — kind-label sits centered inside the .subtitle
     row on the AsChild tile. Reads as a quiet noun-phrase
     descriptor ("Average", "Weighted average"); the .subtitle
     row's font-size + muted colour come from the shared rule, so
     this class only carries minor letter-spacing for a tasteful
     "small caps"-ish label feel. */
  .kind-label {
    letter-spacing: 0.03em;
    font-weight: 500;
  }
  /* SPEC §17.121e — strategy picker now lives inside the subtitle
     slot. Pre-§17.121e it was absolutely positioned at the tile's
     top-left corner; the in-flow placement under the title aligns
     it with the AsChild kind-label and matches the WorkflowNode
     subtitle pattern. The select inherits text colour + size from
     the subtitle row; the box chrome (background, border, padding)
     is minimal so it reads as a quiet affordance rather than a
     heavy form control. */
  .strategy-picker {
    display: inline-flex;
    align-items: center;
  }
  .strategy-picker select {
    font: inherit;
    /* Match the subtitle row's 1.4vh body font-size; the select
       sits centered in the 2vh row with breathing room. */
    font-size: 1.4vh;
    line-height: 1;
    padding: 0 0.3rem;
    border-radius: 0.25rem;
    background: transparent;
    color: inherit;
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    cursor: pointer;
  }
  /* SPEC 17.136 S4 -- the rendered timestamp lives in card-frame's
     footer-right slot on BOTH roles (S3 scoped this to asParent
     only; S4 promotes it to both because AsChild now also uses
     card-frame). Override the shared tileLayoutStyles .timestamp
     position:absolute / bottom / right so the slotted timestamp
     sits in card-frame's natural footer flow. */
  .timestamp {
    position: static;
    bottom: auto;
    right: auto;
  }
`;

// SPEC §17.142c -- mirror of BSC AsChild's trend-arrow contract:
// direction → screen-reader label baked onto the `.current-value`
// span carrying the CSS-background arrow (replaces §17.131's
// standalone `<ds-icon>` child).
const TREND_ARROW_LABELS = {
  up: "Trend: well ahead of schedule",
  "up-right": "Trend: on or near schedule",
  right: "Trend: flat",
  "down-right": "Trend: slight regression",
  down: "Trend: significant regression",
} as const satisfies Record<
  NonNullable<BusinessScoreCardObjectiveViewModel["trendArrow"]>,
  string
>;

/**
 * SPEC §17.116 — full-tile warning glyph for Computed* tiles whose
 * strategy could not produce a value (or whose eligible-children set
 * is empty). Mirrors the visual contract of the §17.24 PlusTile
 * cross. `data-testid="warning-fill"` is the stable e2e hook; the
 * `data-reason` attribute carries the strategy-error reason when one
 * is known (the `empty` branch) so a future test can assert the
 * cause without parsing rendered text.
 */
function warningReasonFor(value: ComputedValueViewModel): string {
  if (value.kind === "empty") return value.reason;
  if (value.kind === "childrenCount") return `${value.n} ineligible children`;
  return "";
}

function renderWarningFill(value: ComputedValueViewModel): TemplateResult {
  const reason = warningReasonFor(value);
  return html`<div
    class="warning-fill"
    data-testid="warning-fill"
    data-reason=${reason}
    role="img"
    aria-label="Cannot compute value"
  ><ds-icon name="triangle-alert"></ds-icon></div>`;
}

/** SPEC §17.142c -- shared `lead` slot filler. SVG-mono value glyph
 *  with optional trend-arrow CSS background keyed by `data-direction`
 *  (CBSN only; plain `<computed-card>` passes `objective = null`). */
function renderLeadValue(
  value: Extract<ComputedValueViewModel, { kind: "numeric" }>,
  objective: BusinessScoreCardObjectiveViewModel | null,
): TemplateResult {
  const text = formatValue(value.value);
  const direction = objective?.trendArrow ?? null;
  const valueColor = objective?.valueColor ?? "";
  return html`<span
    slot="lead"
    class="current-value value"
    data-testid="value"
    data-value-kind="numeric"
    data-direction=${direction ?? ""}
    aria-label=${direction ? TREND_ARROW_LABELS[direction] : ""}
    style=${valueColor ? `--bsc-value-color: ${valueColor}` : ""}
  >${renderMonoTextSvg(text, {
    rightPadding: text.length * MONO_CHAR_WIDTH * 0.1,
  })}</span>`;
}

/** SPEC §17.142c -- CBSN `aux` (target + warning) + `meta` (target
 *  date) slot fillers; both glyphs render via SVG-mono. */
function renderTargetCells(
  objective: BusinessScoreCardObjectiveViewModel,
): TemplateResult {
  const targetText = formatValue(objective.targetValue);
  return html`<div
      slot="aux"
      class="target-value"
      data-testid="target-row"
    >
      ${renderMonoTextSvg(targetText, { leftPadding: 28, fontWeight: 400 })}
      ${objective.warningColor
        ? html`<span
            class="warning-icon"
            data-testid="off-track-warning"
            role="img"
            aria-label="Trajectory predicts missing the deadline"
            style=${`color: ${objective.warningColor}`}
            ><ds-icon name="triangle-alert"></ds-icon
          ></span>`
        : nothing}
    </div>
    ${objective.targetDateIso
      ? html`<time
          slot="meta"
          class="target-date"
          data-testid="target-date"
          datetime=${objective.targetDateIso}
          >${renderMonoTextSvg(formatTargetDate(objective.targetDateIso), {
            leftPadding: 28,
            fontWeight: 400,
          })}</time
        >`
      : nothing}`;
}

// SPEC §17.136 S4 — the pre-§17.136 helpers `renderTitleWithBadge`,
// `renderInlineTitlePrefix`, and `renderComputedTitleSlot` (which
// composed the disabled switch / sigma badge / unit chip into the
// title's prefix slot for the §17.124 inline-edit AsParent path,
// and as the title's leading children for the AsChild path) are
// retired. Card-frame's split layout puts each piece in a dedicated
// slot (icons / unit), so the prefix-composition machinery is
// unnecessary and `renderAsParentSlots` / `renderAsChildSlots`
// replace the call sites with focused-per-role slot fillers.

/**
 * SPEC §17.104 / §17.116-followup — shared
 * `computation-kind-change` dispatcher. Both Computed card classes
 * fire the same bubbling+composed event with the host node's id +
 * the operator-picked new kind; pre-refactor each class carried
 * an identical instance arrow field. Hoisting the dispatch into a
 * free function lets both classes share one definition (resolving
 * a CPD block reported on 2026-05-22) while keeping the wiring
 * identical from `main.ts`'s perspective.
 */
function dispatchComputationKindChange(
  host: HTMLElement,
  nodeId: string,
  newKind: ComputationKindName,
): void {
  host.dispatchEvent(
    new CustomEvent<ComputationKindChangeDetail>(COMPUTATION_KIND_CHANGE_EVENT, {
      bubbles: true,
      composed: true,
      detail: { nodeId, newKind },
    }),
  );
}

/**
 * SPEC §17.136 S3 + S4 -- timestamp `<time>` declares
 * `slot="footer-right"` so card-frame routes it to the footer's
 * right anchor. The `.timestamp { position: static; ...}` rule
 * (declared in `sharedStyles` since S4 promoted it to both roles)
 * overrides the shared `tileLayoutStyles` absolute corner-anchor.
 * The S3-era `renderTimestamp` helper (which omitted the slot
 * attribute, sourcing the legacy AsChild flat layout's absolute
 * positioning) is retired in S4.
 */
function renderAsParentTimestamp(dateIso: string, dateColor: string): TemplateResult | typeof nothing {
  if (!dateIso) return nothing;
  const styleAttr = dateColor ? `--age-color: ${dateColor}` : "";
  return html`<time slot="footer-right" class="timestamp" data-testid="value-date" datetime=${dateIso} style=${styleAttr}
    >${formatAge(dateIso)}</time>`;
}

/**
 * SPEC §17.136 S4 -- shared AsChild slot fillers for the icons +
 * unit + title + subtitle slots of `<card-frame>`. Mirror of
 * {@link renderAsParentSlots} but routed to the AsChild contracts:
 * disabled INDICATOR (no write affordance), static unit chip,
 * static title h2, static kind-label.
 */
function renderAsChildSlots(args: {
  readonly vmId: string;
  readonly vmTitle: string;
  readonly vmDisabled: boolean;
  readonly showBadge: boolean;
  readonly unit: string;
  readonly viewKind: string;
  readonly computationKind: ComputationKindName;
}): TemplateResult {
  return html`
    <span slot="icons" data-testid="icons-slot"
      >${renderDisabledIndicator(args.vmDisabled)}${args.showBadge
        ? html`<span class="computed-badge" data-testid="computed-badge" aria-label="aggregated"><ds-icon name="sigma"></ds-icon></span>`
        : nothing}</span
    >
    <span slot="unit" data-testid="unit-slot">${renderUnitChip(args.unit)}</span>
    <h2
      class="title"
      slot="title"
      data-testid="title"
      data-view-kind=${args.viewKind}
      data-id=${args.vmId}
    >${renderMonoTextSvg(args.vmTitle, { fontWeight: 700 })}</h2>
    <div slot="subtitle" class="subtitle" data-testid="subtitle">
      ${renderKindLabel(args.computationKind)}
    </div>
  `;
}

/** SPEC §17.142c -- body content for the plain `<computed-card>`
 *  (no objective). Numeric → single `lead` in card-body; non-numeric
 *  → warning glyph in a plain wrapper. Both carry `data-testid=
 *  "value-row"` for the §17.122a disabled-state probe. */
function renderComputedBody(value: ComputedValueViewModel): TemplateResult {
  if (value.kind !== "numeric") {
    return html`<div
      slot="body"
      class="warning-body"
      data-testid="value-row"
    >${renderWarningFill(value)}</div>`;
  }
  return html`<card-body slot="body" data-testid="value-row">
    ${renderLeadValue(value, null)}
  </card-body>`;
}

/** SPEC §17.142c -- body content for CBSN (with objective). Numeric
 *  → lead + aux + meta in card-body; non-numeric → warning glyph in
 *  a plain `.metric-pane` wrapper. Both keep `data-testid=
 *  "metric-pane"` for the §17.136 S3 probe. */
function renderCbsnBody(
  value: ComputedValueViewModel,
  objective: BusinessScoreCardObjectiveViewModel,
): TemplateResult {
  if (value.kind !== "numeric") {
    return html`<div
      slot="body"
      class="metric-pane warning-body"
      data-testid="metric-pane"
    >${renderWarningFill(value)}</div>`;
  }
  return html`<card-body
    slot="body"
    class="metric-pane"
    data-testid="metric-pane"
  >
    ${renderLeadValue(value, objective)}
    ${renderTargetCells(objective)}
  </card-body>`;
}

/**
 * SPEC §17.136 S3 / §17.141 -- shared AsParent slot fillers for
 * the icons + unit + title + subtitle slots of `<card-frame>`.
 * Both Computed card classes feed identical pieces (sigma badge
 * into `icons`, editable unit chip into `unit`, inline-editable
 * title h1 into `title`, strategy picker into `subtitle`);
 * centralising avoids duplication across the two AsParent
 * renderers (would otherwise trip the CPD detector at ~25
 * duplicate lines per class). §17.141 retired the disabled
 * switch from the icons slot (operator feedback: parent cards
 * no longer carry the inline toggle; the edit-modal exposes a
 * checkbox for the same field). The `vmDisabled` arg therefore
 * goes away with the call.
 */
function renderAsParentSlots(args: {
  readonly host: LitElement;
  readonly titleEditor: InlineTitleEditController;
  readonly vmId: string;
  readonly showBadge: boolean;
  readonly unitChip: TemplateResult | typeof nothing;
  readonly viewKind: string;
  readonly computationKind: ComputationKindName;
  readonly onKindChange: (next: ComputationKindName) => void;
  /** SPEC §17.136 S13a -- focused-node parent id; fed into the
      shared `renderHeaderActions` helper for the `header-actions`
      slot's close-X (omitted when `parentId === ""` -- root focus). */
  readonly parentId: string;
}): TemplateResult {
  const titleH1 = args.titleEditor.renderTitle(args.viewKind, nothing);
  return html`
    <span slot="icons" data-testid="icons-slot"
      >${args.showBadge
        ? html`<span class="computed-badge" data-testid="computed-badge" aria-label="aggregated"><ds-icon name="sigma"></ds-icon></span>`
        : nothing}</span
    >
    <span slot="unit" data-testid="unit-slot">${args.unitChip}</span>
    <span slot="header-actions"
      >${renderHeaderActions(args.host, { nodeId: args.vmId, parentId: args.parentId })}</span
    >
    <div slot="title" data-testid="title-slot">${titleH1}</div>
    <div slot="subtitle" class="subtitle" data-testid="subtitle">
      ${renderStrategyPicker(args.vmId, args.computationKind, args.onKindChange)}
    </div>
  `;
}

@customElement("computed-card")
export class ComputedCard extends LitElement {
  @property({ attribute: false })
  vm: ComputedNodeViewModel | null = null;

  /**
   * SPEC §17.104 / §17.116-followup — forwarded by `<node-view>` so
   * the inline strategy picker only renders on the focused-panel
   * tile (`asParent`), not on every child tile in the treemap grid.
   * Defaults to `asChild` so a bare mount (e.g. unit tests that
   * don't set the property) stays read-only and the picker stays
   * hidden. Lit's `@property` declaration makes the read reactive
   * so a runtime role swap re-renders the picker conditionally.
   */
  @property({ attribute: "view-role", reflect: true })
  viewRole: NodeRole = "asChild";

  /** SPEC §17.136 S13a -- focused-node parent id; consumed by the
      AsParent renderer's `header-actions` slot. Forwarded by
      `<node-view>`. Defaults to `""` (root focus -- no close-X). */
  @property({ attribute: "parent-id" })
  parentId = "";

  /** SPEC §17.136 S13b -- per-child weight forwarded from
      `<children-grid>` via `<node-view>`; pre-fills the
      `<weight-edit-button>` in card-frame's footer-left slot on
      the AsChild render branch. AsParent ignores it. */
  @property({ type: Number })
  weight = 1;

  static readonly styles = [
    tileLayoutStyles,
    sharedStyles,
    disabledToggleStyles,
    titleInlineEditStyles,
    unitChipStyles,
    headerActionsStyles,
  ];

  /**
   * SPEC §17.124 — inline title editor for the focused-panel role.
   * Always installed (Lit ReactiveControllers must mount in the
   * constructor / field init for `hostUpdated` to fire); the
   * controller's `renderTitle()` is only invoked on the AsParent
   * render branch via {@link renderComputedTitleSlot}, so AsChild
   * tiles never see the editable `<h1>` or the click-to-edit
   * handlers.
   */
  private readonly titleEditor = new InlineTitleEditController(this);

  /** SPEC §17.126 — inline unit editor. On a plain `Computed*` node
   *  (no business-score card) the persister write at the screen
   *  level no-ops at the kind guard; the chip still renders. */
  private readonly unitEditor = new InlineUnitEditController(this);

  /** SPEC §17.124 — host contract for {@link InlineTitleEditController}. */
  getInlineTitleEditTarget(): InlineTitleEditTarget | null {
    return this.vm ? { nodeId: this.vm.id, title: this.vm.title } : null;
  }

  /** SPEC §17.126 — host contract for {@link InlineUnitEditController}. */
  getInlineUnitEditTarget(): InlineUnitEditTarget | null {
    if (!this.vm) return null;
    return { nodeId: this.vm.id, unit: unitFromComputedValue(this.vm.value) };
  }

  private readonly dispatchKindChange = (newKind: ComputationKindName): void => {
    if (this.vm) dispatchComputationKindChange(this, this.vm.id, newKind);
  };

  render(): TemplateResult {
    if (!this.vm) return html``;
    return this.viewRole === "asParent" ? this.renderAsParent() : this.renderAsChild();
  }

  /** SPEC §17.142c -- header 18% → 24% (mirror §17.142b). */
  private renderAsParent(): TemplateResult {
    if (!this.vm) return html``;
    const showBadge = this.vm.value.kind === "numeric";
    return html`<card-frame style="--card-header-height: 24%; --card-footer-height: 8%">
      ${renderAsParentSlots({
        host: this,
        titleEditor: this.titleEditor,
        vmId: this.vm.id,
        showBadge,
        unitChip: this.unitEditor.renderChip(),
        viewKind: "ComputedNode",
        computationKind: this.vm.computationKind,
        onKindChange: this.dispatchKindChange,
        parentId: this.parentId,
      })}
      ${renderComputedBody(this.vm.value)}
    </card-frame>`;
  }

  private renderAsChild(): TemplateResult {
    if (!this.vm) return html``;
    const showBadge = this.vm.value.kind === "numeric";
    const vmDisabled = this.vm.disabled ?? false;
    return html`<card-frame>
      ${renderAsChildSlots({
        vmId: this.vm.id,
        vmTitle: this.vm.title,
        vmDisabled,
        showBadge,
        unit: unitFromComputedValue(this.vm.value),
        viewKind: "ComputedNode",
        computationKind: this.vm.computationKind,
      })}
      ${renderComputedBody(this.vm.value)}
      <weight-edit-button
        slot="footer-left"
        node-id=${this.vm.id}
        .weight=${this.weight}
      ></weight-edit-button>
    </card-frame>`;
  }
}

@customElement("computed-business-score-card")
export class ComputedBusinessScoreCard extends LitElement {
  @property({ attribute: false })
  vm: ComputedBusinessScoreNodeViewModel | null = null;

  /** SPEC §17.104 / §17.116-followup — see `ComputedCard.viewRole`. */
  @property({ attribute: "view-role", reflect: true })
  viewRole: NodeRole = "asChild";

  /** SPEC §17.136 S13a -- see `ComputedCard.parentId`. */
  @property({ attribute: "parent-id" })
  parentId = "";

  /** SPEC §17.136 S13b -- see `ComputedCard.weight`. */
  @property({ type: Number })
  weight = 1;

  static readonly styles = [
    tileLayoutStyles,
    sharedStyles,
    disabledToggleStyles,
    titleInlineEditStyles,
    unitChipStyles,
    headerActionsStyles,
  ];

  /** SPEC §17.124 — see `ComputedCard.titleEditor`. */
  private readonly titleEditor = new InlineTitleEditController(this);

  /** SPEC §17.126 — see `ComputedCard.unitEditor`. */
  private readonly unitEditor = new InlineUnitEditController(this);

  /** SPEC §17.124 — see `ComputedCard.getInlineTitleEditTarget`. */
  getInlineTitleEditTarget(): InlineTitleEditTarget | null {
    return this.vm ? { nodeId: this.vm.id, title: this.vm.title } : null;
  }

  /** SPEC §17.126 — see `ComputedCard.getInlineUnitEditTarget`. */
  getInlineUnitEditTarget(): InlineUnitEditTarget | null {
    if (!this.vm) return null;
    return { nodeId: this.vm.id, unit: unitFromComputedValue(this.vm.value) };
  }

  private readonly dispatchKindChange = (newKind: ComputationKindName): void => {
    if (this.vm) dispatchComputationKindChange(this, this.vm.id, newKind);
  };

  render(): TemplateResult {
    if (!this.vm) return html``;
    return this.viewRole === "asParent" ? this.renderAsParent() : this.renderAsChild();
  }

  /** SPEC §17.142c -- header 18% → 24% (mirror §17.142b). */
  private renderAsParent(): TemplateResult {
    if (!this.vm) return html``;
    const { dateIso, dateColor, objective } = this.vm;
    const showBadge = this.vm.value.kind === "numeric";
    const canCompute = this.vm.value.kind === "numeric";
    return html`<card-frame style="--card-header-height: 24%; --card-footer-height: 8%">
      ${renderAsParentSlots({
        host: this,
        titleEditor: this.titleEditor,
        vmId: this.vm.id,
        showBadge,
        unitChip: this.unitEditor.renderChip(),
        viewKind: "ComputedBusinessScoreNode",
        computationKind: this.vm.computationKind,
        onKindChange: this.dispatchKindChange,
        parentId: this.parentId,
      })}
      ${renderCbsnBody(this.vm.value, objective)}
      ${canCompute ? renderAsParentTimestamp(dateIso, dateColor) : nothing}
    </card-frame>`;
  }

  private renderAsChild(): TemplateResult {
    if (!this.vm) return html``;
    const { dateIso, dateColor, objective } = this.vm;
    const showBadge = this.vm.value.kind === "numeric";
    const canCompute = this.vm.value.kind === "numeric";
    const vmDisabled = this.vm.disabled ?? false;
    return html`<card-frame>
      ${renderAsChildSlots({
        vmId: this.vm.id,
        vmTitle: this.vm.title,
        vmDisabled,
        showBadge,
        unit: unitFromComputedValue(this.vm.value),
        viewKind: "ComputedBusinessScoreNode",
        computationKind: this.vm.computationKind,
      })}
      ${renderCbsnBody(this.vm.value, objective)}
      ${canCompute ? renderAsParentTimestamp(dateIso, dateColor) : nothing}
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
    "computed-card": ComputedCard;
    "computed-business-score-card": ComputedBusinessScoreCard;
  }
}
