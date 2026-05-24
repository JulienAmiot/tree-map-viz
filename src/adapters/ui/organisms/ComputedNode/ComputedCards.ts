/**
 * `<computed-card>` + `<computed-business-score-card>` (SPEC §17.104 +
 * §17.116 refresh).
 *
 * §17.116 visual contract:
 *
 *  - **Σ prefix on the title** — when the strategy produces a numeric
 *    value, the title row is prefixed with a small Σ glyph (was a
 *    chip next to the value pre-§17.116; the chip moved to the title
 *    so the value glyph reads as a bare number on a single line).
 *  - **No computation-kind chrome on the tile** (§17.116-followup-2)
 *    — the pre-§17.104 inline `<select class="kind-dropdown">` was
 *    retired in §17.116c in favour of a static `<div class="kind-
 *    label">` sibling under the title; the followup-2 strand drops
 *    the label too on operator feedback ("remove the computation
 *    text line in a child and a parent"). The Σ prefix already
 *    signals "aggregated value", which is the only piece of the
 *    computation-kind reading the operator needed at a glance; the
 *    exact kind (SUM / AVERAGE / …) belongs to the edit modal.
 *  - **Unit under the value** — the unit moves out of the inline
 *    `<span class="value">` run into a `.unit-below` block sibling.
 *  - **Bottom-right shows age** — the corner timestamp renders the
 *    age in years / months / days (zero components stripped) via
 *    `formatAge`; the locale date is no longer surfaced on the tile.
 *  - **Warning-fill when not computable** — the `empty` and any
 *    `childrenCount` branches of `ComputedValueViewModel` render the
 *    tile's value-area as a full-tile `⚠` glyph in a muted colour
 *    at cqmin-sized scale. Was a small inline glyph or "n
 *    children" / reason text pre-§17.116. SPEC §17.116-followup
 *    dropped the §17.24 PlusTile dashed border + corner-radius on
 *    operator feedback — the glyph alone carries the "cannot
 *    compute" signal at-a-glance.
 *  - **CBSN host is a column flex container** (§17.116-followup) so
 *    `.metric-pane` fills the body below the title and its bottom
 *    edge coincides with the tile's bottom edge. The `<time class=
 *    "timestamp">` is parented inside `.metric-pane` (SPEC §17.30 /
 *    §17.45 parity), so the pane-fills-body rule is what makes
 *    "bottom-right of the tile" land at the actual tile bottom-
 *    right rather than the figure's bottom-right.
 *  - **CBSN value-area matches the standard BSC vertical alignment**
 *    (§17.116-followup-3) — the shared `tileLayoutStyles`
 *    `.value-area` rule sizes the area to `calc(100% - 3vh)` of its
 *    parent (the standard BSC parents it under the host, so that
 *    formula yields `host - 3vh`, i.e. "the body below the title").
 *    On CBSN the `.value-area` is nested one level deeper (inside
 *    `.metric-pane` which already fills `host - 3vh` via the
 *    column-flex rule above), which made the shared `- 3vh` cut
 *    fire twice and leave a 3vh gap at the metric-pane bottom; the
 *    value figure sat visibly higher than the equivalent standard
 *    BSC figure. The `cbsnHostStyles` override below pins the
 *    CBSN value-area to `height: 100%` of its metric-pane parent
 *    so the value+target column centres at the same vertical
 *    position as the standard BSC. The 3vh bottom strip that used
 *    to be "reserved" for the timestamp is no longer required —
 *    the timestamp is absolutely positioned and floats over the
 *    value-area's bottom-right corner (same as the standard BSC
 *    layout it now mirrors).
 *  - **Per-value `--char-count` inline style** (§17.116-followup-3)
 *    — the shared `.value` font-size rule caps at
 *    `160cqi / max(2, --char-count)` so the figure never overflows
 *    the tile horizontally regardless of digit count. The two
 *    Computed* render helpers below stamp the rendered text's
 *    length onto the `.value` element via inline style so the
 *    cap tightens as the number grows wider.
 *
 * The `COMPUTATION_KIND_CHANGE_EVENT` + `ComputationKindChangeDetail`
 * exports are preserved (the wiring lives in `main.ts` and routes to
 * `EditNodeService.editFields`); the dispatch site moves out of this
 * file in §17.116 because no inline kind-change gesture remains. The
 * symbols stay so the §17.116-followup edit-modal patch can hook into
 * the existing handler without churn.
 *
 * SPEC §17.124 — inline title editing on the focused panel.
 * Operator-requested parity: every parent-strip tile across the kiosk
 * (TextNode / BSC / Workflow / Picture / URL since §17.28 / §17.50)
 * lets the operator click the title to inline-edit it; Computed* was
 * the lone outlier carrying a static read-only title. §17.124 mounts
 * the shared `InlineTitleEditController` on BOTH Computed card
 * classes for `viewRole === "asParent"` only — AsChild tiles keep
 * the static `renderTitleWithBadge` path so the click-to-drill
 * gesture on the tree-map grid is preserved (a single-click on a
 * child tile must continue to drill into focus, NOT enter edit
 * mode). The Σ badge moves into the prefix slot of the controller's
 * `renderTitle(viewKind, prefix)` call so the visual chain reads
 * `[disabled-switch][Σ]Title` exactly as today; the only change is
 * that the `<h2>` becomes an editable `<h1>` on the focused panel.
 * The inline-edit input styling is scoped under
 * `:host([view-role="asParent"])` so the AsChild role's 3vh title
 * sizing inherited from `tileLayoutStyles` is left untouched.
 */

import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../../atoms/icon/Icon.js";
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
  TrendArrowDirection,
} from "../../molecules/NodeViewModel.js";
import { formatAge } from "../../atoms/ageFormat.js";
import {
  disabledToggleStyles,
  renderDisabledIndicator,
  renderDisabledSwitch,
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
import { tileLayoutStyles } from "../../atoms/tileLayoutStyles.js";
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
     select.strategy-picker that fires computation-kind-change).
     The shared .value-area height formula reads this var and
     subtracts it from the body region, so the value figure shrinks
     by exactly the slot we add. */
  :host {
    --subtitle-row-height: 2vh;
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
  /* SPEC §17.30 / §17.45 — pane carries position:relative so the
     absolute .timestamp (declared on tileLayoutStyles) anchors to
     the pane's edges, mirroring the v3 BSC asParent layout. */
  .metric-pane { position: relative; }
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
  /* SPEC §17.124 — restore AsChild's pre-§17.124 title sizing /
     colour. The shared titleInlineEditStyles block (mixed into the
     Computed cards below) pins the title to 2.4vh / off-white for
     focused-panel emphasis; on Computed* that block fires for
     BOTH roles because the class is dual-role. The AsChild override
     here rolls the font-size / colour back to the tile-level
     defaults so the tree-map grid keeps its 3vh inherited sizing.
     The .title-edit rules from titleInlineEditStyles stay inert on
     AsChild (no .title-edit element renders) so no unscoped CSS
     leaks. */
  :host([view-role="asChild"]) .title {
    font-size: 3vh;
    color: inherit;
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

// SPEC §17.136 S4 — the pre-§17.136 `cbsnHostStyles` flex-column host
// override + `.metric-pane { flex: 1 1 auto }` rule are RETIRED:
// card-frame now owns the host's grid layout, so the body slot fills
// the row between header and footer and the metric-pane already
// occupies that body row in full. What survives from cbsnHostStyles
// is the `.value-area { height: 100% }` rule: card-frame strips the
// title row out of the body slot's height envelope, so the shared
// `tileLayoutStyles` formula (`calc(100% - 3vh)`) would now under-
// shoot the body row by 3vh on CBSN (the value-area is nested inside
// .metric-pane on this class, unlike the plain <computed-card> where
// it sits at the body root). Pinning the CBSN value-area back to
// `height: 100%` of its metric-pane parent restores the vertical
// centering with the standard BSC's value-area.
const cbsnHostStyles = css`
  .value-area { height: 100%; }
`;

const TREND_SLUGS: Record<TrendArrowDirection, string> = {
  up: "arrow-up", "up-right": "arrow-up-right", right: "arrow-right",
  "down-right": "arrow-down-right", down: "arrow-down",
};

function renderTargetUnit(unit: string): TemplateResult | typeof nothing {
  return unit ? html`&nbsp;${unit}` : nothing;
}

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
 * SPEC §17.116-followup-3 — `--char-count` inline style for a
 * Computed* `.value` element. The shared `.value` font-size rule
 * reads `var(--char-count, 2)` to cap the figure at
 * `160cqi / max(2, --char-count)`, which makes the value glyph
 * shrink as the digit count grows so it never overflows the tile
 * horizontally. Computed* tiles have no per-VM gradient colour
 * (the BSC `valueColor` pipeline does not apply), so the inline
 * style carries `--char-count` only.
 */
function valueCharCountStyle(text: string): string {
  return `--char-count: ${text.length}`;
}

function renderNumericValueArea(
  value: Extract<ComputedValueViewModel, { kind: "numeric" }>,
): TemplateResult {
  const text = formatValue(value.value);
  return html`<div class="value-area" data-testid="value-row">
    <div class="value-row">
      <span
        class="value"
        data-testid="value"
        data-value-kind="numeric"
        style=${valueCharCountStyle(text)}
        >${text}</span
      >
    </div>
  </div>`;
}

function renderNumericValueAreaWithObjective(
  value: Extract<ComputedValueViewModel, { kind: "numeric" }>,
  objective: BusinessScoreCardObjectiveViewModel,
): TemplateResult {
  const text = formatValue(value.value);
  return html`<div class="value-area" data-testid="value-row">
    <div class="value-row">
      <span
        class="value"
        data-testid="value"
        data-value-kind="numeric"
        style=${valueCharCountStyle(text)}
        >${text}</span
      >
      ${renderTrend(objective)}
    </div>
    ${renderObjectiveRow(objective)}
  </div>`;
}

function renderObjectiveRow(obj: BusinessScoreCardObjectiveViewModel): TemplateResult {
  return html`<div class="target-row" data-testid="target-row">
    <span class="target-icon" data-testid="target-icon" aria-hidden="true"></span>
    <span class="target-text" data-testid="target-text"
      >${formatValue(obj.targetValue)}${renderTargetUnit(obj.unit)}</span
    >
  </div>`;
}

function renderTrend(obj: BusinessScoreCardObjectiveViewModel): TemplateResult | typeof nothing {
  if (obj.trendArrow === null) return nothing;
  return html`<span class="trend-arrow" data-testid="trend-arrow" data-direction=${obj.trendArrow}
    role="img" aria-label="Trend"><ds-icon name=${TREND_SLUGS[obj.trendArrow]}></ds-icon></span>`;
}

/**
 * SPEC §17.116 — corner timestamp now renders the **age** of the
 * date (years/months/days, zero parts dropped) rather than the
 * locale-formatted calendar date. The ISO is still emitted in
 * `datetime=` so assistive tech / e2e tests can read the canonical
 * value; the visible label is the age.
 */
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
    >${args.vmTitle}</h2>
    <div slot="subtitle" class="subtitle" data-testid="subtitle">
      ${renderKindLabel(args.computationKind)}
    </div>
  `;
}

/**
 * SPEC §17.136 S3 -- shared AsParent slot fillers for the icons + unit
 * + title + subtitle slots of `<card-frame>`. Both Computed card
 * classes feed identical pieces (disabled switch + sigma badge into
 * `icons`, editable unit chip into `unit`, inline-editable title h1
 * into `title`, strategy picker into `subtitle`); centralising avoids
 * duplication across the two AsParent renderers (would otherwise
 * trip the CPD detector at ~25 duplicate lines per class).
 */
function renderAsParentSlots(args: {
  readonly host: LitElement;
  readonly titleEditor: InlineTitleEditController;
  readonly vmId: string;
  readonly vmDisabled: boolean;
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
      >${renderDisabledSwitch(args.host, args.vmId, args.vmDisabled)}${args.showBadge
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

  /** SPEC 17.136 S3 -- AsParent path wraps everything in `<card-frame>`. */
  private renderAsParent(): TemplateResult {
    if (!this.vm) return html``;
    const showBadge = this.vm.value.kind === "numeric";
    const canCompute = this.vm.value.kind === "numeric";
    const vmDisabled = this.vm.disabled ?? false;
    return html`<card-frame style="--card-header-height: 14%; --card-footer-height: 8%">
      ${renderAsParentSlots({
        host: this,
        titleEditor: this.titleEditor,
        vmId: this.vm.id,
        vmDisabled,
        showBadge,
        unitChip: this.unitEditor.renderChip(),
        viewKind: "ComputedNode",
        computationKind: this.vm.computationKind,
        onKindChange: this.dispatchKindChange,
        parentId: this.parentId,
      })}
      <div slot="body">
        ${canCompute
          ? renderNumericValueArea(this.vm.value as Extract<ComputedValueViewModel, { kind: "numeric" }>)
          : html`<div class="value-area" data-testid="value-row">${renderWarningFill(this.vm.value)}</div>`}
      </div>
    </card-frame>`;
  }

  /** SPEC 17.136 S4 -- AsChild now also wraps in `<card-frame>`
   *  (default 22% / 12% header / footer for tree-map tile sizing). */
  private renderAsChild(): TemplateResult {
    if (!this.vm) return html``;
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
        viewKind: "ComputedNode",
        computationKind: this.vm.computationKind,
      })}
      <div slot="body">
        ${canCompute
          ? renderNumericValueArea(this.vm.value as Extract<ComputedValueViewModel, { kind: "numeric" }>)
          : html`<div class="value-area" data-testid="value-row">${renderWarningFill(this.vm.value)}</div>`}
      </div>
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
    cbsnHostStyles,
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

  /** SPEC 17.136 S3 -- AsParent path wraps everything in `<card-frame>`;
   *  timestamp moves out of `.metric-pane` into the footer-right slot. */
  private renderAsParent(): TemplateResult {
    if (!this.vm) return html``;
    const { dateIso, dateColor, objective } = this.vm;
    const showBadge = this.vm.value.kind === "numeric";
    const canCompute = this.vm.value.kind === "numeric";
    const vmDisabled = this.vm.disabled ?? false;
    return html`<card-frame style="--card-header-height: 14%; --card-footer-height: 8%">
      ${renderAsParentSlots({
        host: this,
        titleEditor: this.titleEditor,
        vmId: this.vm.id,
        vmDisabled,
        showBadge,
        unitChip: this.unitEditor.renderChip(),
        viewKind: "ComputedBusinessScoreNode",
        computationKind: this.vm.computationKind,
        onKindChange: this.dispatchKindChange,
        parentId: this.parentId,
      })}
      <div slot="body" class="metric-pane" data-testid="metric-pane">
        ${canCompute
          ? renderNumericValueAreaWithObjective(
              this.vm.value as Extract<ComputedValueViewModel, { kind: "numeric" }>,
              objective,
            )
          : html`<div class="value-area" data-testid="value-row">${renderWarningFill(this.vm.value)}</div>`}
      </div>
      ${canCompute ? renderAsParentTimestamp(dateIso, dateColor) : nothing}
    </card-frame>`;
  }

  /** SPEC 17.136 S4 -- AsChild now also wraps in `<card-frame>`;
   *  timestamp moves to footer-right slot. */
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
      <div slot="body" class="metric-pane" data-testid="metric-pane">
        ${canCompute
          ? renderNumericValueAreaWithObjective(
              this.vm.value as Extract<ComputedValueViewModel, { kind: "numeric" }>,
              objective,
            )
          : html`<div class="value-area" data-testid="value-row">${renderWarningFill(this.vm.value)}</div>`}
      </div>
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
