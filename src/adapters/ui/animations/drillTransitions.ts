/**
 * Drill transition helper (SPEC §2 / §4 / §12.2 — Phase 9, rewritten in
 * §17.32).
 *
 * "JS only sets classes and timeouts." This module is the single place that
 * orchestrates the CSS-driven drill-into animation.
 *
 * § 17.20 (replaced) shipped a layout-wide *zoom* effect: the entire
 * `.layout` wrapper got an `encap--drill` class that scaled it from 1.0 →
 * 1.04 with a slight opacity dip while the navigation commit was pending.
 * The visual implied "the focus is pulling forward" but did not
 * communicate the spatial relationship between the tapped tile and the
 * focused-panel strip.
 *
 * §17.32 replaces that with a **FLIP-style morph**: the tapped child tile
 * translates + grows to the parent-identity-strip's bounding rect (so it
 * literally flies up to take the parent's place) while every other child
 * tile fades out. The old parent strip fades out at the same time so the
 * morphed tile becomes the sole occupant of the strip's position when the
 * navigation commits. After the commit (data swap), the freshly-rendered
 * children grid re-mounts at opacity 0 → 1 so the new children "appear"
 * rather than blink in. A custom CSS property `--drill-title-color` is
 * also set on the tapped tile so the .title rule (in tileLayoutStyles)
 * recolours to `var(--board-fresh)` during the morph — the rest of the
 * tile (value, timestamp, unit) deliberately keeps its own colours.
 *
 * §17.36 — panel surface continuity:
 *   The parent strip and child tiles now share a panel aesthetic
 *   (same border-color, same border-radius) but use different bg
 *   tints (--panel-strip-bg ≈ 12 % vs --panel-tile-bg ≈ 7 %).
 *   The morph extends its transition list with `background-color`,
 *   `border-color`, and `border-radius`, and writes the strip's
 *   destination panel-bg / border-radius onto the morphing tile so
 *   the tile's surface visually drifts from the child tint to the
 *   parent-panel tint as it flies up. With border-color identical
 *   on both surfaces today the border-color transition is a no-op
 *   visually, but the property is in the transition list so a
 *   future divergence (e.g. a "focused" border colour) animates
 *   automatically without a second helper edit.
 *
 * §17.38 — title font-size morph:
 *   The child-role title is `2vh`, the parent-role title `2.4vh`
 *   (a `~20 %` size delta + a `600 → 700` weight bump baked into
 *   `*AsParent.ts`). Pre-§17.38 the morph held the title at the
 *   child's `2vh` for the full settle and then snapped to `2.4vh`
 *   the moment Lit re-rendered the strip with the morphed tile's
 *   per-view in the parent role — a visible "size pop" at
 *   commit. With the §17.37 position alignment fixing the
 *   simultaneous top-left jump, the size pop became the only
 *   remaining commit-artifact. §17.38 pipes the parent role's
 *   font-size through a custom CSS property: `tileLayoutStyles`'
 *   base `.title { font-size: var(--drill-title-font-size, 2vh) }`
 *   reads it (with `2vh` as the static-render fallback), the
 *   helper writes `--drill-title-font-size: 2.4vh` onto the
 *   morphing tile (cascades through shadow DOM, like
 *   `--drill-title-color`), and the existing `transition` list
 *   on `.title` gains `font-size 320ms ease` so the growth lands
 *   on the same curve as the colour recolour. At commit the strip
 *   re-mounts with the parent role's `font-size: 2.4vh` literal
 *   (which `*AsParent.ts` overrides with at higher source-order
 *   precedence than the var rule), so the visual continues at
 *   `2.4vh` without a pop.
 *
 * Why translate + width/height instead of `transform: scale()`:
 *   - The tile's destination geometry is **layout-dependent**: the parent
 *     strip is 22 % of the viewport, but the tile's starting position is
 *     wherever the squarified treemap put it. A CSS keyframe can only
 *     animate from a known to a known; the destination here changes
 *     every frame.
 *   - `transform: scale(sx, sy)` with non-uniform factors (the parent
 *     strip is wide-and-short, the tile is roughly square or tall) would
 *     stretch every text node inside the tile — title, value, timestamp,
 *     unit — into a deformed rectangle. The earlier §17.32 build did
 *     exactly that, and the operator's feedback was unambiguous: the
 *     content must NOT deform during the morph.
 *   - Animating `width` and `height` directly lets the inner content
 *     reflow naturally (the title stays at `2vh` font-size, the value's
 *     `cqmin` clamp re-resolves against the new tile dimensions each
 *     frame, the bottom-right timestamp follows its own absolute
 *     positioning rules). The cost is one layout per frame for one
 *     element — cheap on a kiosk-class machine and worth it for the
 *     undistorted content. The position delta still uses
 *     `transform: translate()` (compositor-only, no layout cost).
 *
 * Reduced-motion contract (SPEC §4 last bullet):
 *   prefers-reduced-motion: reduce  →  commit fires immediately, NO
 *                                       transforms or fades are applied.
 *   testBridge.dismissAnimations()  →  same path (sentinel class
 *                                       `test-no-anim` on `<html>` per
 *                                       SPEC §14.4).
 *
 * The helper deliberately does NOT static-import the testBridge sentinel —
 * doing so would pull `testBridge.ts` into the main chunk and defeat the
 * dynamic-import gate from `main.ts` (which keeps the bridge tree-shaken
 * out of production builds when `?test=1` is absent). The sentinel string
 * is replicated as a module-local constant; the testBridge re-exports the
 * same value so the two contracts stay in lock-step at the type level.
 *
 * The helper is pure in the sense that all side-effecting deps (matchMedia,
 * setTimeout) are seam-overridable; production callers use the defaults,
 * unit tests inject deterministic stubs.
 *
 * The helper does NOT track in-flight transitions: a re-drill while a
 * prior timer is pending fires a second commit + a second transform
 * application; the most recent commit's focus wins. If cancellation
 * becomes a real UX concern, upgrade to a controller that tracks the
 * latest pending commit; today's contract is fire-and-forget.
 */

/**
 * Mirrors `TEST_NO_ANIM_CLASS` from `src/adapters/testBridge.ts` deliberately
 * so this helper does not statically import the bridge module. See module
 * docstring for the reasoning. Kept as a private constant: callers should
 * use `dismissAnimations()` on the bridge to flip it.
 */
const TEST_NO_ANIM_CLASS = "test-no-anim";

/** Default settle window for the FLIP morph + sibling fade. */
export const DRILL_SETTLE_MS = 320;

/**
 * SPEC §17.38 — the parent-role title's font-size, mirrored here so the
 * drill helper can write it onto the morphing tile via the
 * `--drill-title-font-size` custom property. The literal lives in
 * `TextNodeAsParent.ts` / `BusinessScoreCardNodeAsParent.ts` as the
 * `.title { font-size: 2.4vh }` override; this constant keeps the two
 * call sites in lock-step. If the parent-role title size ever changes,
 * both `*AsParent.ts` overrides AND this constant must be updated
 * together (a single-source-of-truth refactor through a CSS custom
 * property at `<tree-graph-screen>` :host level is a candidate
 * follow-up).
 */
export const DRILL_PARENT_TITLE_FONT_SIZE = "2.4vh";

/**
 * CSS class added to the tapped tile while the morph is in flight so
 * tests (and any future cosmetic CSS hook) can target the active drill
 * tile without a brittle inline-style probe. The class is cleaned up
 * synchronously when the commit closure runs — by which point the
 * tile is about to be unmounted as part of the post-commit re-render
 * anyway, but a clean class list makes the intermediate state easier
 * to reason about in the inspector.
 */
export const DRILL_CLASS = "tile--drilling";

export interface RunDrillTransitionOptions {
  /**
   * The tapped child tile. Receives a `transform: translate(...)` plus
   * a `width`/`height` transition that morphs it into the `target`
   * element's bounding rect, and a `--drill-title-color` custom-prop
   * write that recolours its `.title` (only) to the focused-panel
   * accent.
   */
  readonly tile: HTMLElement;

  /**
   * The destination element — the parent-identity-strip. Read for its
   * `getBoundingClientRect()` only; never mutated.
   */
  readonly target: HTMLElement;

  /**
   * Other elements to fade out in parallel with the morph: the
   * non-tapped child tiles, the plus tile, and the old parent strip.
   * The morphed tile becomes the visible "new parent" when the commit
   * lands, so anything else that sits in the strip's position must
   * make way.
   */
  readonly fadeOut: readonly HTMLElement[];

  /** Navigation commit — invoked once the morph has settled. */
  readonly commit: () => void;

  /** Override the settle window (defaults to `DRILL_SETTLE_MS`). */
  readonly settleMs?: number;

  /**
   * Test seam — replaces the default reduced-motion detection
   * (matchMedia + the testBridge sentinel). Production callers omit
   * this and get the default behaviour.
   */
  readonly shouldReduceMotion?: () => boolean;

  /**
   * Test seam — replaces `setTimeout`. Returning value is ignored;
   * tests use Vitest fake timers and don't need cancellation.
   */
  readonly schedule?: (cb: () => void, ms: number) => void;
}

/**
 * Run the FLIP-style drill-into morph, then commit the navigation.
 *
 * On reduced-motion (system-level OR test-bridge sentinel), commit fires
 * synchronously and no styles are applied to any element.
 */
export function runDrillTransition(opts: RunDrillTransitionOptions): void {
  const reduce = (opts.shouldReduceMotion ?? defaultShouldReduceMotion)();
  if (reduce) {
    opts.commit();
    return;
  }
  const settleMs = opts.settleMs ?? DRILL_SETTLE_MS;
  const { tile, target, fadeOut } = opts;

  const tileRect = tile.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  // Guard against zero-sized rects (jsdom / hidden elements / a stale
  // call after the layout has been torn down). Without this the scale
  // factor below would be NaN/Infinity and the transform would silently
  // hide the tile. Falling through to the synchronous commit keeps the
  // navigation responsive even when the morph cannot be staged.
  if (tileRect.width <= 0 || tileRect.height <= 0) {
    opts.commit();
    return;
  }

  const dx = targetRect.left - tileRect.left;
  const dy = targetRect.top - tileRect.top;
  const targetW = targetRect.width;
  const targetH = targetRect.height;

  // Stage the tile for the morph. transform-origin: top left so a
  // pure translate (without scale) lands the tile's top-left corner
  // on the target's top-left corner; the bottom-right corner follows
  // as `width` and `height` grow to the target's dimensions.
  // zIndex: 10 so the tile draws above its siblings inside the grid
  // (the document-order rule already puts the grid's stacking context
  // above the parent-identity-strip's, but the explicit z-index keeps
  // the contract robust against future structural changes).
  tile.classList.add(DRILL_CLASS);
  tile.style.transformOrigin = "top left";
  tile.style.willChange =
    "transform, width, height, background-color, border-color, border-radius";
  tile.style.zIndex = "10";
  // §17.36 — `background-color`, `border-color`, and `border-radius`
  // are part of the morph transition list so the tile's panel surface
  // drifts smoothly into the parent strip's surface as it flies up
  // (different bg tints today; identical border-color and border-
  // radius — the latter two transition as no-ops but stay in the list
  // so a future divergence animates without a helper edit).
  tile.style.transition =
    `transform ${settleMs}ms ease, ` +
    `width ${settleMs}ms ease, ` +
    `height ${settleMs}ms ease, ` +
    `background-color ${settleMs}ms ease, ` +
    `border-color ${settleMs}ms ease, ` +
    `border-radius ${settleMs}ms ease`;
  // Custom CSS property scoped to .title (see tileLayoutStyles).
  // CSS custom properties cascade through shadow DOM boundaries, so
  // setting it here propagates two shadow boundaries deep
  // (children-grid → node-view → text-node-as-child / bsc-as-child)
  // without a multi-shadow-pierce query. The .title rule reads
  // `color: var(--drill-title-color, currentColor)`, so setting it
  // recolours the title alone — value, timestamp, unit, and any
  // future tile glyph keep their own colours.
  tile.style.setProperty("--drill-title-color", "var(--board-fresh)");
  // SPEC §17.38 — pipe the parent-role title font-size onto the
  // morphing tile through the same cascade. The .title rule in
  // tileLayoutStyles reads `font-size: var(--drill-title-font-size,
  // 2vh)` and lists font-size in its transition, so writing the
  // parent-role literal here triggers a smooth 2vh → 2.4vh growth
  // over the settle window. At commit the strip re-mounts with the
  // parent-role override (literal 2.4vh) and the visual lands at
  // the same size — no pop.
  tile.style.setProperty(
    "--drill-title-font-size",
    DRILL_PARENT_TITLE_FONT_SIZE,
  );

  // Stage every fade-out element with a uniform transition so the
  // optical centre of the animation lands at the same moment as the
  // tile's settle.
  for (const sib of fadeOut) {
    sib.style.transition = `opacity ${settleMs}ms ease`;
    sib.style.willChange = "opacity";
  }

  // Force a single synchronous reflow so the browser commits the
  // initial state (transform: none, original width/height, opacity:
  // 1) before we apply the target state. Without this both reads and
  // writes get coalesced into the same frame and the transitions
  // collapse to an instantaneous jump.
  void tile.offsetWidth;

  // Trigger the morph + fades on the next frame.
  tile.style.transform = `translate(${dx}px, ${dy}px)`;
  tile.style.width = `${targetW}px`;
  tile.style.height = `${targetH}px`;
  // §17.36 — write the parent strip's panel surface onto the morphing
  // tile. The tile starts with --panel-tile-bg (≈ 7 %) inherited from
  // the children-grid CSS and with --panel-border-radius (8 px) on the
  // border. Setting these inline pulls the tile to --panel-strip-bg
  // (≈ 12 %) and to the same radius value (still 8 px today) — the
  // resolved start/end values flow into the transitions registered
  // above so the tile's surface visually drifts to the parent panel's
  // surface as it flies up. Inline `var()` values resolve at compute
  // time and inherit through shadow DOM, so the helper does not need
  // to know the literal mix percentages.
  tile.style.backgroundColor =
    "var(--panel-strip-bg, color-mix(in srgb, currentColor 12%, transparent))";
  tile.style.borderColor =
    "var(--panel-border-color, color-mix(in srgb, currentColor 28%, transparent))";
  tile.style.borderRadius = "var(--panel-border-radius, 8px)";
  for (const sib of fadeOut) {
    sib.style.opacity = "0";
  }

  (opts.schedule ?? defaultSchedule)(() => {
    try {
      opts.commit();
    } finally {
      // The post-commit re-render unmounts the morphed tile and
      // re-creates the children-grid contents, so the inline styles
      // we set above evaporate with the elements that carry them.
      // The `tile.classList.remove` call is defensive — if a future
      // refactor reuses the same tile element across renders the
      // class won't leak into the next frame.
      tile.classList.remove(DRILL_CLASS);
      tile.style.willChange = "";
    }
  }, settleMs);
}

function defaultShouldReduceMotion(): boolean {
  if (typeof window === "undefined") return true;
  // testBridge.dismissAnimations sentinel — SPEC §14.4. Read first so a
  // test-environment override beats the system-level matchMedia answer.
  if (window.document?.documentElement.classList.contains(TEST_NO_ANIM_CLASS)) {
    return true;
  }
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

function defaultSchedule(cb: () => void, ms: number): void {
  window.setTimeout(cb, ms);
}
