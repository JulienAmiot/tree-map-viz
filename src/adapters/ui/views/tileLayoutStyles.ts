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
 *    (bright off-white → dark-grey lerp by age in days; see
 *    `dateAgeColor.ts` and §17.42 for the simplification from the
 *    per-board fresh-colour design).
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
    /* SPEC 17.46 -- tile typography refresh. Pre-17.46 the host
       padding was 0.4rem 0.6rem, leaving ~12px gutters around the
       figure on a 16-px root that ate into the value's growth budget
       without pulling its weight visually. Post-17.46 the host
       padding shrinks to 0.2rem 0.35rem (~3.2 / 5.6 px on a 16-px
       root), giving the value's cqmin clamp a wider canvas to grow
       into while keeping the title row + target row visually clear
       of the tile's outer edge. The timestamp's bottom / right
       offsets shrink in lock-step (0.2rem / 0.35rem) so the date
       still hugs the same padded inner edge as the value's growth
       envelope. The 17.30 / 17.45 parent-vs-child timestamp
       parity is parity-of-deltas, not parity-of-absolutes, so
       symmetric reductions hold the contract. */
    padding: 0.2rem 0.35rem;
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
    /* SPEC 17.42 -- title font-weight is now a single static 700
       across both child and parent roles. The §17.39 morph helper
       (--drill-title-font-weight + the font-weight transition) is
       retired: with the child role already at 700 there is no
       weight delta to interpolate, so the operator gets a clean
       step-free morph on every system (variable fonts AND non-
       variable fallbacks), and the bright off-white parent title
       (rgb(245, 245, 245), see *AsParent.ts) carries the
       focused-panel emphasis on its own. */
    font-weight: 700;
    /* Fade out long titles instead of wrapping; we have a fixed 3vh
       height to honour. The timestamp moved to the bottom-right in
       §17.18, so the title row can use the full tile width. */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    /* SPEC §17.32 — drill-into morph paints ONLY the title with the
       parent role's bright off-white during the FLIP transition
       (operator's requirement: the value / timestamp / unit must
       keep their own colours). The mechanism is a custom CSS
       property the drill helper sets on the tapped tile element;
       CSS custom properties cascade through shadow DOM boundaries,
       so --drill-title-color propagates from the tile down through
       node-view and the per-view shadow into this rule.
       --drill-title-color is unset outside the drill, so the
       fallback currentColor reproduces the pre-§17.32 inherited
       title colour for static rendering. The transition on the
       color property is what makes the recolour animate smoothly;
       the duration matches DRILL_SETTLE_MS in
       drillTransitions.ts. SPEC 17.38 -- the same transition list
       gains font-size so the drill-into morph's font-size growth
       (2vh -> 2.4vh) animates on the same 320ms ease curve as the
       colour recolour. §17.42 dropped the font-weight transition
       from this list since the weight is now constant across
       roles. */
    color: var(--drill-title-color, currentColor);
    transition: color 320ms ease, font-size 320ms ease;
  }
  .timestamp {
    position: absolute;
    /* SPEC §17.18 — bottom-right (was top-right pre-§17.18). The
       offsets match the host's inner padding so the date hugs the
       padded inner edge rather than the raw tile border. SPEC §17.46
       trimmed the host padding (0.4 / 0.6 -> 0.2 / 0.35rem); the
       offsets follow in lock-step so the timestamp still sits flush
       with the inner padding edge rather than floating in the
       padding gap. */
    bottom: 0.2rem;
    right: 0.35rem;
    /* SPEC §17.46 -- shrunk from 1.4vh to 1.15vh. The operator
       feedback was "the date dominates next to the figure"; pulling
       the date down to ~85 % of its prior size leaves the figure
       (which §17.46 also bumps) as the unambiguous focal point of
       the tile while keeping the date legible at every viewport
       size the kiosk targets. */
    font-size: 1.15vh;
    line-height: 1;
    /* Per-tile colour driven by --age-color (bright off-white at
       age 0 days -> dark-grey at age >= 30 days, linear; see
       dateAgeColor.ts and §17.42 for the simplification from the
       per-board fresh-colour design). The fallback currentColor
       keeps tests / unit fixtures readable even when no inline
       style is set. */
    color: var(--age-color, currentColor);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    pointer-events: none;
  }
  .value-area {
    display: flex;
    /* SPEC 17.40 -- column flex so the .value and the new .target-row
       can stack vertically, both centered horizontally. Pre-17.40 the
       area was a row flex with a single .value child; row vs column
       does not change the visual for a single child (align-items +
       justify-content both resolve to centered). For 17.40 we add
       .target-row as a sibling that sits *under* .value -- column
       flex stacks them naturally without the per-view needing to
       restructure its template. */
    flex-direction: column;
    align-items: center;
    justify-content: center;
    /* Fill the rest of the tile below the title row. */
    height: calc(100% - 3vh);
    text-align: center;
    overflow: hidden;
    /* Avoid a single very long word forcing horizontal overflow. */
    word-break: break-word;
  }
  /* SPEC 17.41 -- horizontal flex row that holds the .value (and the
     adjacent .sigma badge for computedMean BSCs, when present) plus
     the new .trend-arrow. The row is centered as a unit inside
     .value-area, so for BSCs that show an arrow the value+arrow
     combo sits at the area horizontal center. The value alone is
     no longer the sole-centered glyph -- a small visual shift the
     operator gets in exchange for the trend signal landing right
     next to the figure (the §17.39 strip-full-width centering
     invariant therefore now applies to the value+arrow combo, NOT
     the value alone; the existing e2e check uses BSCs without arrow
     to keep the assertion unambiguous). */
  .value-row {
    display: flex;
    align-items: center;
    justify-content: center;
    /* gap is em-relative so it scales with the value's font-size. */
    gap: 0.3em;
    flex-wrap: nowrap;
    max-width: 100%;
    min-width: 0;
  }
  .value {
    font-weight: 700;
    line-height: 1.05;
    /* SPEC §17.17 — "the figure should be the biggest possible". The
       cqmin coefficient was bumped from 18 → 36 in §17.17. SPEC
       §17.46 amends to 42cqmin (a further ~17 % bump) on operator
       feedback: with the §17.46 host-padding trim the figure has
       more canvas to grow into, and the date moved to the smaller
       1.15vh size, so the figure can take more of the visual weight
       without crowding either edge. The 4-digit fit envelope holds
       (≈ k = 0.42 → per-char budget ≈ 1/(0.6·N) of cqmin > 0.42 for
       N ≤ 4). Floor 1.5rem keeps small-tile legibility; ceiling
       22rem prevents typographic blow-out on giant single-child
       layouts. The .target-row + .trend-arrow coefficients rescale
       in lock-step below to keep the 0.2× / 0.4× ratios. */
    font-size: clamp(1.5rem, 42cqmin, 22rem);
    /* SPEC §17.116 — the value glyph must never wrap on any tile.
       The §17.116c refresh moves the unit out of the inline .value
       run into a .unit-below block sibling, so the value's text run
       becomes a bare number that can sit on a single line at every
       cqmin level. white-space: nowrap is the belt that keeps a
       multi-digit value on one line when the tile is narrow;
       word-break: keep-all defeats any UA-default break opportunity
       between digit clusters. Lands here in §17.116b (foundations)
       so the rule is in place before §17.116c rewires Computed*
       tiles to stop emitting the inline .unit chip. */
    white-space: nowrap;
    word-break: keep-all;
    /* SPEC 17.40 -- when the mapper bakes a gradient colour for the
       BSC's current value (red -> orange -> yellow -> green along the
       min -> target progress), the per-view sets --bsc-value-color on
       the .value element inline; the rule here picks it up. The
       fallback currentColor preserves the default tile-text colour
       for non-BSC tiles, BSCs without a gradable value (childrenCount
       n=0), and unit fixtures that omit the inline style. */
    color: var(--bsc-value-color, currentColor);
  }
  .value.empty::before {
    content: "";
  }
  /* Unit nested inside the value: 1/3 of the value's surrounding
     font-size, regardless of where the cqmin clamp landed.
     SPEC §17.116 — superseded by .unit-below below for Computed*
     tiles in §17.116c and BSC + TextNode tiles in §17.116d; kept
     in place during the foundations strand so pre-§17.116c BSC
     views still size their inline .unit chip correctly. The rule
     retires entirely in §17.116d once every view has moved to
     the .unit-below sibling. */
  .value .unit {
    font-size: calc(1em / 3);
    font-weight: 500;
    color: color-mix(in srgb, currentColor 75%, transparent);
  }
  /* SPEC §17.116 — the unit moves out of the inline .value run into
     its own block sibling under it (consumed by Computed* tiles in
     §17.116c, BSC + TextNode tiles in §17.116d). Same ~1/3 ratio
     against the value's cqmin-driven font-size — the unit-below's
     clamp(0.6rem, 14cqmin, 5rem) vs the value's clamp(1.5rem,
     42cqmin, 22rem) gives 14/42 = 1/3 in the unbounded middle of
     the two envelopes — so the visual proportion the pre-§17.116
     ".value .unit" rule produced is preserved. The block placement
     lets the operator scan "title → value → unit → timestamp"
     top-to-bottom on the tile instead of "title → value-with-
     inline-unit → timestamp" which forced the row to choose
     between wrapping (ugly) and truncating the unit (worse). */
  .unit-below {
    display: block;
    margin-top: 0.15em;
    font-weight: 500;
    font-size: clamp(0.6rem, 14cqmin, 5rem);
    line-height: 1.1;
    color: color-mix(in srgb, currentColor 75%, transparent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  /* SPEC §17.116 — the computation-kind label sits **under the
     title** on a Computed* tile in a thinner / smaller font and is
     NOT editable (the pre-§17.116 inline dropdown retires in
     §17.116c; kind switching belongs to the edit modal as a future
     §17.116-followup). The fixed 1.4vh font-size (~70% of the 2vh
     child-role title; ~58% of the 2.4vh parent-role title) gives
     the kind label the visual weight of a sub-title without
     competing with the operator-edited title text. font-weight:
     400 vs the title's 700 reinforces the "supporting context"
     reading; the small-caps variant + letter-spacing trim turn
     the kind verb ("SUM" / "AVERAGE") into a typographic label
     rather than a sentence fragment. Lands in §17.116b (dormant
     until §17.116c wires the Computed* card to render it). */
  .kind-label {
    display: block;
    margin: 0 0 0.2em;
    height: 1.8vh;
    line-height: 1.8vh;
    font-size: 1.4vh;
    font-weight: 400;
    color: color-mix(in srgb, currentColor 65%, transparent);
    font-variant: small-caps;
    letter-spacing: 0.04em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* SPEC §17.116 — full-tile warning glyph for Computed* nodes that
     cannot produce a value (strategy threw EmptyChildrenError, OR
     produced a non-finite number, OR has no eligible child). The
     visual contract mirrors the §17.24 PlusTile: dashed border,
     huge centred glyph, calm muted colour. Renders INSIDE the
     existing .value-area so the title row + (optional) kind-label
     above still read as the tile's identity; the warning is the
     value-area's content and fills it edge-to-edge.

     A separate .warning-fill class (rather than reusing the §17.40
     ".value.empty" rule) keeps the §17.40 "empty value area"
     contract intact for BSC "childrenCount n=0" tiles, which the
     operator's §17.116 instruction did NOT cover (BSC empty stays
     literally empty per the v3 design). Lands in §17.116b (dormant
     until §17.116c wires the Computed* card to render it). */
  .warning-fill {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    border: 2px dashed
      color-mix(in srgb, var(--muted, currentColor) 45%, transparent);
    border-radius: 8px;
    color: var(--muted, currentColor);
    user-select: none;
  }
  .warning-fill::before {
    /* U+26A0 + U+FE0E forces text-style (monochrome) presentation so
       systems that default the warning sign to colour emoji honour
       the .warning-fill colour. Sized in cqmin so the glyph fills
       the tile the same way the §17.24 PlusTile cross does. */
    content: "\u26A0\uFE0E";
    font-size: clamp(2rem, 50cqmin, 12rem);
    line-height: 1;
    font-weight: 700;
  }
  .sigma {
    /* Σ badge for computed BSCs — small chip near the value, tile-relative
       so it stays proportional. SPEC §17.116 — superseded by the title-
       prefix Σ render in Computed* tiles (§17.116c) and BSC computedMean
       tiles (§17.116d); the rule retires in §17.116d once every view has
       moved to the title-prefix render. */
    margin-left: 0.45em;
    font-size: clamp(0.85rem, 4cqmin, 1.5rem);
    padding: 0.05em 0.4em;
    border-radius: 999px;
    background: color-mix(in srgb, currentColor 12%, transparent);
    color: color-mix(in srgb, currentColor 90%, transparent);
    vertical-align: middle;
  }

  /* ------------------------------------------------------------------
     SPEC 17.40 + 17.44 -- BSC objective row + off-track warning.
     ------------------------------------------------------------------
     The .target-row sits under .value inside .value-area (column flex)
     and shows the operator-set "target value, unit, and target date"
     in a compact small line. The 0.2-of-value height the operator
     asked for is achieved by mirroring .value's clamp() coefficients
     scaled by 0.2 -- (1.5rem -> 0.3rem; 36cqmin -> 7.2cqmin; 20rem
     -> 4rem). The ratio holds at every tile size because the same
     cqmin axis drives both clamps; no CSS variable plumbing needed.

     The .target-row's bullseye + text + date stay at currentColor
     (the default tile text) -- the gradient pop is reserved for the
     .value itself (red->orange->yellow->green, 17.40) and the
     .warning-icon at the row's right end (yellow->orange->red, 17.44).
     The two coloured surfaces answer two operator questions: the
     value "how good is the current reading?", the warning "and how
     badly is the trend missing the deadline?". The supporting text
     stays neutral so the eye lands on the colour signals first.

     The .warning-icon (17.44) sits at the right end of the
     .target-row, after .target-date, em-scaled to the row's font-size
     so it stays in proportion with the bullseye on the left. Pre-17.44
     it was absolutely positioned at the tile's bottom-left in plain
     currentColor; the 17.44 amendment moves it into the target row
     with a yellow->orange->red tint keyed to the deviation magnitude.
  */

  .target-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4em;
    margin-top: 0.4em;
    /* 0.2 x .value's clamp() -- visually 20 % of the value height at
       every cqmin level. SPEC §17.46 -- rescaled with the value's
       42cqmin bump (was 7.2cqmin / 4rem ceil at the 36cqmin / 20rem
       value rule). The font-size also drives the bullseye icon's
       width/height through em units so the icon scales in lock-step. */
    font-size: clamp(0.3rem, 8.4cqmin, 4.4rem);
    line-height: 1.1;
    font-weight: 500;
    /* Default tile text colour -- intentionally NOT gradient-coloured
       (the value row carries the colour signal; the target row is
       supporting context). */
    color: color-mix(in srgb, currentColor 80%, transparent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .target-row .target-text {
    font-variant-numeric: tabular-nums;
  }
  .target-row .target-sep {
    /* Middle-dot separator between value+unit and date. Slightly
       muted so it does not draw the eye away from the numbers. */
    opacity: 0.6;
  }
  /* ----- Bullseye target icon -----
     Uses the Unicode U+25CE "BULLSEYE" glyph (text-style, present in
     every modern system symbol font: Segoe UI Symbol on Windows,
     Apple Symbols on macOS / iOS, Noto Sans Symbols on Android).
     Rendering it as ::before content keeps the icon proportional to
     the .target-row font-size (1em wide), avoids a per-icon SVG
     asset, and inherits currentColor so the operator's "monocolor,
     same tint as default tile text" requirement holds without any
     extra paint property.

     Falls back to a CSS-drawn ring on the sliver of devices missing
     U+25CE (none of the kiosk targets, but defensible) via the
     pseudo-element's inherited line-height and a thin border on the
     host span -- the worst case is a plain circle, still clearly
     "target marker" alongside the value. */
  .target-icon {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.05em;
    height: 1.05em;
    line-height: 1;
    align-self: center;
    color: currentColor;
  }
  .target-icon::before {
    content: "\u25CE";
    /* Force text-style presentation in case a future system flips
       the glyph to colour emoji. */
    font-feature-settings: normal;
    font-size: 1.05em;
  }

  /* ----- Trend arrow (SPEC 17.41) -----
     Sits in .value-row to the right of the .value, scaled at ~40 %
     of the value's clamp range (similar coefficient ratio the target-
     row uses against the value -- 0.4 / 1.0 = 40 %, vs the target row's
     0.2 / 1.0 = 20 %). The clamp's small-tile floor (0.6rem) keeps the
     glyph legible on the smallest 1/12 floor tiles; the large-tile
     ceiling (8rem) prevents typographic blow-out on giant single-child
     layouts. cqmin scales identically to .value's clamp so the arrow
     stays in proportion at every container size.

     Colour: currentColor -- monochrome mirroring the bullseye and
     warning glyphs (§17.40 amendment policy: the colour-as-severity
     signal stays on the value glyph alone; the arrow's *direction*
     carries its own at-a-glance signal without needing a hue scale).

     The data-direction attribute is inert -- it is published by the
     per-view as a stable e2e hook so a Playwright test can assert
     which bucket the mapper landed on without parsing the rendered
     glyph. CSS does NOT style by data-direction (the glyph itself
     differs per bucket; we use the Unicode code-point to render,
     not a CSS rotation). */
  .trend-arrow {
    flex: 0 0 auto;
    /* 0.4 x .value's clamp() -- visually 40 % of the value height at
       every cqmin level. SPEC §17.46 -- rescaled with the value's
       42cqmin bump (was 14.4cqmin / 8rem ceil at the 36cqmin / 20rem
       value rule). The same cqmin axis drives both clamps so the
       ratio holds at every tile size. */
    font-size: clamp(0.6rem, 16.8cqmin, 8.8rem);
    line-height: 1;
    /* Kerning fix for the diagonal arrows (\u2197, \u2198) which sit
       slightly above the baseline in most system fonts; -0.05em
       optical correction lands them visually centered on the value's
       cap height. */
    margin-bottom: -0.05em;
    color: currentColor;
    user-select: none;
    pointer-events: none;
  }

  /* ----- Deadline-risk warning icon (SPEC 17.44) -----
     Uses the U+26A0 "WARNING SIGN" code-point with U+FE0E text-style
     selector forcing monochrome text presentation (otherwise modern
     systems render the colour-emoji yellow-and-black variant which
     would lock us out of the per-element inline color the mapper
     paints from vm.objective.warningColor).

     Position: inline at the right end of the .target-row, after the
     .target-date. Pre-17.44 the glyph was absolutely positioned at
     bottom-left of the tile in plain currentColor; the 17.44
     amendment moves it into the target row so the trajectory-risk
     signal sits next to the deadline it concerns, and the
     yellow->orange->red tint keyed to the deviation magnitude lets
     the operator decode "how badly the trend is missing" at a
     glance instead of the binary "is it missing?" the 17.40
     amendment offered.

     Scale: 1em (matches the .target-row font-size) so the warning
     reads proportional to the bullseye on the left. Optional
     -0.1em margin-left tightens the glyph against .target-date for
     a balanced row visual; .target-row's gap rule already provides
     the baseline 0.4em separation, so the negative margin only
     trims that gap to about 0.3em (matches the bullseye -> text
     gap on the row's left edge).

     Colour: currentColor fallback; the per-element inline style
     (color: rgb(...)) baked by valueTemplate from vm.objective
     .warningColor takes precedence and paints the glyph on the
     17.44 yellow->orange->red ramp. The fallback keeps the rule
     readable under unit fixtures that omit the inline style. */
  .warning-icon {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    margin-left: -0.1em;
    color: currentColor;
    pointer-events: none;
    user-select: none;
  }
  .warning-icon::before {
    /* U+26A0 + U+FE0E forces text-style (monochrome) presentation so
       systems that default the warning sign to colour emoji honour
       our inline color. */
    content: "\u26A0\uFE0E";
    font-feature-settings: normal;
  }
`;
