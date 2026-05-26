/**
 * Shared CSS for every per-(kind × role) view element (SPEC §17.14,
 * refined through §17.142f).
 *
 * Scope post-§17.142f -- the atom carries ONLY the rules that are
 * still common across every kiosk-visible tile after the §17.142
 * `<card-body>` migration:
 *
 *  - **`:host`** -- block-level sizing, container-query root, the
 *    §17.46 inner-padding refresh.
 *  - **`.title`** -- 3vh row, drill-into FLIP custom-property hooks
 *    (`--drill-title-color` / `--drill-title-font-size`), ellipsis
 *    overflow.
 *  - **`.timestamp`** -- absolute bottom-right placement, the §17.42
 *    `--age-color` lerp, tabular-nums.
 *  - **`.subtitle`** -- universal-alignment 2vh row (the §17.121j
 *    contract: every kind keeps the slot even when empty so the
 *    value-area lines up across the wall).
 *  - **`.warning-fill`** -- full-tile fallback glyph shared by every
 *    kind that can fail to produce a value (Computed* + PictureNode
 *    + URLNode through the §17.142e `renderWarningFill(..., "lead")`
 *    refresh).
 *  - **`.warning-icon`** -- per-objective deadline-risk glyph
 *    (§17.44) shared by BSC + Computed* per-views.
 *
 * Pre-§17.142f this atom also owned the `.value-area` CSS-grid +
 * `.value-row` / `.target-row` / `.target-icon` / `.trend-arrow` /
 * `.value` rules driving the §17.137 A2b BSC + Computed* split-body
 * layout. The §17.142 strand series migrated every kind onto the
 * shared `<card-body>` molecule (which owns the grid + cell
 * alignment + orientation flip from its own shadow root); the
 * per-view stamps `.current-value`, `.target-value`, `.target-date`
 * directly as slot children rendered through `renderMonoTextSvg`
 * with the §17.139 CSS-background trend / bullseye glyphs. Those
 * rules now live in each per-view's local `static styles` (which
 * was already where most of them ended up by §17.142b/c), so the
 * shared atom is much smaller.
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
  /* SPEC §17.121e — subtitle slot directly under the title, used by
     per-views to surface one of the node's properties in a compact
     strip below the title (WorkflowNode's status badge, Computed*
     card's active computation kind). SPEC §17.121j — the slot is
     now UNIVERSAL across every tile (operator's requirement: "take
     into account the subtitle space of a card, even if you don't
     display anything there, to keep the alignment of the content of
     the cards consistent"). The default --subtitle-row-height is
     2vh so a view that emits only an empty .subtitle div still
     reserves the row; views that don't need the slot for content
     still keep it for vertical alignment of the value-area across
     the entire kiosk wall. A per-view can override the variable
     on :host if a kind needs a taller / shorter slot, but no view
     should set it back to 0 — the alignment contract holds the
     constant 2vh row across the board.

     Centered single-line flex row; overflow hides + ellipsis so a
     long property string degrades gracefully. The font-size is
     vh-relative (1.4vh) so it stays in proportion with the title
     across every kiosk viewport. */
  .subtitle {
    display: flex;
    align-items: center;
    justify-content: center;
    /* SPEC §17.121h — flex gap so the focused-panel subtitle row can
       host multiple pills side-by-side (status / strategy picker +
       enable/disable toggle). Single-child subtitles unaffected. */
    gap: 0.5em;
    height: var(--subtitle-row-height, 2vh);
    line-height: 1;
    font-size: 1.4vh;
    color: color-mix(in srgb, currentColor 80%, transparent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    /* §17.121e — let the badge / select rendered inside the slot
       be tappable when the per-view wants it to be (the Computed*
       asParent variant nests a <select> here); the slot itself
       carries no pointer behaviour. */
    pointer-events: auto;
  }
  /* SPEC 17.142f -- the .value-area grid, .value-row / .target-row
     layout rules, .target-icon + .trend-arrow glyph rules, .value
     font-size clamp + colour token, the portrait container-query
     flip block, and the adjacent .unit-below / .kind-label
     retirement notes all RETIRED here. Pre-17.142f they served the
     17.137 A2b CSS-Grid split-body layout the BSC + Computed*
     views drove through this atom. The 17.142 strand series
     migrated every kiosk-visible card kind onto the shared
     <card-body> molecule (Workflow / Text / Picture / URL through
     the data-layout="lead-only" single-column variant; BSC +
     Computed* + CBSN through the default 3-cell lead / aux / meta
     grid); the molecule owns the grid + orientation flip + cell
     alignment from its own shadow root, and the per-view stamps
     .current-value, .target-value, .target-date directly as slot
     children rendered through renderMonoTextSvg with the 17.139
     CSS-background trend / bullseye glyphs. The shared atom keeps
     the bits that are STILL common across every per-view (:host
     sizing, .title, .timestamp, .subtitle, .warning-fill,
     .warning-icon) -- everything else was already living in the
     per-view's local static styles. */
  /* SPEC 17.116 + 17.119 + 17.120 + 17.142e -- full-cell warning
     glyph mounted by the shared renderWarningFill(reason, ariaLabel,
     slot?) atom (17.142e refresh adds the optional slot? arg so the
     fallback can stamp itself directly as a <card-body> slot child
     without a wrapper). Three failure-mode origins emit this
     fallback: Computed* (renderWarningFill(value) local helper,
     strategy returned null / non-finite / empty children),
     PictureNode (<img> error event), URLNode (qrcode lib rejected
     the URL). The visual is a huge centred Lucide triangle-alert
     SVG glyph in a muted colour that fills the parent cell edge-
     to-edge. SPEC 17.116-followup retired the original dashed-
     border framing on operator feedback ("remove the dashed line of
     the warning"). */
  .warning-fill {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    color: var(--muted, currentColor);
    user-select: none;
  }
  /* SPEC 17.133 -- the U+26A0 warning glyph that used to ride a
     ::before pseudo on .warning-fill is now a ds-icon
     name=triangle-alert Lucide SVG child mounted by the shared
     renderWarningFill() atom. The cqmin-driven size that made the
     glyph fill the tile the same way the 17.24 PlusTile cross does
     is applied directly to the child icon width/height so the SVG
     keeps the pre-17.133 tile-fill proportions. */
  .warning-fill > ds-icon {
    width: clamp(2rem, 50cqmin, 12rem);
    height: clamp(2rem, 50cqmin, 12rem);
  }
  /* SPEC §17.116 — the inline ".sigma" chip retired in §17.116d once
     Computed* (§17.116c) and BSC computedMean (§17.116d) both moved
     the Σ glyph into the title-prefix [data-testid="computed-badge"]
     render. */

  /* SPEC 17.44 + 17.133 -- deadline-risk warning icon. The glyph is
     a <ds-icon name="triangle-alert"> Lucide SVG child mounted by
     each per-view that emits a .warning-icon span (BSC + Computed*
     AsChild + AsParent, on the off-track objective branch). inline-
     flex centring + the inline color style baked by the mapper from
     vm.objective.warningColor (17.44 yellow -> orange -> red
     severity ramp) drive the visual; the SVG inherits the wrapper
     colour via Lucide stroke=currentColor. Pre-17.142f the
     .target-row typography rule + the .target-icon / .trend-arrow
     glyph rules sat above this one as inputs to the 17.137 A2b
     layout; the 17.142 <card-body> migration moved those concerns
     into per-view CSS, but .warning-icon stayed shared because the
     warning glyph is identical across kinds. */
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
  /* SPEC §17.121i — the §17.121g strike-through + value-area dim
     are retired on operator feedback ("remove the striken style
     and keep opacity to 1; show the disabled state as a small
     pill at the left of the title instead"). The visual signal
     now lives in a real DOM element (the .disabled-indicator
     pill from disabledToggle.ts) prepended to the title row by
     each AsChild view, with the matching .disabled-switch (an
     interactive button role=switch) rendered at the same
     position by each AsParent view. Both share the warm-gold
     visual language with the §17.121f ACT status pill. */
`;
