/**
 * SPEC §17.121h — shared inline enable/disable toggle pill for the
 * focused-panel (AsParent) tile. A click flips `ValueNode.disabled`
 * (§17.99a) by dispatching a bubbling, composed
 * `value-node-disabled-change` event that `main.ts` routes through
 * `EditNodeService.editFields({ kind, disabled })`. Visual contract
 * mirrors the §17.117 status-badge pill — Active = green;
 * Disabled = warm gold (the §17.121f ACT amber-600).
 */

import { type TemplateResult, css, html } from "lit";

export const VALUE_NODE_DISABLED_CHANGE_EVENT = "value-node-disabled-change";

export type ValueNodeDisabledChangeDetail = {
  readonly nodeId: string;
  readonly disabled: boolean;
};

export const disabledToggleStyles = css`
  .disabled-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4em;
    box-sizing: border-box;
    background: transparent;
    border: 1.5px solid var(--toggle-color, currentColor);
    color: var(--toggle-color, currentColor);
    border-radius: 0.4rem;
    font: inherit;
    font-size: 1.15vh;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1;
    padding: 0.18em 0.55em;
    white-space: nowrap;
    user-select: none;
    cursor: pointer;
  }
  .disabled-toggle .dot {
    width: 0.6em;
    height: 0.6em;
    border-radius: 50%;
    background: var(--toggle-color, currentColor);
  }
`;

const COLOR_ACTIVE = "rgb(34, 197, 94)";
const COLOR_DISABLED = "rgb(217, 119, 6)";

export function renderDisabledToggle(
  nodeId: string,
  disabled: boolean,
  onChange: (next: boolean) => void,
): TemplateResult {
  const color = disabled ? COLOR_DISABLED : COLOR_ACTIVE;
  return html`<button
    class="disabled-toggle"
    type="button"
    data-testid="disabled-toggle"
    data-node-id=${nodeId}
    ?data-disabled=${disabled}
    aria-pressed=${disabled ? "true" : "false"}
    style=${`--toggle-color: ${color}`}
    @click=${(e: Event) => { e.preventDefault(); e.stopPropagation(); onChange(!disabled); }}
  >
    <span class="dot" aria-hidden="true"></span>
    <span class="label">${disabled ? "Disabled" : "Active"}</span>
  </button>`;
}

export function dispatchDisabledChange(source: HTMLElement, nodeId: string, disabled: boolean): void {
  source.dispatchEvent(new CustomEvent<ValueNodeDisabledChangeDetail>(VALUE_NODE_DISABLED_CHANGE_EVENT, {
    bubbles: true, composed: true, detail: { nodeId, disabled },
  }));
}

/**
 * Convenience wrapper: renders the toggle pill AND auto-wires the
 * click → `dispatchDisabledChange(host, …)`. Used by every AsParent
 * view so the per-view boilerplate stays one line.
 */
export function renderDisabledToggleFor(
  host: HTMLElement, nodeId: string, disabled: boolean,
): TemplateResult {
  return renderDisabledToggle(nodeId, disabled, (next) => dispatchDisabledChange(host, nodeId, next));
}
