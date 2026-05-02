/**
 * Shared CSS for the four per-(kind × role) view elements (SPEC §17.14).
 *
 * The contract that every tile must satisfy:
 *
 *  - **Title row**: top of the tile, **fixed `3vh` height**, font-size also
 *    `vh`-relative so titles are visually consistent across tiles regardless
 *    of how big or small a given tile is. The "3 %" comes straight from the
 *    user requirement; bumping the constant is a one-line change.
 *  - **Timestamp**: absolutely-positioned in the **bottom-right corner**
 *    (SPEC §17.18 — moved from top-right so the title row keeps the full
 *    tile width and the date sits below the figure where the eye lands
 *    after reading the value). Rendered by the per-role element (the
 *    BSC value template tells callers via `timestampForValue()` whether
 *    to show one). Sized in `vh` so it stays readable at any tile size;
 *    the *colour* is set per-tile via the `--age-color` custom property
 *    (warm orange → cold pale blue lerp by age in days, see
 *    `dateAgeColor.ts`).
 *  - **Value box**: takes the rest of the tile (`flex: 1`) and centers a
 *    big value glyph. Font-size is `cqmin`-driven so the value fills the
 *    *tile* (container query — independent of the title's `vh` scale),
 *    clamped between a readable floor and a ceiling that doesn't blow
 *    out the largest tiles. The clamp coefficient was bumped to
 *    `36cqmin` in §17.17 so the figure is the biggest possible while
 *    still fitting up to a 4-digit number on a square tile.
 *  - **Unit**: 1/3 of the value's font-size via `font-size: calc(1em / 3)`
 *    on a nested `<span class="unit">`. Because `em` resolves against
 *    the parent's computed font-size, the ratio holds whatever the
 *    `cqmin`-clamped value lands at.
 *
 * Each element imports this `tileLayoutStyles` constant and concats it
 * into its own `static styles`. The shared constant means a layout
 * tweak is a single-file change instead of a four-way grep.
 */

import { css } from "lit";

export const tileLayoutStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    container-type: size;
    position: relative;
    width: 100%;
    height: 100%;
    color: inherit;
    font: inherit;
    /* Modest inner padding lets the value breathe a little without
       eating into the available space too much; tuned to keep small
       tiles still legible. */
    padding: 0.4rem 0.6rem;
    overflow: hidden;
  }
  .title {
    margin: 0;
    height: 3vh;
    line-height: 3vh;
    /* SPEC 17.38 -- the child-role base font-size is 2vh; the
       parent-role overrides to 2.4vh in *AsParent.ts. During the
       drill-into FLIP morph (drillTransitions.ts) the helper sets
       --drill-title-font-size: 2.4vh on the tapped tile element,
       and CSS custom properties cascade through shadow DOM, so
       the morphing tile's title smoothly grows from 2vh to 2.4vh
       over the settle window. At commit Lit re-renders the strip
       with the per-view in the parent role (which carries the
       same 2.4vh literal), so there is no visible size pop on
       hand-off. The fallback (2vh) preserves the pre-17.38 child-
       tile rendering for every non-drilling tile. */
    font-size: var(--drill-title-font-size, 2vh);
    /* SPEC 17.39 -- same plumbing as 17.38's font-size morph,
       applied to font-weight. Child role is 600 (the fallback),
       parent role overrides to 700 in *AsParent.ts. The drill
       helper writes --drill-title-font-weight: 700 onto the
       morphing tile so the cascade lifts the resolved weight
       to 700, the transition list below smooths the growth, and
       at commit the parent-role override wins by source-order
       at the same value -- no weight pop. Modern variable system
       fonts (Segoe UI Variable on Windows 10+, SF Pro on Mac /
       iOS, Roboto on Android) interpolate the weight smoothly
       along the wght axis; non-variable fallbacks step at the
       midpoint, still better than the pre-17.39 step at 100 %. */
    font-weight: var(--drill-title-font-weight, 600);
    /* Fade out long titles instead of wrapping; we have a fixed 3vh
       height to honour. The timestamp moved to the bottom-right in
       §17.18, so the title row can use the full tile width. */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    /* SPEC §17.32 — drill-into morph paints ONLY the title with
       var(--board-fresh) during the FLIP transition (operator's
       requirement: the value / timestamp / unit must keep their
       own colours). The mechanism is a custom CSS property the
       drill helper sets on the tapped tile element; CSS custom
       properties cascade through shadow DOM boundaries, so
       --drill-title-color propagates from the tile down through
       node-view and the per-view shadow into this rule.
       --drill-title-color is unset outside the drill, so the
       fallback currentColor reproduces the pre-§17.32 inherited
       title colour for static rendering. The transition on the
       color property is what makes the recolour animate smoothly;
       the duration matches DRILL_SETTLE_MS in
       drillTransitions.ts. SPEC 17.38 -- the same transition list
       gains font-size so the drill-into morph's font-size growth
       (2vh -> 2.4vh) animates on the same 320ms ease curve as the
       colour recolour. SPEC 17.39 -- font-weight is added to the
       same list so the 600 -> 700 promotion animates on the same
       curve too (smooth on variable fonts, midpoint-stepped on
       non-variable fallbacks; either way better than the post-
       commit step pre-17.39). */
    color: var(--drill-title-color, currentColor);
    transition: color 320ms ease, font-size 320ms ease,
      font-weight 320ms ease;
  }
  .timestamp {
    position: absolute;
    /* SPEC §17.18 — bottom-right (was top-right pre-§17.18). The
       offsets match the host's inner padding so the date hugs the
       padded inner edge rather than the raw tile border. */
    bottom: 0.4rem;
    right: 0.6rem;
    font-size: 1.4vh;
    line-height: 1;
    /* Per-tile colour driven by --age-color (board-level fresh
       endpoint -> dynamically-desaturated grey of the same hue,
       lerped by age in days; see dateAgeColor.ts and §17.21). The
       fallback currentColor keeps tests / unit fixtures readable
       even when no inline style is set. We deliberately drop the
       prior color-mix transparent dimming so the picked gradient
       colour shows at full saturation against the tile background;
       both endpoint colours pass WCAG AA contrast on the kiosk's
       dark theme (see §17.18). */
    color: var(--age-color, currentColor);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    pointer-events: none;
  }
  .value-area {
    display: flex;
    align-items: center;
    justify-content: center;
    /* Fill the rest of the tile below the title row. */
    height: calc(100% - 3vh);
    text-align: center;
    overflow: hidden;
    /* Avoid a single very long word forcing horizontal overflow. */
    word-break: break-word;
  }
  .value {
    font-weight: 700;
    line-height: 1.05;
    /* SPEC §17.17 — "the figure should be the biggest possible". The
       cqmin coefficient was bumped from 18 → 36 (= roughly 2x the prior
       size) so a single-digit/short numeric value fills its tile.
       cqmin scales with the smaller of the tile's own width/height, so
       the value never overflows horizontally on wide-and-short tiles
       nor vertically on tall-and-thin ones. The clamp range was tuned
       so that a 4-digit number (e.g. "1234") still fits the tile width
       at this coefficient (≈ k = 0.36 → width budget per char of about
       1/(0.6·N) of cqmin, comfortably above 0.36 for N ≤ 4). The
       small-tile floor 1.5rem keeps numbers legible on the smallest
       1/12-floor tiles; the large-tile ceiling 20rem prevents
       typographic blow-out on giant single-child layouts. */
    font-size: clamp(1.5rem, 36cqmin, 20rem);
  }
  .value.empty::before {
    content: "";
  }
  /* Unit nested inside the value: 1/3 of the value's surrounding
     font-size, regardless of where the cqmin clamp landed. */
  .value .unit {
    font-size: calc(1em / 3);
    font-weight: 500;
    color: color-mix(in srgb, currentColor 75%, transparent);
  }
  .sigma {
    /* Σ badge for computed BSCs — small chip near the value, tile-relative
       so it stays proportional. */
    margin-left: 0.45em;
    font-size: clamp(0.85rem, 4cqmin, 1.5rem);
    padding: 0.05em 0.4em;
    border-radius: 999px;
    background: color-mix(in srgb, currentColor 12%, transparent);
    color: color-mix(in srgb, currentColor 90%, transparent);
    vertical-align: middle;
  }
`;
