/**
 * SPEC §17.121i / §17.122a / §17.133 — inline disable affordance
 * for the §17.99a `ValueNode.disabled` flag. Two surfaces, two
 * visual languages:
 *
 *  - **AsChild (passive, tree-map tile)** —
 *    `renderDisabledIndicator(disabled)` returns a small, muted
 *    `<ds-icon name="ban">` Lucide SVG inside a `.disabled-indicator`
 *    wrapper, ONLY when `disabled` is true, otherwise `nothing`.
 *    Sits at the left of the tree-map tile title. The icon
 *    inherits `currentColor` and reads as a calm "this card is
 *    parked" badge at a glance without competing with the title
 *    text. The §17.121i pre-§17.133 path used a CSS-pseudo
 *    `content: "\u29B8"` on the same wrapper; §17.133 swaps it
 *    for a real `<ds-icon>` child so the glyph stops depending on
 *    the system symbol font.
 *  - **AsParent (interactive, focused panel)** —
 *    `renderDisabledSwitch(host, nodeId, disabled)` returns a
 *    `<button role="switch">` whose semantic mirrors "is this node
 *    enabled?" — `aria-checked` reflects `!disabled` (§17.122a
 *    polarity flip from the §17.121i original where checked meant
 *    "is disabled"). The §17.122b outline refinement keeps the
 *    pill body transparent so only THREE elements carry colour —
 *    the rounded border, the knob, and a glyph centred in the
 *    half opposite the knob:
 *
 *      DISABLED (aria-checked="false"):
 *        - red border (rgb(220, 38, 38))
 *        - red knob on the LEFT
 *        - red `<ds-icon name="x">` centred in the RIGHT half
 *
 *      ENABLED  (aria-checked="true"):
 *        - green border (rgb(34, 197, 94))
 *        - green knob on the RIGHT
 *        - green `<ds-icon name="check">` centred in the LEFT half
 *
 *    SPEC §17.133 — the glyph used to ride a `::before` pseudo on
 *    the button with `content: "\u00D7"` / `content: "\u2713"`; it
 *    is now a real `<ds-icon class="disabled-switch__glyph">` child
 *    whose `name` attribute flips on disabled state. The element
 *    is still absolutely positioned (knob's empty half via the
 *    72 % / 28 % percentage anchor) so the visual contract is
 *    unchanged — only the glyph source moves from system font to
 *    Lucide SVG. Click dispatches `value-node-disabled-change`
 *    (bubbles + composed) with the toggled `disabled` value;
 *    `main.ts` routes through `EditNodeService.editFields`.
 */

import { type TemplateResult, css, html, nothing } from "lit";

import "../atoms/icon/Icon.js";

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
  /* SPEC 17.133 -- the 17.121i U+29B8 CIRCLED REVERSE SOLIDUS
     glyph that used to ride a ::before pseudo on this span is
     now a ds-icon name=ban Lucide SVG child, mounted by
     renderDisabledIndicator(). The Lucide swap removes the
     system-font dependency that drifted into the colour-emoji
     red ring rendering on some Android fonts; monochrome
     currentColor is now guaranteed across platforms. */
  .disabled-indicator {
    display: inline-flex;
    align-items: center;
    vertical-align: baseline;
    margin-right: 0.35em;
    font-size: 0.9em;
    line-height: 1;
    color: color-mix(in srgb, currentColor 38%, transparent);
    user-select: none;
    pointer-events: none;
  }
  /* SPEC §17.121i / §17.122a / §17.122b — write-side toggle switch.
     The pill represents "is this node enabled?" (aria-checked =
     !disabled). Sized at 1em tall and 2em wide so the pill fits
     comfortably inside the 3vh title row's line-box at every kiosk
     viewport while leaving room for the knob to travel + a glyph
     centred in the opposite half.

     §17.122b — outline + icon-aside refinement (operator feedback
     after §17.122a): the pill loses its solid fill. Only THREE
     elements carry colour now:

       - the rounded BORDER of the pill,
       - the KNOB (solid colored circle, no glyph inside),
       - the GLYPH sitting in the EMPTY half opposite the knob.

     The pill body itself stays transparent so the colour reads as
     a focused accent against any background rather than a heavy
     filled badge. Visual mapping:

       DISABLED (aria-checked="false"):
         - red border + red knob LEFT + red "×" centred on the RIGHT half.
       ENABLED  (aria-checked="true"):
         - green border + green knob RIGHT + green "✓" centred on the LEFT half.

     The glyph is rendered via a ::before pseudo-element on the
     button itself (NOT on the knob) so the icon never moves with
     the knob — it stays anchored to the empty half via percentage
     positioning and only changes content + colour + side via the
     aria-checked attribute. */
  .disabled-switch {
    --dts-w: 2em;
    --dts-h: 1em;
    --dts-red: rgb(220, 38, 38);
    --dts-green: rgb(34, 197, 94);
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    position: relative;
    width: var(--dts-w);
    height: var(--dts-h);
    border-radius: calc(var(--dts-h) / 2);
    border: 1.5px solid var(--dts-red);
    background: transparent;
    padding: 0;
    margin-right: 0.4em;
    vertical-align: middle;
    font: inherit;
    user-select: none;
    flex: 0 0 auto;
    cursor: pointer;
    transition: border-color 160ms ease;
  }
  .disabled-switch[aria-checked="true"] {
    border-color: var(--dts-green);
  }
  .disabled-switch .knob {
    position: absolute;
    top: 50%;
    left: 0.12em;
    width: calc(var(--dts-h) - 0.36em);
    height: calc(var(--dts-h) - 0.36em);
    border-radius: 50%;
    background: var(--dts-red);
    transform: translateY(-50%);
    transition: left 160ms ease, background 160ms ease;
  }
  .disabled-switch[aria-checked="true"] .knob {
    left: calc(100% - var(--dts-h) + 0.24em);
    background: var(--dts-green);
  }
  /* SPEC 17.133 -- glyph rides a real ds-icon child (was a
     ::before pseudo pre-17.133). The element sits absolutely
     positioned in the empty half opposite the knob:
       - DISABLED -> knob LEFT, glyph at ~72 % of width (RIGHT half).
       - ENABLED  -> knob RIGHT, glyph at ~28 % of width (LEFT half).
     The translate(-50%, -50%) transform centres the icon on that
     anchor point so the spacing is symmetric on both ends. The
     Lucide swap removes the system-font dependency the pre-17.133
     U+00D7 / U+2713 codepoints needed. The 0.7em sizing matches
     the pre-17.133 ::before font-size; the ds-icon atom defaults
     to a 1em host box so width/height drive the SVG rendered size
     directly. */
  .disabled-switch__glyph {
    position: absolute;
    top: 50%;
    left: 72%;
    transform: translate(-50%, -50%);
    width: 0.7em;
    height: 0.7em;
    color: var(--dts-red);
    pointer-events: none;
    transition: left 160ms ease, color 160ms ease;
  }
  .disabled-switch[aria-checked="true"] .disabled-switch__glyph {
    left: 28%;
    color: var(--dts-green);
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
  ><ds-icon name="ban"></ds-icon></span>`;
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
    <ds-icon class="disabled-switch__glyph" name=${disabled ? "x" : "check"}></ds-icon>
  </button>`;
}
