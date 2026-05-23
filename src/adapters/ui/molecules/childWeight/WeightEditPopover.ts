/**
 * `<weight-edit-popover>` -- the §17.52 anchored slider popover for
 * inline child-tile weight editing.
 *
 * Lifecycle.
 *
 *   1. `<tree-map-screen>` listens for `weight-edit-open`
 *      (dispatched by `<weight-edit-button>` on tap, OR by
 *      `<children-grid>`'s long-press handler on a tile pointer-down
 *      held > 500 ms). The handler stores the detail in a
 *      `@state` slot and renders this popover with `?open=true`,
 *      passing `nodeId`, `weight`, and `anchorRect`.
 *
 *   2. The popover renders a fixed-position panel anchored to
 *      `anchorRect` -- preferred placement is below the tile;
 *      `auto-flip` switches to above when the rect's bottom is
 *      within 16 px of the viewport bottom. Horizontal centering
 *      against the rect is clamped into the viewport so the panel
 *      never clips off-screen on the left or right (a 1/12 tile in
 *      the bottom-right corner of a portrait kiosk is the failing
 *      case for naive centering).
 *
 *   3. The operator drags the `<input type="range">`. The native
 *      `input` event fires continuously during drag and updates the
 *      live numeric label; the native `change` event fires once on
 *      thumb release and dispatches `inline-edit-weight` (then
 *      closes the popover). The two-event distinction is the
 *      §17.52 commit-on-release contract -- the treemap layout
 *      reflows once per gesture, not on every slider tick.
 *
 *   4. Tap outside the panel (the screen-level `pointerdown`
 *      capture handler) OR press Escape -> close without commit
 *      (no event dispatched, no domain change). The shell's
 *      `weight-edit-close` handler clears the `@state` slot.
 *
 * Why a fixed-position popover and not an in-tile overlay. The
 * children grid carries `:host { overflow: hidden }` (so a tile that
 * accidentally outgrows its rect doesn't bleed across siblings), and
 * a tile in the bottom row of the grid would clip the popover at the
 * grid's bottom edge. `position: fixed` against the viewport
 * bypasses every ancestor's `overflow` and `transform` clipping.
 *
 * Why `<input type="range">` and not a custom slider. Native range
 * inputs on the kiosk's Chromium engine deliver: thumb hit-target
 * sizing through `::-webkit-slider-thumb` (we boost it to a
 * comfortable touch target via the rule below); arrow-key support
 * for free; native `input` / `change` event semantics that map
 * exactly to "live label" / "commit" -- we'd reimplement all three
 * if we drew our own.
 */

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import {
  INLINE_EDIT_WEIGHT_EVENT,
  type InlineEditWeightDetail,
} from "./weightEditEvents.js";

/** Min weight (mirrors `domain/values/Weight.ts` MIN_WEIGHT). */
const MIN_WEIGHT = 0.5;

/** Max weight (mirrors `domain/values/Weight.ts` MAX_WEIGHT). */
const MAX_WEIGHT = 10;

/** Slider step (matches `<edit-node-modal>`'s `field-weight` slider). */
const WEIGHT_STEP = 0.5;

/** Distance in px from the viewport edge below which the popover
 * flips its placement. Tuned so the panel's top / bottom edge
 * doesn't kiss the viewport border on the smallest kiosk. */
const VIEWPORT_EDGE_PADDING_PX = 16;

/**
 * SPEC §17.52-polish — the popover sits IN the child tile, anchored
 * just to the right of the weight-edit icon (operator request:
 * *"appear at the right of the weight icon (not overlapping it)"*),
 * with its `max-width` capped so the panel's right edge stays
 * inside the tile (*"shouldn't exceed the tile width"*). The
 * insets below describe (a) the gap between the icon's right edge
 * and the panel's left edge so the two visually breathe rather
 * than touching, (b) the bottom inset matching the icon's own
 * `bottom: 0.2rem` offset so the panel's bottom edge aligns with
 * the icon's bottom edge, (c) the right inset that keeps the
 * panel's right edge a hair short of the tile's right edge.
 */
const ANCHOR_BOTTOM_INSET_PX = 3;
const ICON_TO_PANEL_GAP_PX = 4;
const TILE_RIGHT_INSET_PX = 4;
/**
 * Fallback left inset when the dispatcher couldn't locate the icon
 * rect (unit fixture, future tile-kind that doesn't render the
 * icon). Mirrors the icon host's `left: 0.35rem` so the popover
 * still anchors at the bottom-left corner gracefully.
 */
const FALLBACK_LEFT_INSET_PX = 6;

@customElement("weight-edit-popover")
export class WeightEditPopover extends LitElement {
  /** Whether the popover is rendered. The shell flips this through
   * the `weight-edit-open` / `weight-edit-close` flow; the popover
   * does NOT own its own visibility (the shell needs to close it
   * on tap-outside / Escape, which the popover can't observe
   * portably from inside its shadow root). */
  @property({ type: Boolean, reflect: true })
  open = false;

  /** Uuid of the node being edited. Threaded back into the
   * `inline-edit-weight` event detail on commit. */
  @property({ type: String, attribute: "node-id" })
  nodeId = "";

  /** Pre-edit weight value. Seeds the slider on each open; the
   * shell rewrites it whenever the operator opens a different
   * tile, so one popover instance can serve every tile. */
  @property({ type: Number })
  weight = 1;

  /** Tile rect snapshot the operator activated. The popover
   * anchors against this rect -- a frozen point in viewport
   * coordinates so a subsequent treemap reflow mid-edit doesn't
   * move the panel. Setting `null` (or `open=false`) hides the
   * popover. */
  @property({ attribute: false })
  anchorRect: DOMRect | null = null;

  /** SPEC §17.52-polish -- frozen rect of the weight-edit corner
   * icon on the activated tile. The popover places its left edge
   * just past the icon's right edge so the panel never overlaps
   * the icon, and constrains its `max-width` so the panel's right
   * edge stays inside the tile's right edge. `null` means the
   * dispatcher couldn't locate the icon (unit fixture, or a
   * long-press on a tile-kind that doesn't render the icon); the
   * popover falls back to the §17.52 bottom-left anchor without
   * the to-the-right offset in that case. */
  @property({ attribute: false })
  iconRect: DOMRect | null = null;

  /** Live slider value -- mirrored from the `<input>`'s `input`
   * event so the numeric label updates as the operator drags.
   * Re-seeded from `weight` on every open. */
  @state()
  private liveValue = 1;

  static styles = css`
    :host {
      /* SPEC 17.52 -- the popover is a fixed-position panel
         anchored to a tile rect in viewport coordinates. The
         host's display switches between block (open) and none
         (closed); no transform / opacity transitions because the
         popover is meant to feel snappy (the operator is in the
         middle of a deliberate edit gesture). */
      display: none;
      position: fixed;
      z-index: 300;
      /* The actual top/left are written as inline styles by
         updated() below so the calc() can read getBoundingClient
         Rect against the live viewport. */
    }
    :host([open]) {
      display: block;
    }
    .panel {
      box-sizing: border-box;
      /* SPEC 17.52-polish -- panel width is constrained by the
         host's tile via an inline max-width written by updated()
         in JS (operator request: shouldn't exceed the tile width).
         The pre-§17.52-polish min-width 14rem would have conflicted
         with the new tile-bound max-width on small tiles (a 1/12
         floor tile is under 14 rem wide on a portrait kiosk);
         dropping the min-width lets the panel auto-fit the
         available room. The CSS-level max-width 100% backstop is
         harmless when the inline max-width is narrower (the inline
         wins) and serves as a fallback for unit fixtures that
         mount the popover without a tile-bound max-width inline.
         (Backticks omitted in this CSS comment per §17.14 -- they
          would terminate the surrounding css tagged-template
          literal.) */
      max-width: 100%;
      padding: 0.6rem 0.8rem 0.7rem;
      background: var(--bg, #0c0f14);
      color: var(--text, #e8ecf4);
      border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45),
        0 2px 6px rgba(0, 0, 0, 0.35);
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .label {
      font-size: 1.4rem;
      font-weight: 700;
      text-align: center;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    /* SPEC 17.52 -- horizontal range slider sized for finger
       precision. The native thumb on Chromium / Blink kiosks is
       ~12 px square by default; we boost it to ~22 px (touch
       comfortable) via ::-webkit-slider-thumb / ::-moz-range-thumb
       so the operator can grab it on an oily kiosk screen. The
       track itself stays slim (4 px) so the thumb dominates the
       visual. */
    input[type="range"] {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 1.6rem;
      background: transparent;
      cursor: pointer;
    }
    input[type="range"]::-webkit-slider-runnable-track {
      width: 100%;
      height: 4px;
      background: color-mix(in srgb, currentColor 25%, transparent);
      border-radius: 2px;
    }
    input[type="range"]::-moz-range-track {
      width: 100%;
      height: 4px;
      background: color-mix(in srgb, currentColor 25%, transparent);
      border-radius: 2px;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 1.4rem;
      height: 1.4rem;
      margin-top: -0.55rem;
      background: var(--text, #e8ecf4);
      border: 2px solid color-mix(in srgb, currentColor 60%, transparent);
      border-radius: 50%;
      cursor: grab;
    }
    input[type="range"]::-moz-range-thumb {
      width: 1.4rem;
      height: 1.4rem;
      background: var(--text, #e8ecf4);
      border: 2px solid color-mix(in srgb, currentColor 60%, transparent);
      border-radius: 50%;
      cursor: grab;
    }
    input[type="range"]:active::-webkit-slider-thumb {
      cursor: grabbing;
    }
    input[type="range"]:active::-moz-range-thumb {
      cursor: grabbing;
    }
  `;

  /**
   * SPEC §17.52 -- re-seed `liveValue` from `weight` whenever the
   * popover opens (or whenever the operator opens a different
   * tile while the popover is already open). Without the re-seed,
   * the previous tile's slider position would persist into the
   * new tile's open and look like a "stale value" bug.
   */
  protected override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("open") && this.open) {
      this.liveValue = clampWeight(this.weight);
    } else if (changed.has("weight") && this.open) {
      this.liveValue = clampWeight(this.weight);
    }
  }

  /**
   * SPEC §17.52-polish -- after every render that has an
   * `anchorRect`, position the panel just to the RIGHT of the
   * weight-edit icon (operator request: *"appear at the right of
   * the weight icon (not overlapping it)"*) and constrain its
   * `max-width` so the panel's right edge stays inside the
   * tile's right edge (*"shouldn't exceed the tile width"*).
   * The panel's bottom edge aligns with the icon's bottom edge
   * (= tile bottom − the icon's own `bottom: 0.2rem` inset) so
   * the icon and the panel form one visually grounded "weight
   * editing strip" along the tile's lower edge.
   *
   * Two-pass measure: (1) write the inline `max-width` BEFORE
   * reading the panel's bounding rect — without this the panel
   * would be measured at its CSS-default width, which would
   * almost always exceed the tile-bound `max-width` we're about
   * to set, and the post-set rect would not reflect the real
   * height-after-wrap (the slider + label could wrap differently
   * once the panel is width-constrained); (2) re-read the panel
   * rect with the constrained width and compute `top` /  `left`
   * from there.
   *
   * Fallbacks: if `iconRect` is null (unit fixture, future tile-
   * kind without the icon), anchor the panel's bottom-left
   * corner to the tile's bottom-left with `FALLBACK_LEFT_INSET_PX`
   * (mirrors the icon's own `left: 0.35rem`). Horizontal clamp
   * keeps `left` inside the viewport on tiles in the right-most
   * column. Vertical clamp keeps the panel inside the viewport
   * when the tile is near the top edge.
   */
  protected override updated(): void {
    if (!this.open || !this.anchorRect) {
      return;
    }
    const panel = this.shadowRoot?.querySelector<HTMLElement>(".panel");
    if (!panel) return;
    const tile = this.anchorRect;
    // Pass 1: compute the panel's left edge + max-width from the
    // anchor + icon rect, then write the max-width inline so the
    // panel can re-flow before we measure its height in pass 2.
    const fallbackLeft = tile.left + FALLBACK_LEFT_INSET_PX;
    const left = this.iconRect
      ? this.iconRect.right + ICON_TO_PANEL_GAP_PX
      : fallbackLeft;
    const tileBoundMaxWidth =
      tile.right - left - TILE_RIGHT_INSET_PX;
    // The panel may not be narrower than ~3 rem (label needs to
    // render); when the tile is too narrow the panel still wins
    // visibility over fitting, but we don't go below this floor.
    const panelMinWidthPx = 48;
    const maxWidth = Math.max(panelMinWidthPx, tileBoundMaxWidth);
    panel.style.maxWidth = `${maxWidth}px`;
    // Pass 2: measure the panel with the constrained max-width
    // applied, then position the host so the panel's bottom edge
    // aligns with the icon's bottom edge (= tile.bottom − inset).
    const panelRect = panel.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    let top = tile.bottom - ANCHOR_BOTTOM_INSET_PX - panelRect.height;
    let leftClamped = left;
    if (top < VIEWPORT_EDGE_PADDING_PX) {
      // Tile is near the top of the viewport and the panel is
      // taller than the room above its bottom edge. Pin to the
      // top edge with padding so the panel stays on-screen.
      top = VIEWPORT_EDGE_PADDING_PX;
    }
    if (top + panelRect.height > viewportH - VIEWPORT_EDGE_PADDING_PX) {
      // Degenerate kiosk geometry (tile spans almost the whole
      // viewport): pin bottom edge instead.
      top = viewportH - VIEWPORT_EDGE_PADDING_PX - panelRect.height;
    }
    const minLeft = VIEWPORT_EDGE_PADDING_PX;
    const maxLeft = viewportW - panelRect.width - VIEWPORT_EDGE_PADDING_PX;
    if (leftClamped < minLeft) leftClamped = minLeft;
    if (leftClamped > maxLeft) leftClamped = maxLeft;
    const host = this as HTMLElement;
    host.style.top = `${top}px`;
    host.style.left = `${leftClamped}px`;
  }

  render() {
    if (!this.open) {
      return html``;
    }
    return html`<div
      class="panel"
      data-testid="weight-edit-popover"
      role="dialog"
      aria-label="Edit weight"
      @click=${(e: Event) => e.stopPropagation()}
      @pointerdown=${(e: Event) => e.stopPropagation()}
    >
      <div class="label" data-testid="weight-edit-label">
        ${formatWeight(this.liveValue)}
      </div>
      <input
        type="range"
        data-testid="weight-edit-slider"
        min=${MIN_WEIGHT}
        max=${MAX_WEIGHT}
        step=${WEIGHT_STEP}
        .value=${String(this.liveValue)}
        @input=${this.handleSliderInput}
        @change=${this.handleSliderChange}
        @keydown=${this.handleKeyDown}
      />
    </div>`;
  }

  private handleSliderInput = (e: Event): void => {
    const input = e.currentTarget as HTMLInputElement;
    const next = clampWeight(Number(input.value));
    this.liveValue = next;
  };

  /**
   * SPEC §17.52 -- the native `change` event fires when the
   * operator releases the slider thumb (mouse-up, touch-end, or
   * keyboard commit). This is the §17.52 commit-on-release seam:
   * dispatch `inline-edit-weight` so the composition root applies
   * `editFields(node, { kind, weight })`, which triggers a tree
   * refresh and the post-commit treemap reflow (animated by the
   * §17.52 CSS transition on `.tile`'s top/left/width/height).
   *
   * Skip the dispatch when `liveValue === weight` (no change) so
   * an operator who opens the popover and immediately taps
   * outside does not produce a no-op persisted update.
   */
  private handleSliderChange = (e: Event): void => {
    const input = e.currentTarget as HTMLInputElement;
    const next = clampWeight(Number(input.value));
    this.liveValue = next;
    if (next === clampWeight(this.weight)) {
      return;
    }
    const detail: InlineEditWeightDetail = {
      nodeId: this.nodeId,
      weight: next,
    };
    this.dispatchEvent(
      new CustomEvent<InlineEditWeightDetail>(INLINE_EDIT_WEIGHT_EVENT, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  };

  /**
   * SPEC §17.52 -- swallow Escape inside the slider so the
   * shell's `keydown` handler can read the same key and close the
   * popover without an extra "cancel commit" code path. The
   * native range input doesn't act on Escape, so the swallow is
   * not destructive; it just stops the propagation from racing
   * with the shell's outside-tap close.
   */
  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.stopPropagation();
      this.dispatchEvent(
        new CustomEvent("weight-edit-cancel", {
          bubbles: true,
          composed: true,
        }),
      );
    }
  };
}

/** Round to the nearest WEIGHT_STEP and clamp into the valid range
 * so a stale browser slider value can't slip past `Weight.of`. */
function clampWeight(raw: number): number {
  if (!Number.isFinite(raw)) return 1;
  const stepped = Math.round(raw / WEIGHT_STEP) * WEIGHT_STEP;
  if (stepped < MIN_WEIGHT) return MIN_WEIGHT;
  if (stepped > MAX_WEIGHT) return MAX_WEIGHT;
  // Round to 1 decimal so 0.5-step values render as "0.5", "1.0",
  // "1.5", ... rather than the float-arithmetic crud "0.5",
  // "1.0000000001", etc.
  return Math.round(stepped * 10) / 10;
}

/** Format the weight value for the popover label -- always one
 * decimal so "1" -> "1.0", "2.5" -> "2.5" -- mirrors the modal
 * weight slider's display. */
function formatWeight(w: number): string {
  return w.toFixed(1);
}

declare global {
  interface HTMLElementTagNameMap {
    "weight-edit-popover": WeightEditPopover;
  }
  interface HTMLElementEventMap {
    "weight-edit-cancel": CustomEvent<unknown>;
  }
}
