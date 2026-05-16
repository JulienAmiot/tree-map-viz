/**
 * `<computed-card>` + `<computed-business-score-card>` (SPEC §17.104).
 * Both tiles render Σ badge + auto-derived value + a kind dropdown
 * that dispatches `computation-kind-change` for the shell to wire to
 * `EditNodeServiceV4` at §17.110 cutover. CBSC additionally renders
 * the BSC-style objective row + corner timestamp. Renderers are
 * inlined rather than reused from §17.40's `valueTemplate` because
 * those helpers are typed against the v3 BSC VM (different value
 * shape); polymorphic re-typing would touch v3 beyond §17.104 scope.
 */

import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import type {
  BusinessScoreCardObjectiveViewModel, ComputationKindName,
  ComputedBusinessScoreNodeViewModel, ComputedNodeViewModel,
  ComputedValueViewModel, TrendArrowDirection,
} from "../NodeViewModel.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";

/** SPEC §17.104 — custom event name + payload shape for the kind-switching gesture. */
export const COMPUTATION_KIND_CHANGE_EVENT = "computation-kind-change";
export type ComputationKindChangeDetail = { readonly nodeId: string; readonly newKind: ComputationKindName };

const sharedStyles = css`
  .computed-badge { font-size: 1.4vh; opacity: 0.7; margin-right: 0.3em; }
  .kind-dropdown {
    font-size: 1.2vh; margin-top: 0.4em; background: transparent; color: inherit;
    border: 1px solid currentColor; border-radius: 0.2em; padding: 0.1em 0.3em;
  }
  .target-row { font-size: 1.2vh; opacity: 0.85; margin-top: 0.3em; }
`;

const TREND_GLYPHS: Record<TrendArrowDirection, string> = {
  up: "\u2191", "up-right": "\u2197", right: "\u2192", "down-right": "\u2198", down: "\u2193",
};

function renderKindDropdown(
  host: HTMLElement, nodeId: string, current: ComputationKindName, available: readonly ComputationKindName[],
): TemplateResult {
  const onChange = (ev: Event): void => {
    host.dispatchEvent(new CustomEvent<ComputationKindChangeDetail>(COMPUTATION_KIND_CHANGE_EVENT, {
      bubbles: true, composed: true,
      detail: { nodeId, newKind: (ev.target as HTMLSelectElement).value as ComputationKindName },
    }));
  };
  return html`<select class="kind-dropdown" data-testid="kind-dropdown" @change=${onChange}>
    ${available.map((k) => html`<option value=${k} ?selected=${k === current}>${k}</option>`)}
  </select>`;
}

function unitSpan(unit: string): TemplateResult | typeof nothing {
  return unit ? html`<span class="unit">&nbsp;${unit}</span>` : nothing;
}

function unitSuffix(unit: string): TemplateResult | typeof nothing {
  return unit ? html`&nbsp;${unit}` : nothing;
}

function renderComputedValue(value: ComputedValueViewModel): TemplateResult {
  if (value.kind === "empty") {
    return html`<span class="value" data-testid="value" data-value-kind="empty">${value.reason}</span>`;
  }
  return html`<span class="value" data-testid="value" data-value-kind="numeric"
    >${value.value}${unitSpan(value.unit)}</span>`;
}

function renderObjectiveRow(obj: BusinessScoreCardObjectiveViewModel): TemplateResult {
  return html`<div class="target-row" data-testid="target-row">
    <span class="target-icon" data-testid="target-icon" aria-hidden="true"></span>
    <span class="target-text" data-testid="target-text">${obj.targetValue}${unitSuffix(obj.unit)}</span>
  </div>`;
}

function renderTrend(obj: BusinessScoreCardObjectiveViewModel): TemplateResult | typeof nothing {
  if (obj.trendArrow === null) return nothing;
  return html`<span class="trend-arrow" data-testid="trend-arrow" data-direction=${obj.trendArrow}
    role="img" aria-label="Trend">${TREND_GLYPHS[obj.trendArrow]}</span>`;
}

function renderTimestamp(dateIso: string, dateColor: string): TemplateResult | typeof nothing {
  if (!dateIso) return nothing;
  const ms = Date.parse(dateIso);
  const label = Number.isNaN(ms) ? dateIso : new Date(ms).toLocaleDateString();
  const styleAttr = dateColor ? `--age-color: ${dateColor}` : "";
  return html`<time class="timestamp" data-testid="value-date" datetime=${dateIso} style=${styleAttr}>${label}</time>`;
}

@customElement("computed-card")
export class ComputedCard extends LitElement {
  @property({ attribute: false })
  vm: ComputedNodeViewModel | null = null;

  static readonly styles = [tileLayoutStyles, sharedStyles];

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

  static readonly styles = [tileLayoutStyles, sharedStyles];

  render(): TemplateResult {
    if (!this.vm) return html``;
    const { dateIso, dateColor, objective } = this.vm;
    return html`
      <h2 class="title" data-testid="title" data-view-kind="ComputedBusinessScoreNode" data-id=${this.vm.id}>${this.vm.title}</h2>
      ${renderTimestamp(dateIso, dateColor)}
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
