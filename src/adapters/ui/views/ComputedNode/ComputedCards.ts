/**
 * `<computed-card>` + `<computed-business-score-card>` — Lit
 * components for the round-7 Computed* node kinds (SPEC §17.104).
 *
 * Both tiles render an auto-derived value alongside a Σ aggregation
 * badge (visual signal: "this number was computed from children, not
 * recorded by the operator") and a kind-switching `<select>` that
 * dispatches a `computation-kind-change` custom event when the
 * operator picks a different aggregation strategy. The shell wires
 * the event to `EditNodeServiceV4.editFields(node, { kind: "Computed"
 * | "ComputedBusinessScore", computationKind })` at the §17.110 Phase
 * E cutover; today the components dispatch with no production
 * listener (the v4 view-model mapper at §17.91 doesn't produce the
 * new VM kinds yet either — that wiring is a follow-on strand).
 *
 * `<computed-business-score-card>` additionally renders the BSC-style
 * objective row + corner timestamp (CBSN extends `BusinessScoreNode`,
 * so the operator-facing affordances mirror a plain BSC tile —
 * §17.40 target row + §17.41 trend arrow surfaces). The renderers are
 * inlined here rather than reused from the §17.40 `valueTemplate`
 * because that module's helpers are typed against the v3
 * `BusinessScoreCardNodeViewModel`, which has a different `value`
 * shape (`computedMean | recordedValue | childrenCount` vs the
 * §17.104 `numeric | empty` `ComputedValueViewModel`). Re-typing the
 * §17.40 helpers polymorphically would touch v3 code paths beyond
 * §17.104's scope; inlining 2 small renderers keeps the strand
 * additive.
 */

import { LitElement, html, css, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import type {
  BusinessScoreCardObjectiveViewModel,
  ComputationKindName,
  ComputedBusinessScoreNodeViewModel,
  ComputedNodeViewModel,
  ComputedValueViewModel,
  TrendArrowDirection,
} from "../NodeViewModel.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";

/** SPEC §17.104 — custom event name + payload shape for the operator's kind-switching gesture. */
export const COMPUTATION_KIND_CHANGE_EVENT = "computation-kind-change";
export type ComputationKindChangeDetail = {
  readonly nodeId: string;
  readonly newKind: ComputationKindName;
};

const sharedStyles = css`
  .computed-badge { font-size: 1.4vh; opacity: 0.7; margin-right: 0.3em; }
  .kind-dropdown {
    font-size: 1.2vh; margin-top: 0.4em; background: transparent;
    color: inherit; border: 1px solid currentColor;
    border-radius: 0.2em; padding: 0.1em 0.3em;
  }
  .target-row { font-size: 1.2vh; opacity: 0.85; margin-top: 0.3em; }
`;

const TREND_GLYPHS: Record<TrendArrowDirection, string> = {
  up: "\u2191", "up-right": "\u2197", right: "\u2192", "down-right": "\u2198", down: "\u2193",
};

function dispatchKindChange(el: HTMLElement, nodeId: string, newKind: ComputationKindName): void {
  el.dispatchEvent(
    new CustomEvent<ComputationKindChangeDetail>(COMPUTATION_KIND_CHANGE_EVENT, {
      bubbles: true, composed: true, detail: { nodeId, newKind },
    }),
  );
}

function renderKindDropdown(
  host: HTMLElement,
  nodeId: string,
  current: ComputationKindName,
  available: readonly ComputationKindName[],
): TemplateResult {
  const onChange = (ev: Event): void => {
    dispatchKindChange(host, nodeId, (ev.target as HTMLSelectElement).value as ComputationKindName);
  };
  return html`<select class="kind-dropdown" data-testid="kind-dropdown" @change=${onChange}>
    ${available.map((k) => html`<option value=${k} ?selected=${k === current}>${k}</option>`)}
  </select>`;
}

function renderComputedValue(value: ComputedValueViewModel): TemplateResult {
  if (value.kind === "empty") {
    return html`<span class="value" data-testid="value" data-value-kind="empty">${value.reason}</span>`;
  }
  return html`<span class="value" data-testid="value" data-value-kind="numeric"
    >${value.value}${value.unit ? html`<span class="unit">&nbsp;${value.unit}</span>` : nothing}</span
  >`;
}

function renderObjectiveRow(obj: BusinessScoreCardObjectiveViewModel): TemplateResult {
  return html`<div class="target-row" data-testid="target-row">
    <span class="target-icon" data-testid="target-icon" aria-hidden="true"></span>
    <span class="target-text" data-testid="target-text">${obj.targetValue}${obj.unit ? html`&nbsp;${obj.unit}` : nothing}</span>
  </div>`;
}

function renderTrend(obj: BusinessScoreCardObjectiveViewModel): TemplateResult | typeof nothing {
  if (obj.trendArrow === null) return nothing;
  return html`<span class="trend-arrow" data-testid="trend-arrow" data-direction=${obj.trendArrow} role="img" aria-label="Trend">${TREND_GLYPHS[obj.trendArrow]}</span>`;
}

function formatDateIso(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? iso : new Date(ms).toLocaleDateString();
}

@customElement("computed-card")
export class ComputedCard extends LitElement {
  @property({ attribute: false })
  vm: ComputedNodeViewModel | null = null;

  static styles = [tileLayoutStyles, sharedStyles];

  render(): TemplateResult {
    if (!this.vm) return html``;
    return html`
      <h2 class="title" data-testid="title" data-view-kind="ComputedNode" data-id=${this.vm.id}>${this.vm.title}</h2>
      <div class="value-area" data-testid="value-row">
        <div class="value-row">
          <span class="computed-badge" data-testid="computed-badge" aria-label="aggregated">Σ</span>
          ${renderComputedValue(this.vm.value)}
        </div>
        ${renderKindDropdown(this, this.vm.id, this.vm.computationKind, this.vm.availableKinds)}
      </div>
    `;
  }
}

@customElement("computed-business-score-card")
export class ComputedBusinessScoreCard extends LitElement {
  @property({ attribute: false })
  vm: ComputedBusinessScoreNodeViewModel | null = null;

  static styles = [tileLayoutStyles, sharedStyles];

  render(): TemplateResult {
    if (!this.vm) return html``;
    const { dateIso, dateColor, objective } = this.vm;
    return html`
      <h2 class="title" data-testid="title" data-view-kind="ComputedBusinessScoreNode" data-id=${this.vm.id}>${this.vm.title}</h2>
      ${dateIso
        ? html`<time class="timestamp" data-testid="value-date" datetime=${dateIso}
            style=${dateColor ? `--age-color: ${dateColor}` : ""}>${formatDateIso(dateIso)}</time>`
        : nothing}
      <div class="value-area" data-testid="value-row">
        <div class="value-row">
          <span class="computed-badge" data-testid="computed-badge" aria-label="aggregated">Σ</span>
          ${renderComputedValue(this.vm.value)}
          ${renderTrend(objective)}
        </div>
        ${renderObjectiveRow(objective)}
        ${renderKindDropdown(this, this.vm.id, this.vm.computationKind, this.vm.availableKinds)}
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
