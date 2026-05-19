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
 */

import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import { ComputationKind } from "../../../../domain/computation/ComputationKind.js";
import { COMPUTATION_KIND_LABELS } from "../../modal/AddChildModal.js";
import type {
  BusinessScoreCardObjectiveViewModel,
  ComputationKindName,
  ComputedBusinessScoreNodeViewModel,
  ComputedNodeViewModel,
  ComputedValueViewModel,
  NodeRole,
  TrendArrowDirection,
} from "../NodeViewModel.js";
import { formatAge } from "../ageFormat.js";
import { formatValue } from "../numberFormat.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";

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

/**
 * SPEC §17.121e — wrap the kind-label / strategy-picker in the
 * shared `.subtitle` row. Centralising the wrapper here keeps both
 * Computed card classes consistent (a single `data-testid="subtitle"`
 * hook for e2e + unit tests) and matches the WorkflowNode views'
 * subtitle pattern.
 */
function renderSubtitle(
  vmId: string,
  currentKind: ComputationKindName,
  viewRole: NodeRole,
  onChange: (next: ComputationKindName) => void,
): TemplateResult {
  const content =
    viewRole === "asParent"
      ? renderStrategyPicker(vmId, currentKind, onChange)
      : renderKindLabel(currentKind);
  return html`<div class="subtitle" data-testid="subtitle">${content}</div>`;
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
`;

/**
 * CBSN-only overrides — landed in §17.116-followup so the timestamp's
 * "bottom-right of the tile" contract holds visually on the CBSN
 * element. Pre-followup the host was the default `display: block`
 * from `tileLayoutStyles`, which made `.metric-pane` a content-sized
 * block sitting under the title (its bottom hugged the figure, not
 * the tile bottom). Since the `<time class="timestamp">` is parented
 * inside `.metric-pane` (the SPEC §17.30 / §17.45 parity contract
 * relies on that placement so the parent CBSN's timestamp shares
 * its containing block with a child BSC's), the date pinned to the
 * figure's bottom-right rather than the tile's.
 *
 * The fix turns the CBSN host into a column flex container and lets
 * `.metric-pane` grow (`flex: 1 1 auto`) to fill the body below the
 * `.title` row. With the pane now spanning to the tile's bottom
 * edge, the timestamp's `bottom: 0.2rem` offset (declared on
 * `tileLayoutStyles .timestamp`) resolves at the tile's bottom-right
 * — operator-correct without touching the shared timestamp rule or
 * the plain `<computed-card>` layout (which has no metric-pane and
 * keeps the default block layout from `tileLayoutStyles`).
 *
 * `min-height: 0` is the standard flex-item escape hatch for
 * preventing the intrinsic content size of `.value-area` (which
 * declares an explicit `height: calc(100% - 3vh)`) from blocking
 * the flex shrink axis on tiny tiles.
 */
const cbsnHostStyles = css`
  :host { display: flex; flex-direction: column; }
  .metric-pane { flex: 1 1 auto; min-height: 0; }
  /* SPEC §17.116-followup-3 — see the docblock at the top of this
     module for the full rationale. The shared tileLayoutStyles
     .value-area rule sizes the area to calc(100% - 3vh) of its
     parent, which on CBSN double-counts the title row because
     .metric-pane already gives up 3vh to it. Pinning to 100% of
     the metric-pane makes the CBSN value-area height match the
     standard BSC's (= host - 3vh) so the value+target column
     centres at the same vertical position on both tile types. */
  .value-area { height: 100%; }
`;

const TREND_GLYPHS: Record<TrendArrowDirection, string> = {
  up: "\u2191", "up-right": "\u2197", right: "\u2192", "down-right": "\u2198", down: "\u2193",
};

function renderUnitBelow(unit: string): TemplateResult | typeof nothing {
  return unit
    ? html`<span class="unit-below" data-testid="unit">${unit}</span>`
    : nothing;
}

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
  ></div>`;
}

function renderTitleWithBadge(
  vmId: string,
  vmTitle: string,
  viewKind: string,
  showBadge: boolean,
): TemplateResult {
  return html`<h2 class="title" data-testid="title" data-view-kind=${viewKind} data-id=${vmId}
    >${showBadge
      ? html`<span class="computed-badge" data-testid="computed-badge" aria-label="aggregated">Σ</span>`
      : nothing}${vmTitle}</h2>`;
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
    ${renderUnitBelow(value.unit)}
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
    ${renderUnitBelow(value.unit)}
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
    role="img" aria-label="Trend">${TREND_GLYPHS[obj.trendArrow]}</span>`;
}

/**
 * SPEC §17.116 — corner timestamp now renders the **age** of the
 * date (years/months/days, zero parts dropped) rather than the
 * locale-formatted calendar date. The ISO is still emitted in
 * `datetime=` so assistive tech / e2e tests can read the canonical
 * value; the visible label is the age.
 */
function renderTimestamp(dateIso: string, dateColor: string): TemplateResult | typeof nothing {
  if (!dateIso) return nothing;
  const styleAttr = dateColor ? `--age-color: ${dateColor}` : "";
  return html`<time class="timestamp" data-testid="value-date" datetime=${dateIso} style=${styleAttr}
    >${formatAge(dateIso)}</time>`;
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

  static readonly styles = [tileLayoutStyles, sharedStyles];

  private readonly dispatchKindChange = (newKind: ComputationKindName): void => {
    if (!this.vm) return;
    this.dispatchEvent(
      new CustomEvent<ComputationKindChangeDetail>(COMPUTATION_KIND_CHANGE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { nodeId: this.vm.id, newKind },
      }),
    );
  };

  render(): TemplateResult {
    if (!this.vm) return html``;
    const showBadge = this.vm.value.kind === "numeric";
    const canCompute = this.vm.value.kind === "numeric";
    return html`
      ${renderTitleWithBadge(this.vm.id, this.vm.title, "ComputedNode", showBadge)}
      ${renderSubtitle(this.vm.id, this.vm.computationKind, this.viewRole, this.dispatchKindChange)}
      ${canCompute
        ? renderNumericValueArea(this.vm.value as Extract<ComputedValueViewModel, { kind: "numeric" }>)
        : html`<div class="value-area" data-testid="value-row">${renderWarningFill(this.vm.value)}</div>`}
    `;
  }
}

@customElement("computed-business-score-card")
export class ComputedBusinessScoreCard extends LitElement {
  @property({ attribute: false })
  vm: ComputedBusinessScoreNodeViewModel | null = null;

  /** SPEC §17.104 / §17.116-followup — see `ComputedCard.viewRole`. */
  @property({ attribute: "view-role", reflect: true })
  viewRole: NodeRole = "asChild";

  static readonly styles = [tileLayoutStyles, sharedStyles, cbsnHostStyles];

  private readonly dispatchKindChange = (newKind: ComputationKindName): void => {
    if (!this.vm) return;
    this.dispatchEvent(
      new CustomEvent<ComputationKindChangeDetail>(COMPUTATION_KIND_CHANGE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { nodeId: this.vm.id, newKind },
      }),
    );
  };

  render(): TemplateResult {
    if (!this.vm) return html``;
    const { dateIso, dateColor, objective } = this.vm;
    const showBadge = this.vm.value.kind === "numeric";
    const canCompute = this.vm.value.kind === "numeric";
    return html`
      ${renderTitleWithBadge(this.vm.id, this.vm.title, "ComputedBusinessScoreNode", showBadge)}
      ${renderSubtitle(this.vm.id, this.vm.computationKind, this.viewRole, this.dispatchKindChange)}
      <div class="metric-pane" data-testid="metric-pane">
        ${canCompute ? renderTimestamp(dateIso, dateColor) : nothing}
        ${canCompute
          ? renderNumericValueAreaWithObjective(
              this.vm.value as Extract<ComputedValueViewModel, { kind: "numeric" }>,
              objective,
            )
          : html`<div class="value-area" data-testid="value-row">${renderWarningFill(this.vm.value)}</div>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "computed-card": ComputedCard;
    "computed-business-score-card": ComputedBusinessScoreCard;
  }
}
