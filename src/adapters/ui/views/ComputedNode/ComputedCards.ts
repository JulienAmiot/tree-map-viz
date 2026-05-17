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
 *  - **Kind label under the title** — the active `ComputationKind` is
 *    rendered as a thin small-caps label under the title; the
 *    pre-§17.116 inline `<select class="kind-dropdown">` is retired
 *    (the kind is no longer editable inline — the edit modal will
 *    grow a select in a follow-up strand).
 *  - **Unit under the value** — the unit moves out of the inline
 *    `<span class="value">` run into a `.unit-below` block sibling.
 *  - **Bottom-right shows age** — the corner timestamp renders the
 *    age in years / months / days (zero components stripped) via
 *    `formatAge`; the locale date is no longer surfaced on the tile.
 *  - **Warning-fill when not computable** — the `empty` and any
 *    `childrenCount` branches of `ComputedValueViewModel` render the
 *    tile's value-area as a full-tile `⚠` glyph styled like the
 *    §17.24 PlusTile (dashed border, muted colour, cqmin-sized
 *    glyph filling the tile). Was a small inline glyph or "n
 *    children" / reason text pre-§17.116.
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

import type {
  BusinessScoreCardObjectiveViewModel,
  ComputationKindName,
  ComputedBusinessScoreNodeViewModel,
  ComputedNodeViewModel,
  ComputedValueViewModel,
  TrendArrowDirection,
} from "../NodeViewModel.js";
import { formatAge } from "../ageFormat.js";
import { formatValue } from "../numberFormat.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";

/** SPEC §17.104 — custom event name + payload shape. Retained for the §17.116-followup modal wiring. */
export const COMPUTATION_KIND_CHANGE_EVENT = "computation-kind-change";
export type ComputationKindChangeDetail = { readonly nodeId: string; readonly newKind: ComputationKindName };

const sharedStyles = css`
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
`;

const TREND_GLYPHS: Record<TrendArrowDirection, string> = {
  up: "\u2191", "up-right": "\u2197", right: "\u2192", "down-right": "\u2198", down: "\u2193",
};

function renderKindLabel(kind: ComputationKindName): TemplateResult {
  return html`<div class="kind-label" data-testid="kind-label" data-kind=${kind}>${kind}</div>`;
}

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

function renderNumericValueArea(
  value: Extract<ComputedValueViewModel, { kind: "numeric" }>,
): TemplateResult {
  return html`<div class="value-area" data-testid="value-row">
    <div class="value-row">
      <span class="value" data-testid="value" data-value-kind="numeric"
        >${formatValue(value.value)}</span
      >
    </div>
    ${renderUnitBelow(value.unit)}
  </div>`;
}

function renderNumericValueAreaWithObjective(
  value: Extract<ComputedValueViewModel, { kind: "numeric" }>,
  objective: BusinessScoreCardObjectiveViewModel,
): TemplateResult {
  return html`<div class="value-area" data-testid="value-row">
    <div class="value-row">
      <span class="value" data-testid="value" data-value-kind="numeric"
        >${formatValue(value.value)}</span
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

  static readonly styles = [tileLayoutStyles, sharedStyles];

  render(): TemplateResult {
    if (!this.vm) return html``;
    const showBadge = this.vm.value.kind === "numeric";
    const canCompute = this.vm.value.kind === "numeric";
    return html`
      ${renderTitleWithBadge(this.vm.id, this.vm.title, "ComputedNode", showBadge)}
      ${renderKindLabel(this.vm.computationKind)}
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

  static readonly styles = [tileLayoutStyles, sharedStyles];

  render(): TemplateResult {
    if (!this.vm) return html``;
    const { dateIso, dateColor, objective } = this.vm;
    const showBadge = this.vm.value.kind === "numeric";
    const canCompute = this.vm.value.kind === "numeric";
    return html`
      ${renderTitleWithBadge(this.vm.id, this.vm.title, "ComputedBusinessScoreNode", showBadge)}
      ${renderKindLabel(this.vm.computationKind)}
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
