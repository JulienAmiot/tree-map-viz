/**
 * SPEC §17.121i / §17.122a — inline disable affordance for the
 * §17.99a `ValueNode.disabled` flag. Two surfaces, two visual
 * languages:
 *
 *  - **AsChild (passive, tree-map tile)** —
 *    `renderDisabledIndicator(disabled)` returns a small, muted
 *    "forbidden sign" glyph (U+29B8 CIRCLED REVERSE SOLIDUS) ONLY
 *    when `disabled` is true, otherwise `nothing`. Sits at the
 *    left of the tree-map tile title. The glyph is text-style
 *    (monochrome on every system, no colour-emoji surprise), sized
 *    at ~0.9em of the title font, and painted in a desaturated
 *    grey so it reads as a quiet "this card is parked" badge at a
 *    glance without competing with the title text.
 *  - **AsParent (interactive, focused panel)** —
 *    `renderDisabledSwitch(host, nodeId, disabled)` returns a
 *    `<button role="switch">` whose semantic mirrors "is this node
 *    enabled?" — `aria-checked` reflects `!disabled` (§17.122a
 *    polarity flip from the §17.121i original where checked meant
 *    "is disabled"). The new visual pairs colour + glyph + knob
 *    position so the state reads unambiguously at a glance:
 *
 *      DISABLED (aria-checked="false"):
 *        - red pill (rgb(220, 38, 38))
 *        - knob on the LEFT
 *        - "×" (U+00D7) glyph inside the knob, painted red
 *
 *      ENABLED  (aria-checked="true"):
 *        - green pill (rgb(34, 197, 94))
 *        - knob on the RIGHT
 *        - "✓" (U+2713) glyph inside the knob, painted green
 *
 *    Sits at the same left-of-title position as the AsChild
 *    indicator. Sized at 1em tall so the pill fits cleanly inside
 *    the 3vh title row's line-box at every kiosk viewport. Click
 *    dispatches `value-node-disabled-change` (bubbles + composed)
 *    with the toggled `disabled` value; `main.ts` routes through
 *    `EditNodeService.editFields`.
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
  /* SPEC §17.121i / §17.122a — write-side toggle switch. The
     pill represents "is this node enabled?" (aria-checked = !disabled).
     Sized at 1em tall and 2em wide so the pill fits comfortably
     inside the 3vh title row's line-box at every kiosk viewport
     while leaving room for the knob to travel + a centred glyph.
     DISABLED state: red pill, knob LEFT, "×" glyph inside knob.
     ENABLED  state: green pill, knob RIGHT, "✓" glyph inside knob.
     Knob has a solid light background so the glyph (coloured to
     match the pill) reads with high contrast on either state. */
  .disabled-switch {
    --dts-w: 2em;
    --dts-h: 1em;
    --dts-red: rgb(220, 38, 38);
    --dts-green: rgb(34, 197, 94);
    --dts-knob-bg: rgb(245, 245, 245);
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    position: relative;
    width: var(--dts-w);
    height: var(--dts-h);
    border-radius: calc(var(--dts-h) / 2);
    border: none;
    background: var(--dts-red);
    padding: 0;
    margin-right: 0.4em;
    vertical-align: middle;
    font: inherit;
    user-select: none;
    flex: 0 0 auto;
    cursor: pointer;
    transition: background 160ms ease;
  }
  .disabled-switch[aria-checked="true"] {
    background: var(--dts-green);
  }
  .disabled-switch .knob {
    position: absolute;
    top: 50%;
    left: 0.12em;
    width: calc(var(--dts-h) - 0.24em);
    height: calc(var(--dts-h) - 0.24em);
    border-radius: 50%;
    background: var(--dts-knob-bg);
    color: var(--dts-red);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7em;
    font-weight: 900;
    line-height: 1;
    transform: translateY(-50%);
    transition: left 160ms ease, color 160ms ease;
  }
  .disabled-switch[aria-checked="true"] .knob {
    left: calc(100% - var(--dts-h) + 0.12em);
    color: var(--dts-green);
  }
  /* CSS-escaped Unicode glyphs. The JS template literal needs the
     backslash escaped (double-backslash in the source) so that the
     resulting CSS sees a single backslash followed by the codepoint:
     U+00D7 MULTIPLICATION SIGN (×) and U+2713 CHECK MARK (✓).
     Without the double-backslash, "\\0..." and "\\2..." would be
     invalid ECMAScript escape sequences that silently collapse the
     template's cooked string to undefined (per the ES2018 template-
     literal-revision spec amendment). */
  .disabled-switch .knob::before {
    content: "\\00d7";
  }
  .disabled-switch[aria-checked="true"] .knob::before {
    content: "\\2713";
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
    aria-checked=${disabled ? "false" : "true"}
    aria-label="Toggle enabled"
    data-testid="disabled-switch"
    data-node-id=${nodeId}
    @click=${onClick}
  >
    <span class="knob" aria-hidden="true"></span>
  </button>`;
}
