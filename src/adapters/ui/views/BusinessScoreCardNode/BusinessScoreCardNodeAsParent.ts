/**
 * `<business-score-card-as-parent>` — large parent-strip rendering for
 * `BusinessScoreCardNode` (SPEC §5 — refined in §17.14, §17.18, §17.30,
 * §17.45).
 *
 * Layout (post-§17.45 — horizontal split when description is present):
 *   - Title (top, full-width row, `2.4vh` font-size — `3vh` row height
 *     comes from `tileLayoutStyles`).
 *   - Body row directly below the title — a flex **row** with two
 *     children:
 *       * `.metric-pane` (LEFT) — the metric's numeric content. Holds
 *         the value (with inline unit, optional `Σ` badge, optional
 *         trend arrow), the §17.40 target row (bullseye + target value
 *         + target date + §17.44 deadline-risk warning), and the
 *         bottom-right corner timestamp. **The metric-pane is the
 *         positioning context for the timestamp** (`position: relative`),
 *         so `.timestamp { bottom: 0.4rem; right: 0.6rem }` measures
 *         against the metric-pane's bottom-right corner. When no
 *         description sibling is present this matches the strip's
 *         bottom-right corner (the metric-pane fills the body); when
 *         a description sibling is present the timestamp lands at
 *         the boundary between the left and right halves — still at
 *         `0.4rem / 0.6rem` from the metric-pane's outer edge,
 *         matching a child tile's timestamp inset against its own
 *         outer edge.
 *       * `.description` (RIGHT, optional) — the metric's definition,
 *         italicised + muted, line-clamped so a long description
 *         cannot push past the panel height. Rendered only when
 *         `vm.description.trim()` is non-empty (§17.30 — the
 *         metric's definition is high-signal on the focused panel
 *         but would crowd a child tile, so it stays parent-role-only).
 *         Read-only here; the operator edits it through the §17.28
 *         edit modal (which already exposes the field).
 *   - When description is **absent**: `.metric-pane` fills 100 % of
 *     the body width and the §17.39 negative `margin-right` (cancelling
 *     the strip's right-side gutter for close-X / pencil) applies
 *     so the centered `.value` lands at the strip's full-width center
 *     — same as the drill-morph end-state, no jump at commit.
 *   - When description is **present**: `.metric-pane` is `flex: 0 0 50 %`
 *     and `.description` is `flex: 0 0 50 %`. The §17.39 negative
 *     margin is dropped — the centered value now sits at the
 *     metric-pane's center (the LEFT-half center of the strip), which
 *     is what the operator wants when the description occupies the
 *     right half of the focused panel. The buttons in the strip's
 *     gutter still float above; the description is line-clamped + the
 *     gutter padding still keeps the description body short of them.
 *
 * Entering animation (§17.45 — drill-into morph hand-off when promoting
 * a child node WITH a description to the parent role):
 *   - When the per-view receives a new `vm.id` (initial mount OR a
 *     focus swap), a `bodyEntering` flag is briefly held `true`. The
 *     `.body[data-entering="true"]` modifier forces `.metric-pane` to
 *     `flex-basis: 100 %` and `.description` to `flex-basis: 0 % ; opacity: 0`,
 *     matching the drill-morph end-state (the morphed tile fills the
 *     strip's full width with no description visible — descriptions
 *     are NOT rendered on child tiles per §17.30).
 *   - One frame later the flag flips to `false`; the CSS transition
 *     list on `.metric-pane` (`flex-basis 320 ms ease`) and on
 *     `.description` (`flex-basis + opacity 320 ms ease`) animates the
 *     metric-pane shrinking from 100 % → 50 % while the description
 *     fades in from the right. The 320 ms duration matches
 *     `DRILL_SETTLE_MS` so the post-commit re-flow lands on the same
 *     optical beat as the drill morph itself.
 *   - Reduced-motion contract: `prefers-reduced-motion: reduce` OR the
 *     testBridge `test-no-anim` sentinel on `<html>` (SPEC §14.4) holds
 *     `bodyEntering` at `false` from the start, so the post-commit
 *     layout lands at the final 50/50 split without a transition.
 *     Mirror of the `runDrillTransition` short-circuit in
 *     `drillTransitions.ts`.
 *
 * Timestamp colour follows the §17.42 fixed bright off-white →
 * dark-grey lerp by age in days (`dateAgeColor`); the per-board
 * fresh-colour the §17.21 / §17.31 design plumbed through
 * `--board-fresh` has been retired.
 *
 * Why the description is only on the parent role (not on child tiles):
 *   - On a child tile a multi-line description would compete with the
 *     big figure for the limited tile body. The §17.14 layout reserved
 *     the per-tile body for the timestamped value precisely because
 *     "title + figure + date" is the right at-a-glance signature for
 *     a tile in a wall of tiles.
 *   - On the focused panel, the user has zoomed in on a single node;
 *     the metric's definition ("Quarterly revenue across the EU-North
 *     region; sourced from the BI data warehouse.") is exactly the
 *     context they need to interpret the figure they came to see.
 */

import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { disabledToggleStyles, renderDisabledSwitch } from "../../molecules/disabledToggle.js";
import {
  INLINE_EDIT_TITLE_EVENT,
  INLINE_EDIT_VALUE_EVENT,
  type InlineEditTitleDetail,
  type InlineEditValueDetail,
} from "../../molecules/inlineEditEvents.js";
import {
  focusAndSelectInline,
  inlineEditKey,
} from "../../molecules/inlineEditHelpers.js";
import type { BusinessScoreCardNodeViewModel } from "../../molecules/NodeViewModel.js";
import { formatAge } from "../../atoms/ageFormat.js";
import { formatValue } from "../../atoms/numberFormat.js";
import { tileLayoutStyles } from "../../atoms/tileLayoutStyles.js";
import {
  InlineUnitEditController,
  type InlineUnitEditTarget,
  unitChipStyles,
  unitFromBscValue,
} from "../../molecules/unitChip.js";
import {
  renderTargetRow,
  renderTrendArrow,
  renderValueTemplate,
  timestampForValue,
} from "./valueTemplate.js";

@customElement("business-score-card-as-parent")
export class BusinessScoreCardNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: BusinessScoreCardNodeViewModel | null = null;

  /**
   * SPEC 17.28 -- inline edit lifecycle. `value` is only reachable for
   * `recordedValue` BSCs (the other branches are derived from children
   * and have no recorded value to mutate); `title` is always reachable.
   */
  @state()
  private editingField: "title" | "value" | null = null;

  /**
   * SPEC 17.45 -- drill-into morph hand-off. While `true`, the body row
   * renders with `.metric-pane` at `flex-basis: 100 %` and the optional
   * `.description` at `flex-basis: 0 %; opacity: 0` -- matches the
   * drill morph's end state (the morphed tile fills the strip's full
   * width with no description visible, since descriptions are
   * parent-role-only per §17.30). One frame after first paint the flag
   * flips to `false`, triggering the registered CSS transitions on
   * `flex-basis` + `opacity` so the metric-pane shrinks from 100 % to
   * 50 % while the description fades in from the right. Reduced-motion
   * (system-level OR `test-no-anim` sentinel) holds the flag at
   * `false` from the start so the layout lands at the final 50/50
   * split synchronously.
   */
  @state()
  private bodyEntering = false;

  /**
   * SPEC 17.51 -- handle of the active press-and-hold timer for the
   * inline value-edit \u2212 / + buttons. `null` while no press is
   * active. The timer chains itself via `setTimeout` (rather than
   * `setInterval`) so the cadence can switch from the initial
   * 200 ms to the post-1.5 s accelerated 50 ms without re-arming
   * a different interval; each tick re-schedules itself with the
   * cadence appropriate to the elapsed press time.
   */
  private valueStepTimerId: number | null = null;

  /** SPEC 17.51 -- press-start timestamp for the active value-step
   * gesture; used to switch from the 200 ms initial cadence to the
   * 50 ms accelerated cadence at the 1.5 s threshold. `null` outside
   * an active press. */
  private valueStepStart: number | null = null;

  /** SPEC 17.45 -- track previous vm id so a focus swap re-triggers the
   * entering animation (the per-view element is reused across BSC
   * focus changes — `firstUpdated` only fires on the very first mount,
   * so the `vm.id` swap is the durable trigger). */
  private previousVmId: string | null = null;

  /** SPEC §17.126 — inline unit-edit controller for the chip prefix. */
  private readonly unitEditor = new InlineUnitEditController(this);

  getInlineUnitEditTarget(): InlineUnitEditTarget | null {
    if (!this.vm) return null;
    return { nodeId: this.vm.id, unit: unitFromBscValue(this.vm.value) };
  }

  static styles = [
    tileLayoutStyles,
    disabledToggleStyles,
    unitChipStyles,
    css`
      /* SPEC 17.45 -- the per-view's host stacks title + body
         vertically. The body row holds the metric-pane (left) and the
         optional description (right). The shared tileLayoutStyles
         declares :host { position: relative; container-type: size }
         which we keep -- the metric-pane carries its own
         position: relative as the timestamp's containing block, so
         the per-view's own host context is no longer load-bearing for
         absolute children (the pre-§17.45 :host { position: static }
         override that piped the timestamp to the strip's wrapper is
         retired). The container-type: size is preserved for the
         value's cqmin clamp. */
      :host {
        display: flex;
        flex-direction: column;
      }
      .title {
        font-size: 2.4vh;
        flex: 0 0 auto;
        /* SPEC 17.42 -- the focused-panel title is bright off-white
           (rgb(245, 245, 245)) regardless of board. The per-board
           fresh-date colour the §17.21 / §17.31 design plumbed
           through --board-fresh has been retired; the kiosk's
           dark theme already gives the title enough emphasis with
           a flat near-white, and the per-board colour picker added
           a personalisation surface that nobody used. */
        color: rgb(245, 245, 245);
      }
      /* SPEC §17.116 -- Σ prefix in the title row when the value
         branch is "computedMean" (the pre-§17.116 inline ".sigma"
         chip next to the value moved into the title row). Sized at
         0.95em of the title's 2.4vh so it reads as a glyph attached
         to the title text; muted opacity keeps the operator's eye
         on the title text proper. Same rule shape as the §17.104
         Computed* cards' shared-styles block. */
      .computed-badge {
        font-weight: 700;
        opacity: 0.75;
        margin-right: 0.25em;
        font-size: 0.95em;
      }
      /* SPEC 17.45 -- horizontal flex row holding .metric-pane (left)
         and the optional .description (right). When there is no
         description sibling the metric-pane fills the full body
         width; when both children are present they share the body
         50 / 50. The CSS transitions on .metric-pane and .description
         (flex-basis + opacity) carry the post-commit layout shift
         smoothly when a child node WITH a description is promoted to
         the parent role -- see the entering-state modifier below. */
      .body {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        flex: 1 1 auto;
        min-height: 0;
        min-width: 0;
        width: 100%;
      }
      /* SPEC 17.45 -- the metric-pane carries the BSC's numeric
         content (value-area + corner timestamp). Default sizing
         is "fill the body" (flex-grow: 1) so it absorbs all
         available width when there is no description sibling.
         When the body has a description sibling the
         [data-has-description="true"] modifier overrides to
         flex: 0 0 50 %. position: relative makes the metric-pane
         the absolute-positioned timestamp's containing block, so
         the .timestamp { bottom: 0.4rem; right: 0.6rem }
         offsets (inherited from tileLayoutStyles) measure against
         the metric-pane's own bottom-right corner -- the same
         insets a child tile uses against its own bottom-right. */
      .metric-pane {
        position: relative;
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        flex-shrink: 1;
        flex-basis: 0;
        min-width: 0;
        min-height: 0;
        /* SPEC 17.45 -- transition the layout-driving properties so a
           drill-into morph that lands on a parent WITH a description
           reflows smoothly from "metric-pane fills body" (matching the
           morph end-state) to the final 50 / 50 split. The total
           320 ms duration matches DRILL_SETTLE_MS so the entering
           settle lands on the same optical beat as the drill morph
           itself.

           SPEC 17.48 -- the easing curve flipped from a plain
           ease (symmetric, slow start + slow end) to
           cubic-bezier(0.22, 1, 0.36, 1) (ease-out-quart -- fast at
           the start, gentle settle at the end). The metric-pane
           reaches ~80 % of its final 50 % width inside the first
           ~120 ms then settles softly over the remaining 200 ms;
           the operator reads this as "the panel snapping to its
           resting state" rather than the pre-17.48 mechanical
           ease-in-and-out. The margin-right transition is gone
           in 17.47 (the strip's right-side gutter is retired so
           there is nothing to escape any more). */
        transition: flex-basis 320ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .body[data-has-description="true"] .metric-pane {
        flex-grow: 0;
        flex-shrink: 0;
        flex-basis: 50%;
      }
      /* SPEC §17.47 -- pre-§17.47 the no-description body needed a
         negative margin-right to escape the strip's right-side
         gutter (clamp(3rem, ...) reserved for the close-X / pencil
         buttons; SPEC §17.39 -- escape via the gutter-width custom
         property the strip published). §17.47 retires the gutter
         entirely (the buttons are now clamp(1.5rem, 3vh, 2.25rem)
         and overlay the title row instead of dangling below it;
         the strip no longer reserves flow space for them), so the
         metric-pane fills the strip's full inner width by default
         and the centered value lands at the strip's full center
         without any escape gymnastics. The §17.39 / §17.45 contract
         -- "BSC value horizontally centered to its metric pane" --
         holds by virtue of the metric-pane being the strip's
         full-width content-area. */
      /* SPEC 17.45 -- the metric's definition. vh-relative so it
         matches the title's typographic scale; muted colour so the
         title remains the dominant element on the focused panel.
         line-clamp keeps a long description from pushing past the
         panel height. flex-basis: 50 % at rest; the entering-state
         modifier collapses it to 0 % + opacity 0 so the post-commit
         re-flow can fade it in from the right. The padding-left
         leaves a small gutter between the metric-pane and the
         description body.

         SPEC 17.48 -- three coupled tweaks make the entering reveal
         feel less mechanical:
           1. easing flips from a plain ease (symmetric) to
              cubic-bezier(0.22, 1, 0.36, 1) (ease-out-quart) for the
              layout-driving flex-basis + the transform glide -- fast
              at the start, gentle settle at the end.
           2. opacity is staggered with an 80 ms delay so the text
              only kicks in once the column has reached enough width
              that -webkit-line-clamp's re-fitting wobble is gone.
              The text therefore fades in over an almost-stable
              layout.
           3. a transform glide on the entering state gives the
              description a clear sense of direction -- it slides in
              from outside the host's right edge in row flex, or
              from outside the host's bottom edge in column flex
              (the 17.46 portrait container query block below).

         SPEC 17.49 -- operator's followup feedback on 17.48: the
         description still appeared abruptly. Two root causes:

           (a) Distance was a percentage of the description's OWN
               current width. translateX(8 %) of an element that is
               itself growing from 0-width via flex-basis collapses
               to 0 px at the start (8 % of 0 = 0) and to 0 px at
               the end (the entering modifier resets to 0 %). The
               peak visual offset across the whole animation was
               about 1 % of the host's width -- too small for the
               eye to read as a slide.

           (b) Both the slide and the fade ended on the same 320 ms
               beat as the layout settle. The reveal had no
               breathing room AFTER the layout was stable, so the
               text "popped" against the just-settled column.

         17.49 fixes both:

           (a) The slide distance switches to container-query length
               units -- translateX(50cqw) in row flex, translateY
               (50cqh) in column flex. cqw / cqh resolve against the
               per-view's host (container-type: size from
               tileLayoutStyles), independent of the description's
               own animating width. 50cqw = half the host's width =
               the description's final width, so at the start the
               description sits visually a full description-width
               beyond the host's right edge (clipped by the host's
               overflow: hidden) and slides leftward into place as
               transform interpolates back to 0. translateY(50cqh)
               does the same on the vertical axis for column flex.

           (b) The slide and fade durations decouple from the layout
               beat: transform 560 ms cubic-bezier(0.22, 1, 0.36, 1)
               (a 240 ms tail past the layout settle so the slide
               finishes over an entirely stable layout) and opacity
               480 ms ease-out 80 ms (also extending past the 320 ms
               beat). flex-basis still runs at 320 ms = DRILL_SETTLE
               _MS so the layout itself still lands synchronously
               with the drill morph -- the §17.45 contract holds.
               The composite reveal now feels progressive: layout
               settles first, then the description slides + fades
               in over the trailing ~240 ms. */
      .description {
        margin: 0;
        padding-left: 0.6rem;
        font-size: 1.5vh;
        line-height: 1.35;
        color: color-mix(in srgb, currentColor 65%, transparent);
        font-style: italic;
        white-space: pre-line;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 8;
        -webkit-box-orient: vertical;
        flex-grow: 0;
        flex-shrink: 0;
        flex-basis: 50%;
        opacity: 1;
        transform: translate(0, 0);
        transition:
          flex-basis 320ms cubic-bezier(0.22, 1, 0.36, 1),
          transform 560ms cubic-bezier(0.22, 1, 0.36, 1),
          opacity 480ms ease-out 80ms;
      }
      /* SPEC 17.45 -- entering state. Holds the body at the morph's
         end-state (metric-pane full-width, description hidden) so
         that the one-frame-later flip to entering=false triggers
         the CSS transitions defined above and resolves smoothly to
         the final 50 / 50 layout. */
      .body[data-entering="true"] .metric-pane {
        flex-basis: 100%;
        flex-grow: 1;
        flex-shrink: 0;
      }
      .body[data-entering="true"] .description {
        flex-basis: 0%;
        opacity: 0;
        /* SPEC 17.48 / 17.49 -- slide in from outside the host's
           right edge. 50cqw = half the per-view's host width
           (container-type: size on :host from tileLayoutStyles) =
           the description's own final width, so the entering state
           visually places the description fully beyond the host's
           right edge (where it is clipped by the host's
           overflow: hidden). cqw is independent of the
           description's animating own-width, unlike the §17.48
           translateX(8 %) which collapsed to ~0 px peak offset
           because % resolves against the element's own width and
           that width was itself transitioning from 0. translateY
           (50cqh) swap for column flex lives in the 17.46
           portrait container query block below. */
        transform: translateX(50cqw);
      }
      /* SPEC §17.46 -- when the per-view's host is taller than wide
         (i.e. the parent strip rendered as the LEFT 25 % rail in
         landscape -- see TreeMapScreen's data-orientation=
         "landscape" rule on .layout), switch the body to
         flex-direction: column and let the same flex-basis
         transitions carry the entering animation along the new
         main axis. The shared tileLayoutStyles :host rule sets
         container-type: size so the per-view is a size container,
         and the at-rule below (omitted from this comment) matches
         when the host height > width -- exactly the case we want
         to flip on. The metric-pane lands on the TOP 50 % and the
         description on the BOTTOM 50 %; the description's left
         padding (which separates it from the metric-pane in row
         flex) flips to a top padding so it separates from the
         metric-pane along the new main axis.

         Why a container query and not a media query: the parent
         strip's per-view geometry depends on the layout's grid
         template (which depends on the host's orientation), but
         a future composition might re-shape the strip
         independently (e.g. a side-by-side dual-board mode);
         keying the body's direction to the per-view's OWN aspect
         ratio keeps the rule self-contained. */
      @container (orientation: portrait) {
        .body {
          flex-direction: column;
        }
        .description {
          padding-left: 0;
          padding-top: 0.4rem;
        }
        /* SPEC 17.48 / 17.49 -- the slide-in cue flips from
           horizontal (translateX(50cqw) -- "from outside the right
           edge") to vertical (translateY(50cqh) -- "from outside
           the bottom edge") to track the new main axis. 50cqh =
           half the per-view's host height = the description's
           final height in column flex (the body's metric-pane on
           top 50 %, description on bottom 50 % per §17.46), so the
           entering state visually places the description fully
           beyond the host's bottom edge. Same overflow: hidden
           clipping mechanism as the row-flex translateX above.
           Keeps the reveal directionally consistent with the
           layout's top-half-metric / bottom-half-description
           split. */
        .body[data-entering="true"] .description {
          transform: translateY(50cqh);
        }
      }
      .value-area {
        /* Override the shared height:calc(100% - 3vh) -- with the
           flex column on the metric-pane, value-area fills whatever
           vertical space the metric-pane has. */
        height: auto;
        flex: 1 1 auto;
        min-height: 0;
      }
      .title.is-editable,
      .value.is-editable {
        cursor: text;
      }
      .title-edit,
      .value-edit {
        box-sizing: border-box;
        background: color-mix(in srgb, currentColor 6%, transparent);
        color: inherit;
        border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
        border-radius: 4px;
        padding: 0.25rem 0.4rem;
        font: inherit;
      }
      .title-edit:focus,
      .value-edit:focus {
        outline: none;
        border-color: color-mix(in srgb, currentColor 65%, transparent);
        background: color-mix(in srgb, currentColor 12%, transparent);
      }
      .title-edit {
        width: 100%;
        font-size: inherit;
        font-weight: inherit;
      }
      /* SPEC 17.37 -- the inline title-edit fits exactly within the
         3vh title row (no vertical overflow). Pre-17.37 the input
         inherited the value-edit's 0.25rem top + 0.25rem bottom
         padding, which combined with the 2.4vh font-size and the
         1px border made the input ~5-6px taller than the title
         row, visibly bulging into the value area whenever the
         operator clicked the title to edit. Post-17.37 the input
         occupies the full title-row height (height: 100%) with
         no vertical padding and a line-height of 1, so it sits
         flush with where the static title sat -- entering edit
         mode no longer shifts the focused panel's layout
         downward. min-width: 0 + max-width defeat the input's
         intrinsic min-content so a narrow title row still
         constrains the input to the row width and the input never
         extends past the strip (and therefore never past the
         viewport).

         SPEC 17.50 -- the inline title-edit must NOT run behind the
         §17.47 close-X / edit-pencil buttons that overlay the title
         row's right end. The static title text gets clipped by
         text-overflow: ellipsis (so the visual hint of "title is
         long, the buttons are still tappable" reads cleanly), but
         an INTERACTIVE input has to keep the operator's typed text
         visible -- letting it run behind the buttons would hide the
         right end of what they are editing. The strip publishes
         --strip-gutter-right (one OR two button widths, see
         ParentIdentityStrip) and we subtract it from max-width.
         At root focus (no close-X) the var resolves to one button
         width; with both buttons it resolves to two widths plus
         the inter-button gap; the fallback 0px keeps unit fixtures
         that mount the per-view OUTSIDE the strip rendering at the
         row's full width. */
      .title-edit {
        height: 100%;
        padding: 0 0.4rem;
        line-height: 1;
        min-width: 0;
        max-width: calc(100% - var(--strip-gutter-right, 0px));
      }
      /* SPEC 17.50 -- the inline value-edit input fits the metric-
         pane (plus its inner padding) instead of inheriting the
         display value's giant clamp(1.5rem, 42cqmin, 22rem)
         font-size from §17.46 (which made the input's intrinsic
         min-content width balloon -- a number input at e.g. a
         150-px font-size has a min-content width well past the
         metric-pane on a typical kiosk strip, so width: 100% +
         max-width: 60% from the pre-§17.50 rule could not
         constrain it).
         The editor renders inside a .value-edit-wrapper which is
         a block-level flex container at 100 % of the metric-pane's
         width (the wrapper escapes the inline span.value the
         static template uses; see render() below). The wrapper
         resets font-size to a sensible vh-relative size so the
         input's intrinsic min-content stays small, and the input
         itself is constrained to the wrapper's width with
         max-width: 100 % + min-width: 0 so it always fits, even
         on a half-width metric-pane (description present, row
         flex). The unit sits beside the input at the value
         template's 1/3 ratio to keep the editing-mode layout
         visually consistent with the static one. */
      .value-edit-wrapper {
        display: flex;
        /* SPEC 17.51 -- align-items shifts from baseline (the
           pre-stepper rule) to center so the circular stepper
           buttons (border-radius 50 % per the §17.52-polish
           shape revision) sit visually centered next to the input
           and unit. The unit's vertical position barely shifts
           (the wrapper's font-size still drives both the input
           and the calc(1em / 3) unit), and aligning on the
           input's baseline would have the buttons hanging
           awkwardly low because their hit-target box is taller
           than the digits in the input. */
        align-items: center;
        justify-content: center;
        gap: 0.3em;
        align-self: stretch;
        width: 100%;
        min-width: 0;
        font-size: clamp(1.5rem, 5vh, 4rem);
        font-weight: 700;
        line-height: 1.2;
      }
      .value-edit {
        font: inherit;
        text-align: center;
        flex: 0 1 auto;
        width: auto;
        min-width: 0;
        max-width: 100%;
      }
      /* SPEC 17.51 -- hide the native browser spinner on the inline
         value-edit. Browser default \"spin buttons\" inside the right
         edge of <input type=\"number\"> are tiny (~12 px wide on
         Chromium, ~16 px on Firefox, hidden entirely on most mobile
         browsers) and visually mismatch the giant kiosk-class
         editing surface. WebKit / Blink expose them as ::-webkit-
         inner-spin-button + ::-webkit-outer-spin-button pseudo-
         elements; Firefox uses appearance: textfield to suppress
         them. Both rules together cover every kiosk target. The
         operator now reaches the same step-up / step-down through
         the new \u2212 / + buttons we render alongside the input. */
      .value-edit::-webkit-inner-spin-button,
      .value-edit::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .value-edit {
        -moz-appearance: textfield;
        appearance: textfield;
      }
      /* SPEC §17.116 -- the pre-§17.116 inline ".value-edit-wrapper
         .unit" rule sized a unit chip flanking the number input
         inside the editing wrapper. §17.116 retires inline units in
         favour of a ".unit-below" block sibling under the entire
         value-area, so the editing wrapper no longer carries a unit
         child. The rule is intentionally removed (vs. left as dead
         CSS) so Sonar's unused-selector check stays clean. */
      /* SPEC 17.51 -- inline value-edit \u2212 / + stepper buttons.
         Operator request: \"the buttons to increase/decrease value
         of a field should be bigger\". The native browser spinners
         are tiny (~12 px) and hidden on mobile; we render two
         flanking custom buttons sized at clamp(1.5rem, 4vh, 2.5rem)
         square so the touch target stays \u2265 24 px on the smallest
         kiosk viewport and grows naturally with vh on taller
         viewports. The button's box is capped at 2.5rem to
         prevent typographic blow-out at huge vh values.
         Press-and-hold contract (handled in JS, not CSS):
           - tap (pointer down + up < 200 ms) = step once;
           - hold 200 ms\u20131.5 s = repeat at 200 ms cadence;
           - hold > 1.5 s = accelerate to 50 ms cadence.
         The 200 ms initial delay matches the standard mobile
         press-and-hold convention, and the 50 ms ceiling lets the
         operator drive a value from 1 to 100 in ~5 s of held
         press without lifting the finger.
         SPEC 17.52-polish -- the buttons are CIRCLES (border-radius
         50 %), not rounded squares. Operator follow-up: *\"the +
         and \u2212 button when we edit the value of a parent node
         should be circles\"*. The width/height clamp already
         keeps the box square (same value on both axes), so a 50 %
         radius reads as a perfect circle at every viewport size;
         on a desktop viewport with vh \u2248 800 px the box settles
         around 32 px diameter, which is the canonical Material
         floating-action-button size and reads as a recognisably
         tappable disc.
         SPEC 17.52-polish-2 -- the visible \u2212 / + glyph is drawn
         via CSS pseudo-elements (::before for the horizontal bar,
         shared between both buttons; ::after for the vertical bar,
         only on the plus modifier) rather than as inline text.
         Operator follow-up: *\"the \u2212 and + symbol in the
         buttons to edit the numeral value of a parent node are
         not vertically aligned with their circle, fix that\"*.
         Pre-§17.52-polish-2 the button rendered the \u2212 / +
         character as inline text and relied on inline-flex's
         align-items: center to center the line box, but a system
         font's line box has asymmetric ascender / descender space
         (ascender ~70 % cap-height, descender ~25 %) so the
         glyph's MATH AXIS sat about 0.05 em ABOVE the line-box
         center -- enough off-center to read as a misalignment on
         the kiosk. The pseudo-element approach (mirror of the
         §17.47 close-X / edit-pencil bars: top: 50 %; left: 50 %;
         transform: translate(-50 %, -50 %)) bypasses font metrics
         entirely so the bars sit at the exact geometric centre
         of the circle. Bars use percentage widths / heights of
         the button so they scale proportionally with the
         clamp-resolved button size -- on a 32 px button the
         horizontal bar is 16 \u00d7 2 px, on a 24 px button it's
         12 \u00d7 2 px, etc. */
      .value-stepper {
        flex: 0 0 auto;
        display: inline-block;
        position: relative;
        width: clamp(1.5rem, 4vh, 2.5rem);
        height: clamp(1.5rem, 4vh, 2.5rem);
        padding: 0;
        margin: 0;
        background: color-mix(in srgb, currentColor 6%, transparent);
        color: inherit;
        border: 1px solid
          color-mix(in srgb, currentColor 35%, transparent);
        border-radius: 50%;
        cursor: pointer;
        font-size: 0;
        line-height: 0;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
      }
      .value-stepper:hover,
      .value-stepper:focus-visible {
        outline: none;
        background: color-mix(in srgb, currentColor 16%, transparent);
        border-color: color-mix(in srgb, currentColor 55%, transparent);
      }
      .value-stepper:active {
        background: color-mix(in srgb, currentColor 24%, transparent);
      }
      /* SPEC 17.52-polish-2 -- horizontal bar (shared) + vertical
         bar (plus only). Drawn via the same top: 50 % / left: 50 %
         + translate(-50 %, -50 %) trick the §17.47 close-X uses,
         so the bars sit at the geometric centre of the button
         regardless of font metrics. */
      .value-stepper::before {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        width: 45%;
        height: 2px;
        background: currentColor;
        border-radius: 1px;
        transform: translate(-50%, -50%);
      }
      .value-stepper--plus::after {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        width: 2px;
        height: 45%;
        background: currentColor;
        border-radius: 1px;
        transform: translate(-50%, -50%);
      }
    `,
  ];

  /**
   * SPEC 17.45 -- detect a `vm.id` change and arm the entering
   * animation. Runs *before* render() so the freshly-armed
   * `bodyEntering = true` is included in this update cycle's render
   * output (the body lands at metric-pane: 100 %, description: 0 %
   * matching the drill morph's end-state). The `updated()` follow-up
   * schedules the rAF flip to false so the CSS transitions resolve
   * the body to its final 50 / 50 layout one frame later.
   */
  override willUpdate(changed: PropertyValues): void {
    if (changed.has("vm")) {
      const newId = this.vm?.id ?? null;
      // §17.45 -- arm the entering animation on every vm.id swap
      // EXCEPT the very first paint. The animation's job is to bridge
      // a drill-into morph's end-state (metric-pane fills body, no
      // description visible) to the final 50 / 50 split; on initial
      // mount there is no morph hand-off to bridge -- the strip just
      // renders fresh -- so firing the animation only swaps in the
      // morph end-state out of nowhere and animates from there for
      // 320 ms with no upstream cause. (§17.46 added a column-flex
      // body in landscape; with the entering animation reaching into
      // the height axis on initial paint, an e2e measurement that
      // snapshots in mid-transition reads a non-final metric-pane
      // height -- the §17.30 / §17.45 timestamp-parity scenario in
      // particular. Skipping initial mount keeps the contract.)
      if (newId !== null && this.previousVmId !== null && newId !== this.previousVmId) {
        // §17.45 reduced-motion contract: matches `runDrillTransition`'s
        // short-circuit (system-level prefers-reduced-motion OR the
        // testBridge `test-no-anim` sentinel on <html>). When motion is
        // dismissed we keep `bodyEntering = false` so the body lands
        // directly at the final 50 / 50 split with no transition.
        this.bodyEntering = !this.shouldReduceMotion();
      }
      this.previousVmId = newId;
    }
  }

  override updated(): void {
    if (this.editingField === "title") {
      const input = this.shadowRoot?.querySelector<HTMLInputElement>(
        "input.title-edit",
      );
      focusAndSelectInline(input ?? null);
    } else if (this.editingField === "value") {
      const input = this.shadowRoot?.querySelector<HTMLInputElement>(
        "input.value-edit",
      );
      focusAndSelectInline(input ?? null);
    }
    if (this.bodyEntering) {
      // Two rAFs: the first lets the browser commit the entering
      // initial state (metric-pane: 100 %, description: 0 %); the
      // second flips the flag so the CSS transitions on flex-basis
      // + opacity resolve to the final 50 / 50 layout. Without the
      // double rAF the browser may coalesce both states into the
      // same frame and the transitions collapse to an instantaneous
      // jump (mirror of the synchronous reflow in
      // `runDrillTransition`).
      const win = this.ownerDocument?.defaultView ?? null;
      if (win) {
        win.requestAnimationFrame(() => {
          win.requestAnimationFrame(() => {
            this.bodyEntering = false;
          });
        });
      } else {
        this.bodyEntering = false;
      }
    }
  }

  /**
   * SPEC 17.51 -- defensive cleanup of the press-and-hold step timer.
   * If the component is torn down mid-press (operator navigates away
   * while their finger is on a stepper button, the focused parent
   * is replaced because the route changed, etc.) the chained
   * setTimeout would otherwise keep firing `applyValueStep` against
   * a detached input -- the call would silently no-op (the
   * `shadowRoot.querySelector` returns `null`), but the timer
   * itself would leak until the closure was GC'd. Cleaning up here
   * keeps the lifecycle tidy.
   */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.valueStepTimerId !== null) {
      window.clearTimeout(this.valueStepTimerId);
      this.valueStepTimerId = null;
    }
    this.valueStepStart = null;
  }

  /**
   * SPEC 17.45 -- mirrors `runDrillTransition`'s reduced-motion gate.
   * Reads the `test-no-anim` sentinel first so a Vitest dismiss takes
   * precedence over the system-level `prefers-reduced-motion: reduce`
   * answer. The literal class name is replicated locally (not
   * imported from `testBridge.ts`) to keep the per-view out of the
   * production main chunk's tree-shaken bridge. */
  private shouldReduceMotion(): boolean {
    if (typeof window === "undefined") return true;
    const html = window.document?.documentElement;
    if (html?.classList.contains("test-no-anim")) {
      return true;
    }
    return (
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    );
  }

  render() {
    if (!this.vm) {
      return html``;
    }
    const dateIso = timestampForValue(this.vm);
    const dateColor = this.vm.dateColor;
    const description = this.vm.description.trim();
    const hasDescription = description.length > 0;
    return html`
      ${this.renderTitle()}
      <div class="subtitle" data-testid="subtitle"></div>
      <div
        class="body"
        data-has-description=${hasDescription ? "true" : "false"}
        data-entering=${this.bodyEntering ? "true" : "false"}
      >
        <div class="metric-pane" data-testid="metric-pane">
          ${dateIso && this.editingField !== "value"
            ? html`<time
                class="timestamp"
                data-testid="value-date"
                datetime=${dateIso}
                style=${dateColor ? `--age-color: ${dateColor}` : ""}
                >${formatAge(dateIso)}</time
              >`
            : nothing}
          <div class="value-area" data-testid="value-row">
            <div class="value-row">
              ${this.renderValue()}
              ${this.editingField !== "value"
                ? renderTrendArrow(this.vm)
                : nothing}
            </div>
            ${this.editingField !== "value"
              ? renderTargetRow(this.vm)
              : nothing}
          </div>
        </div>
        ${hasDescription
          ? html`<aside class="description" data-testid="description">
              ${this.vm.description}
            </aside>`
          : nothing}
      </div>
    `;
  }

  /** SPEC 17.28 -- title row, click-to-edit affordance.
      SPEC §17.116 -- Σ prefix in front of the title when the value
      branch is `computedMean` (the pre-§17.116 `.sigma` chip next to
      the value moved into the title row; aggregated tiles announce
      their derived nature on the title rather than competing with
      the value glyph for horizontal space). */
  private renderTitle() {
    if (!this.vm) return nothing;
    const showBadge = this.vm.value.kind === "computedMean";
    if (this.editingField === "title") {
      return html`<h1
        class="title"
        data-testid="title"
        data-view-kind="BusinessScoreCardNode"
        data-id=${this.vm.id}
      >
        <input
          class="title-edit"
          data-testid="title-edit"
          type="text"
          maxlength="120"
          .value=${this.vm.title}
          @keydown=${(e: KeyboardEvent) => this.handleTitleKey(e)}
          @blur=${(e: FocusEvent) => this.commitTitle(e.target as HTMLInputElement)}
        />
      </h1>`;
    }
    return html`<h1
      class="title is-editable"
      data-testid="title"
      data-view-kind="BusinessScoreCardNode"
      data-id=${this.vm.id}
      role="button"
      tabindex="0"
      title="Click to edit title"
      @click=${this.startTitleEdit}
    >${renderDisabledSwitch(this, this.vm.id, this.vm.disabled ?? false)}${showBadge
      ? html`<span class="computed-badge" data-testid="computed-badge" aria-label="Computed value">Σ</span>`
      : nothing}${this.unitEditor.renderChip()}${this.vm.title}</h1>`;
  }

  /**
   * SPEC 17.28 -- value content. The `recordedValue` branch is the
   * only one editable inline (the other branches derive from children).
   * For `recordedValue`, the value `<span>` becomes a click-to-edit
   * affordance; the input swap preserves the unit (still rendered as
   * a sibling) so the operator only changes the number.
   */
  private renderValue() {
    if (!this.vm) return nothing;
    const v = this.vm.value;
    // SPEC 17.40 -- the gradient colour is applied via the shared
    // --bsc-value-color custom property; mirrors the inline style
    // valueTemplate.ts uses on its own .value span. Empty `colorStyle`
    // (degenerate / non-numeric branch) leaves the attribute blank
    // so the .value falls back to currentColor.
    const colorStyle = this.vm.objective.valueColor
      ? `--bsc-value-color: ${this.vm.objective.valueColor}`
      : "";
    if (this.editingField === "value" && v.kind === "recordedValue") {
      // SPEC §17.50 -- block-level wrapper instead of an inline
      // `<span class="value">`. The wrapper inherits the static
      // value's `data-testid` / `data-value-kind` so unit + e2e
      // selectors keep working; the layout escape (display: flex,
      // align-self: stretch, sane editor font-size) lives in the
      // `.value-edit-wrapper` rule above.
      // SPEC §17.51 -- two custom \u2212 / + buttons flank the input.
      // The buttons swallow `mousedown` (preventDefault) so the
      // input keeps focus while the operator presses-and-holds them
      // (without the swallow the browser would shift focus to the
      // button on every press, which fires the input's `blur`
      // handler and would commit-and-reopen on every step). The
      // pointer lifecycle is wired through a single helper to keep
      // the press-and-hold cadence (200 ms initial \u2192 50 ms
      // accelerated past 1.5 s) in one place.
      return html`<div
        class="value-edit-wrapper"
        data-testid="value"
        data-value-kind="recordedValue"
      >
        <button
          class="value-stepper value-stepper--minus"
          data-testid="value-step-down"
          type="button"
          aria-label="Decrement value"
          title="Decrement value"
          @mousedown=${(e: MouseEvent) => e.preventDefault()}
          @pointerdown=${(e: PointerEvent) => this.startValueStep(e, -1)}
          @pointerup=${this.stopValueStep}
          @pointercancel=${this.stopValueStep}
          @pointerleave=${this.stopValueStep}
        ></button>
        <input
          class="value-edit"
          data-testid="value-edit"
          type="number"
          step="any"
          .value=${String(v.value)}
          @keydown=${(e: KeyboardEvent) => this.handleValueKey(e)}
          @blur=${(e: FocusEvent) =>
            this.commitValue(e.target as HTMLInputElement)}
        />
        <button
          class="value-stepper value-stepper--plus"
          data-testid="value-step-up"
          type="button"
          aria-label="Increment value"
          title="Increment value"
          @mousedown=${(e: MouseEvent) => e.preventDefault()}
          @pointerdown=${(e: PointerEvent) => this.startValueStep(e, 1)}
          @pointerup=${this.stopValueStep}
          @pointercancel=${this.stopValueStep}
          @pointerleave=${this.stopValueStep}
        ></button>
      </div>`;
    }
    if (v.kind === "recordedValue") {
      return html`<span
        class="value is-editable"
        data-testid="value"
        data-value-kind="recordedValue"
        role="button"
        tabindex="0"
        title="Click to edit value"
        style=${colorStyle}
        @click=${this.startValueEdit}
        >${formatValue(v.value)}</span
      >`;
    }
    return renderValueTemplate(this.vm);
  }

  private startTitleEdit = (): void => {
    if (!this.vm) return;
    this.editingField = "title";
  };

  private startValueEdit = (): void => {
    if (!this.vm) return;
    if (this.vm.value.kind !== "recordedValue") return;
    this.editingField = "value";
  };

  private handleTitleKey(e: KeyboardEvent): void {
    const intent = inlineEditKey(e, /* multiline */ false);
    if (intent === "commit") {
      e.preventDefault();
      this.commitTitle(e.currentTarget as HTMLInputElement);
    } else if (intent === "cancel") {
      e.preventDefault();
      this.editingField = null;
    }
  }

  private handleValueKey(e: KeyboardEvent): void {
    const intent = inlineEditKey(e, /* multiline */ false);
    if (intent === "commit") {
      e.preventDefault();
      this.commitValue(e.currentTarget as HTMLInputElement);
    } else if (intent === "cancel") {
      e.preventDefault();
      this.editingField = null;
    }
  }

  /**
   * SPEC 17.51 -- start a press-and-hold step on the inline value-
   * edit. Fires one immediate step (so a quick tap still steps once),
   * then schedules a chained timer that switches cadence from
   * 200 ms (the initial 0 -- 1.5 s window) to 50 ms (the
   * accelerated > 1.5 s window) automatically. Captures the
   * pointer on the button so a finger-drift mid-press doesn't
   * lose the gesture (`pointerleave` would otherwise fire and
   * stop the timer).
   *
   * `direction` is +1 for the increment button and -1 for the
   * decrement button; the helper looks up the input's current
   * value, applies `current + direction` (the §17.51 step-of-1
   * decision -- see SPEC §17.51 for the alternative adaptive
   * stepping rejected at design-time), and writes the new value
   * back to the input. The change does NOT commit through
   * `commitValue` -- commit happens on Enter / blur the same as
   * a manually typed value, so the operator can step a few
   * times then either Enter or Escape.
   */
  private startValueStep(e: PointerEvent, direction: -1 | 1): void {
    e.preventDefault();
    const target = e.currentTarget as HTMLButtonElement;
    if (typeof target.setPointerCapture === "function") {
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // Some test environments (jsdom) don't implement
        // setPointerCapture; ignore -- the gesture still works
        // through pointerup / pointercancel without capture.
      }
    }
    this.applyValueStep(direction);
    this.valueStepStart = performance.now();
    const tick = (): void => {
      if (this.valueStepStart === null) {
        return;
      }
      this.applyValueStep(direction);
      const elapsed = performance.now() - this.valueStepStart;
      // Past the 1.5 s threshold the cadence accelerates from
      // the standard mobile press-and-hold 200 ms to a brisk
      // 50 ms so the operator can drive a value through a wide
      // range without lifting their finger.
      const cadence = elapsed > 1500 ? 50 : 200;
      this.valueStepTimerId = window.setTimeout(tick, cadence);
    };
    // Initial 200 ms wait before the first repeat (mirrors the
    // OS-level keyboard-repeat delay so a quick tap reads as
    // "step once" and not "step twice").
    this.valueStepTimerId = window.setTimeout(tick, 200);
  }

  private stopValueStep = (): void => {
    if (this.valueStepTimerId !== null) {
      window.clearTimeout(this.valueStepTimerId);
      this.valueStepTimerId = null;
    }
    this.valueStepStart = null;
  };

  /**
   * SPEC 17.51 -- apply a single \u00b11 step to the inline value-edit
   * input's value. Exposed (private but well-named) so the
   * press-and-hold tick + the initial-tap path share one code
   * point; the alternative would have been duplicating the
   * `Number(input.value) + direction` arithmetic.
   *
   * Numeric edge cases:
   *   - empty input \u2192 seeds at "0" before stepping (so the first
   *     tap produces "1" / "-1" instead of "NaN");
   *   - non-numeric input \u2192 same fallback (the seed-from-history
   *     path always writes a number, but a paste of "abc" into the
   *     input would otherwise stick).
   *
   * The step is fixed at 1 by §17.51 design choice. A future
   * adaptive stepping (10 % of current rounded to power-of-10) is
   * pinned in the SPEC §17.51 narrative as a deliberate non-goal
   * so a follow-up that re-introduces it has a single place to
   * land the rationale change.
   */
  private applyValueStep(direction: -1 | 1): void {
    const input = this.shadowRoot?.querySelector<HTMLInputElement>(
      "input.value-edit",
    );
    if (!input) return;
    const raw = input.value.trim();
    const current =
      raw === "" || Number.isNaN(Number(raw)) ? 0 : Number(raw);
    const next = current + direction;
    // Round to 4 decimal places so a long press past 1.5 s doesn't
    // accumulate the float-arithmetic crud that would otherwise
    // surface as e.g. "0.30000000000000004" after going down then
    // back up across a fractional starting value. Step is always 1
    // so the round is a guard, not a primary contract.
    const rounded = Math.round(next * 10000) / 10000;
    input.value = String(rounded);
    // Refocus the input so the operator's next Enter / Escape
    // commits / cancels via the existing keyboard handler. Without
    // this the button retains focus and Enter would re-fire the
    // button's click handler (= one more step).
    input.focus({ preventScroll: true });
  }

  private commitTitle(input: HTMLInputElement | null): void {
    if (this.editingField !== "title") return;
    if (!this.vm || !input) {
      this.editingField = null;
      return;
    }
    const next = input.value.trim();
    this.editingField = null;
    if (next.length === 0 || next === this.vm.title) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<InlineEditTitleDetail>(INLINE_EDIT_TITLE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { nodeId: this.vm.id, title: next },
      }),
    );
  }

  private commitValue(input: HTMLInputElement | null): void {
    if (this.editingField !== "value") return;
    if (!this.vm || !input) {
      this.editingField = null;
      return;
    }
    const v = this.vm.value;
    if (v.kind !== "recordedValue") {
      this.editingField = null;
      return;
    }
    const raw = input.value.trim();
    const parsed = Number(raw);
    this.editingField = null;
    if (raw.length === 0 || Number.isNaN(parsed) || parsed === v.value) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<InlineEditValueDetail>(INLINE_EDIT_VALUE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { nodeId: this.vm.id, value: parsed },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "business-score-card-as-parent": BusinessScoreCardNodeAsParent;
  }
}
