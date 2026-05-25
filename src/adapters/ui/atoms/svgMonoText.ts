/**
 * SPEC §17.139 — pure-CSS / pure-SVG monospace text scaling atom.
 *
 * Renders a `<text>` element inside an `<svg>` sized so the text
 * fills the cell HORIZONTALLY *and* maintains its monospace glyph
 * proportions across every container size (no `clamp(...)` /
 * `cqmin` / `--char-count` plumbing required).
 *
 * **How it scales**: the SVG sets `width="100%"` + `height="auto"`,
 * so the browser computes the SVG's rendered height from its
 * viewBox aspect ratio + the parent's resolved width. The viewBox
 * width is `text.length × MONO_CHAR_WIDTH` (+ optional left padding
 * for a leading icon background); the viewBox height is the
 * reference font-size (22). Result: short strings get a taller SVG
 * (more visible text); long strings get a shorter SVG (text
 * naturally scales down). The text inside renders at a constant
 * font-size 22 in viewBox space — the SVG → cell scaling does all
 * the work without any CSS clamp.
 *
 * **`MONO_CHAR_WIDTH = 13.2`** — empirical 0.6 × 22 ratio averaged
 * across the §17.138 `ui-monospace` stack (Cascadia Mono ≈ 12.89,
 * SF Mono / Menlo ≈ 13.2, Consolas ≈ 12.1). Headless-Chromium probe
 * at 2026-05-25 reported 12.89/char for the fallback face; 13.2
 * gives a tiny right-edge safety margin (≈ 0.3 px/char on Cascadia,
 * ≈ 1.1 px/char on Consolas) so no glyph clips on the slice/meet
 * boundary.
 *
 * **`preserveAspectRatio="xMinYMid meet"`** — anchors the text at
 * the LEFT of the SVG (`xMin`) and centers vertically (`yMid`),
 * with `meet` so the viewBox fits inside its container without
 * clipping. When the cell is wider than the viewBox aspect, the
 * SVG fills vertically and leaves empty space on the right (where
 * the CSS background trend / target icon shows through cleanly).
 */

import { html, type TemplateResult } from "lit";

/** Per-char advance width in viewBox units at font-size 22.
 * See file docblock for the 0.6 × 22 derivation. */
export const MONO_CHAR_WIDTH = 13.2;

/** Reference font-size in viewBox units — the height of every
 * monospace SVG produced by `renderMonoTextSvg`. The actual on-
 * screen font-size scales with the SVG's rendered height. */
export const MONO_VIEWBOX_FONT_SIZE = 22;

/** §17.138 monospace stack mirrored into SVG `font-family` so the
 * `<text>` glyph metrics match the kiosk body face. SVG inherits
 * the `--font` CSS variable from its host through `currentColor`
 * for colour, but `font-family` on SVG `<text>` must be explicit
 * (SVG `<text>` doesn't inherit CSS `font-family` from the
 * containing element on every browser). */
const MONO_STACK_SVG =
  'ui-monospace, "Cascadia Mono", "Segoe UI Mono", Menlo, Consolas, ' +
  '"Liberation Mono", monospace';

export interface MonoTextOptions {
  /** Empty viewBox space on the left for a leading icon background.
   * The text's `x` is anchored at this value; the viewBox width
   * grows by the same amount. Defaults to 0 (no leading padding). */
  leftPadding?: number;
  /** Empty viewBox space on the right of the text. The viewBox
   * width grows by this amount; `xMinYMid meet` keeps the text
   * anchored at the left so the extra room appears as trailing
   * whitespace (useful when a CSS background icon sits on the
   * right edge of the cell — SPEC §17.140 — and the text needs
   * visual clearance before reaching the icon). Defaults to 0. */
  rightPadding?: number;
  /** SVG `font-weight` attribute on `<text>`. Defaults to 700 to
   * match the kiosk's value-glyph weight. */
  fontWeight?: number;
  /** Optional `data-testid` on the outer `<svg>` for e2e hooks. */
  testid?: string;
  /** Optional `data-value-kind` on `<text>` (mirrors the pre-§17.139
   * `<span class="value" data-value-kind="...">` attribute). */
  dataValueKind?: string;
}

/** Render a Lit template for an `<svg>` containing a single
 * monospace `<text>` element whose viewBox width is computed from
 * `text.length × MONO_CHAR_WIDTH + leftPadding`. The SVG uses
 * `width="100%"` / `height="auto"` so its rendered size tracks the
 * parent's width while keeping the viewBox-implied aspect ratio. */
export function renderMonoTextSvg(
  text: string,
  opts: MonoTextOptions = {},
): TemplateResult {
  const leftPadding = opts.leftPadding ?? 0;
  const rightPadding = opts.rightPadding ?? 0;
  const fontWeight = opts.fontWeight ?? 700;
  const vbWidth = leftPadding + text.length * MONO_CHAR_WIDTH + rightPadding;
  const vbHeight = MONO_VIEWBOX_FONT_SIZE;
  return html`<svg
    class="mono-text"
    width="100%"
    height="auto"
    viewBox=${`0 0 ${vbWidth} ${vbHeight}`}
    preserveAspectRatio="xMinYMid meet"
    data-testid=${opts.testid ?? ""}
  >
    <text
      x=${leftPadding}
      y=${vbHeight / 2}
      text-anchor="start"
      dominant-baseline="central"
      font-size=${vbHeight}
      font-weight=${fontWeight}
      font-family=${MONO_STACK_SVG}
      fill="currentColor"
      data-value-kind=${opts.dataValueKind ?? ""}
    >${text}</text>
  </svg>`;
}
