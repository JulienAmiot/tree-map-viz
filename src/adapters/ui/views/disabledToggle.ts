/**
 * SPEC §17.121i — inline disable affordance for the §17.99a
 * `ValueNode.disabled` flag. Two surfaces share one visual
 * language (a compact pill with a sliding knob in warm gold):
 *
 *  - **AsChild (passive)** — `renderDisabledIndicator(disabled)`
 *    returns the gold "switch-on" pill ONLY when `disabled` is
 *    true, otherwise `nothing`. Sits at the left of the tree-map
 *    tile title (operator's §17.121i requirement: "appear on the
 *    left of the title; if enabled, don't show anything").
 *  - **AsParent (interactive)** — `renderDisabledSwitch(host,
 *    nodeId, disabled)` returns a `<button role="switch">` that
 *    toggles between the OFF (outlined, knob left) and ON (gold,
 *    knob right) state. Sits at the same left-of-title position
 *    as the AsChild indicator (operator's §17.121i requirement:
 *    "toggle button appears at the same position as the state").
 *    Click dispatches `value-node-disabled-change` (bubbles +
 *    composed); `main.ts` routes through `EditNodeService.editFields`.
 */

import { type TemplateResult, css, html, nothing } from "lit";

export const VALUE_NODE_DISABLED_CHANGE_EVENT = "value-node-disabled-change";
export type ValueNodeDisabledChangeDetail = {
  readonly nodeId: string;
  readonly disabled: boolean;
};

export const disabledToggleStyles = css`
  .disabled-indicator,
  .disabled-switch {
    --dts-w: 2em;
    --dts-h: 1.1em;
    --dts-gold: rgb(245, 158, 11);
    --dts-off: color-mix(in srgb, currentColor 40%, transparent);
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    position: relative;
    width: var(--dts-w);
    height: var(--dts-h);
    border-radius: calc(var(--dts-h) / 2);
    border: 1.5px solid var(--dts-off);
    background: transparent;
    padding: 0;
    margin-right: 0.4em;
    vertical-align: middle;
    font: inherit;
    user-select: none;
    flex: 0 0 auto;
    overflow: visible;
  }
  .disabled-indicator,
  .disabled-switch[aria-checked="true"] {
    background: var(--dts-gold);
    border-color: var(--dts-gold);
  }
  .disabled-switch {
    cursor: pointer;
  }
  .disabled-indicator .knob,
  .disabled-switch .knob {
    position: absolute;
    top: 50%;
    left: 0.1em;
    width: calc(var(--dts-h) - 0.3em);
    height: calc(var(--dts-h) - 0.3em);
    border-radius: 50%;
    background: var(--dts-off);
    transform: translateY(-50%);
    transition: left 160ms ease, background 160ms ease;
  }
  .disabled-indicator .knob,
  .disabled-switch[aria-checked="true"] .knob {
    left: calc(100% - var(--dts-h) + 0.15em);
    background: rgb(245, 245, 245);
  }
`;

export function renderDisabledIndicator(
  disabled: boolean,
): TemplateResult | typeof nothing {
  if (!disabled) return nothing;
  return html`<span
    class="disabled-indicator"
    data-testid="disabled-indicator"
    aria-label="Disabled"
    ><span class="knob" aria-hidden="true"></span
  ></span>`;
}

export function renderDisabledSwitch(
  host: HTMLElement,
  nodeId: string,
  disabled: boolean,
): TemplateResult {
  const onClick = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    host.dispatchEvent(
      new CustomEvent<ValueNodeDisabledChangeDetail>(
        VALUE_NODE_DISABLED_CHANGE_EVENT,
        {
          bubbles: true,
          composed: true,
          detail: { nodeId, disabled: !disabled },
        },
      ),
    );
  };
  return html`<button
    class="disabled-switch"
    type="button"
    role="switch"
    aria-checked=${disabled ? "true" : "false"}
    aria-label="Toggle disabled"
    data-testid="disabled-switch"
    data-node-id=${nodeId}
    @click=${onClick}
  >
    <span class="knob" aria-hidden="true"></span>
  </button>`;
}
