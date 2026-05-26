/**
 * Shared `warning-fill` glyph template (SPEC §17.116 + §17.119 + §17.120).
 *
 * Three tile families render the same warning fallback when their
 * value pipeline can't produce a renderable payload:
 *
 *   - **Computed* tiles** (`ComputedNode`, `ComputedBusinessScoreNode`)
 *     surface the glyph when the computation strategy returns `null`.
 *   - **PictureNode tiles** swap the `<img>` for the glyph on a DOM
 *     `error` event.
 *   - **URLNode tiles** swap the QR `<img>` for the glyph when the
 *     `qrcode` library rejects the URL (payload too large for any
 *     error-correction level).
 *
 * Pre-extraction each of the three sites duplicated the same five-
 * attribute `<div>`; Sonar's new-code duplication detector flagged
 * the §17.119 → §17.120 strand pair as the duplicate (the
 * Computed* tile predates the gate). Centralising the template
 * keeps every site identical on the DOM shape that
 * `data-testid="warning-fill"` selectors rely on.
 *
 * The `data-reason` attribute is the per-site differentiator —
 * e2e selectors / unit tests can target a specific failure mode
 * (e.g. `[data-reason="image-load-failed"]`) without breaking the
 * other two strands. The `aria-label` carries the operator-visible
 * description for screen readers.
 */

import { html, type TemplateResult } from "lit";

import "./icon/Icon.js";

/**
 * Renders the warning glyph. `reason` lands on `data-reason`,
 * `ariaLabel` on `aria-label`; both are required so callers
 * cannot accidentally emit a glyph without a structured failure
 * mode + a screen-reader-readable description.
 *
 * SPEC §17.133 — the inner glyph is the `<ds-icon name="triangle-alert">`
 * Lucide SVG (was a CSS-pseudo `::before` rule with `content:
 * "\u26A0\uFE0E"` on `.warning-fill` pre-§17.133). The wrapping
 * `<div class="warning-fill">` is unchanged so every existing
 * `data-testid="warning-fill"` selector + `data-reason=…`
 * branching keeps working without a test rewrite.
 */
export function renderWarningFill(
  reason: string,
  ariaLabel: string,
  /**
   * SPEC §17.142e — optional `slot` attribute baked onto the
   * `.warning-fill` wrapper so the atom can be stamped directly as a
   * `<card-body>` slot child (e.g. `slot="lead"` on the single-column
   * Picture/URL variants) without a structural wrapper. Defaults to
   * `undefined`; existing callers that compose the fill as a flat
   * sibling keep their pre-§17.142e DOM shape unchanged.
   */
  slot?: string,
): TemplateResult {
  const slotAttr = slot ?? "";
  return html`<div
    slot=${slotAttr}
    class="warning-fill"
    data-testid="warning-fill"
    data-reason=${reason}
    role="img"
    aria-label=${ariaLabel}
  ><ds-icon name="triangle-alert"></ds-icon></div>`;
}
