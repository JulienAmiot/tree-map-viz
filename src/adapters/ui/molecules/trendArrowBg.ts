/**
 * SPEC §17.139 — CSS-background data URIs for the BSC AsChild
 * `.current-value` trend arrow + `.target-value` target icon.
 *
 * Sits at the molecule layer (BSC-specific concern; only the BSC
 * AsChild organism reads it) so the {@link TrendArrowDirection}
 * union can flow from `NodeViewModel.ts` without an atom→molecule
 * reverse-dep.
 *
 * The kiosk's `<ds-icon>` atom (§17.131) renders Lucide SVGs as DOM
 * children with `stroke="currentColor"` so they follow the
 * surrounding CSS colour. CSS `background-image: url(data:...)`
 * cannot inherit `currentColor` from its host — the SVG's stroke
 * colour is baked into the data URI. For the trend arrow + target
 * icon background that's acceptable: the §17.40 amendment locks
 * the colour-as-severity signal onto the value glyph alone (red →
 * green ramp), so the supporting icons stay monochrome. We bake
 * the kiosk's `--muted` token (`#9aa3b4`) into every data URI so
 * the icons read at the same muted weight on every tile.
 *
 * The 5 trend directions cover the half-circle ↑ ↗ → ↘ ↓ — the
 * only buckets that have meaning in a 1D progress-rate signal
 * (see `domain/aggregation/objectiveProgress.trendArrowFromRate`).
 *
 * Lucide path data sourced from the `lucide-static` raw imports
 * the §17.131 `ICON_REGISTRY` already consumes; the `?raw` strings
 * include the full `<svg ...>` envelope, so the only transform
 * here is the `stroke="currentColor" → "#9aa3b4"` substitution and
 * the URL-percent-encoding for safe embedding in a `url(...)` CSS
 * value.
 */

import arrowDownSvg from "lucide-static/icons/arrow-down.svg?raw";
import arrowDownRightSvg from "lucide-static/icons/arrow-down-right.svg?raw";
import arrowRightSvg from "lucide-static/icons/arrow-right.svg?raw";
import arrowUpSvg from "lucide-static/icons/arrow-up.svg?raw";
import arrowUpRightSvg from "lucide-static/icons/arrow-up-right.svg?raw";
import targetSvg from "lucide-static/icons/target.svg?raw";

import type { TrendArrowDirection } from "./NodeViewModel.js";

/** Static muted-text colour token from `src/index.css` (`--muted:
 * #9aa3b4`). Baked into every background data URI so the icons
 * read at the same weight independent of the host's CSS colour. */
const ICON_STROKE_COLOR = "#9aa3b4";

/** Wraps the Lucide raw SVG into a CSS `url(data:image/svg+xml,...)`
 * background-image value, with the stroke recoloured to the
 * `--muted` static token (see file docblock). `encodeURIComponent`
 * handles every special char (`#`, `<`, `>`, `"`, `&`) the data
 * URI's URL component must escape. */
function bgUrl(rawSvg: string): string {
  const recoloured = rawSvg.replaceAll(
    'stroke="currentColor"',
    `stroke="${ICON_STROKE_COLOR}"`,
  );
  return `url("data:image/svg+xml,${encodeURIComponent(recoloured)}")`;
}

/** Trend-direction → CSS `background-image` value. The 5 keys
 * mirror {@link TrendArrowDirection}'s non-null buckets (the VM's
 * `trendArrow` is `TrendArrowDirection | null`; the `null` case
 * is filtered at the call site so the table need not include
 * it). */
export const TREND_ARROW_BG: Readonly<Record<TrendArrowDirection, string>> =
  Object.freeze({
    up: bgUrl(arrowUpSvg),
    "up-right": bgUrl(arrowUpRightSvg),
    right: bgUrl(arrowRightSvg),
    "down-right": bgUrl(arrowDownRightSvg),
    down: bgUrl(arrowDownSvg),
  });

/** Target-row leading icon background-image value (Lucide
 * `target` glyph at the same muted weight as the trend arrows). */
export const TARGET_ICON_BG: string = bgUrl(targetSvg);
