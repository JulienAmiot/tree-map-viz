/**
 * SPEC §17.121i — inline disable affordance for the §17.99a
 * `ValueNode.disabled` flag. Two surfaces, two visual languages:
 *
 *  - **AsChild (passive, tree-map tile)** —
 *    `renderDisabledIndicator(disabled)` returns a small, muted
 *    "forbidden sign" glyph (U+29B8 CIRCLED REVERSE SOLIDUS) ONLY
 *    when `disabled` is true, otherwise `nothing`. Sits at the
 *    left of the tree-map tile title. The glyph is text-style
 *    (monochrome on every system, no colour-emoji surprise), sized
 *    at ~0.9em of the title font, and painted in a desaturated
 *    grey so it reads as a quiet "this card is parked" badge at a
 *    glance without competing with the title text. The §17.121i
 *    follow-up: a pill-shaped read-only switch was visually
 *    confusing on small tiles (the bottom of the pill clipped
 *    against the 3vh title row's `overflow: hidden` because of the
 *    1.5px border + line-height baseline mismatch) — the glyph has
 *    no decorative box of its own so it always fits the row.
 *  - **AsParent (interactive, focused panel)** —
 *    `renderDisabledSwitch(host, nodeId, disabled)` returns a
 *    `<button role="switch">` that toggles between OFF (outlined,
 *    knob left) and ON (warm gold, knob right). Sits at the same
 *    left-of-title position as the AsChild indicator. Sized
 *    tightly (1em tall) so the pill fits cleanly inside the 3vh
 *    title row's line-box at every kiosk viewport. Click
 *    dispatches `value-node-disabled-change` (bubbles + composed);
 *    `main.ts` routes through `EditNodeService.editFields`.
 */

import { type TemplateResult, css, html, nothing } from "lit";

export const VALUE_NODE_DISABLED_CHANGE_EVENT = "value-node-disabled-change";
export type ValueNodeDisabledChangeDetail = {
  readonly nodeId: string;
  readonly disabled: boolean;
};

export const disabledToggleStyles = css`
  /* SPEC §17.121i — read-side "forbidden sign" glyph. Plain inline
     span, sized in em so it scales with the title font; no border,
     no background, no pseudo-element box that could clip against
     the 3vh title row. Muted grey so the indicator reads as a calm
     status badge rather than competing with the title text. */
  .disabled-indicator {
    display: inline-block;
    vertical-align: baseline;
    margin-right: 0.35em;
    font-size: 0.9em;
    line-height: 1;
    color: color-mix(in srgb, currentColor 38%, transparent);
    user-select: none;
    pointer-events: none;
  }
  .disabled-indicator::before {
    /* U+29B8 CIRCLED REVERSE SOLIDUS — a text-style "no/blocked"
       glyph (circle with a backslash through it), always
       monochrome (no colour-emoji presentation), present in the
       system symbol fonts every kiosk target ships (Segoe UI
       Symbol, Apple Symbols, Noto Sans Symbols). Reads as a
       forbidden sign at a glance without the colour-emoji "red
       ring" the U+1F6AB / U+26D4 variants paint by default. */
    content: "\u29B8";
    font-weight: 700;
  }
  /* SPEC §17.121i — write-side toggle switch. Sized at 1em tall
     (was 1.1em pre-fix) so the pill fits comfortably inside the
     3vh title row's line-box without the 1.5px border clipping
     against the row's overflow: hidden. */
  .disabled-switch {
    --dts-w: 1.8em;
    --dts-h: 1em;
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
    cursor: pointer;
  }
  .disabled-switch[aria-checked="true"] {
    background: var(--dts-gold);
    border-color: var(--dts-gold);
  }
  .disabled-switch .knob {
    position: absolute;
    top: 50%;
    left: 0.12em;
    width: calc(var(--dts-h) - 0.36em);
    height: calc(var(--dts-h) - 0.36em);
    border-radius: 50%;
    background: var(--dts-off);
    transform: translateY(-50%);
    transition: left 160ms ease, background 160ms ease;
  }
  .disabled-switch[aria-checked="true"] .knob {
    left: calc(100% - var(--dts-h) + 0.18em);
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
    role="img"
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
