/**
 * Drill transition helper (SPEC §2 / §4 / §12.2 — Phase 9).
 *
 * "JS only sets classes and timeouts." This module is the single place that
 * orchestrates the CSS-driven drill-into animation: it flips a class on the
 * caller-supplied host, schedules the navigation `commit` after the CSS
 * transition has had time to land, then removes the class.
 *
 * Reduced-motion contract (SPEC §4 last bullet):
 *   prefers-reduced-motion: reduce  →  commit fires immediately, the class
 *                                       is NEVER added.
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
 * The helper does NOT track in-flight transitions: a re-drill while a prior
 * timer is pending fires a second commit + a second class re-add, which is
 * harmless (the class is idempotent and the second commit's focus wins). If
 * cancellation becomes a real UX concern, upgrade to a controller that
 * tracks the latest pending commit; today's contract is fire-and-forget.
 */

/**
 * Mirrors `TEST_NO_ANIM_CLASS` from `src/adapters/testBridge.ts` deliberately
 * so this helper does not statically import the bridge module. See module
 * docstring for the reasoning. Kept as a private constant: callers should
 * use `dismissAnimations()` on the bridge to flip it.
 */
const TEST_NO_ANIM_CLASS = "test-no-anim";

/** Default settle window for the drill CSS transition. Tunable per call. */
export const DRILL_SETTLE_MS = 250;

/** CSS class added to the host while the drill animation is in flight. */
export const DRILL_CLASS = "encap--drill";

export interface RunDrillTransitionOptions {
  /** Element on which the `encap--drill` class is flipped. */
  readonly host: HTMLElement;
  /** Navigation commit — invoked once the CSS transition has settled. */
  readonly commit: () => void;
  /** Override the class name (defaults to `DRILL_CLASS`). */
  readonly className?: string;
  /** Override the settle window (defaults to `DRILL_SETTLE_MS`). */
  readonly settleMs?: number;
  /**
   * Test seam — replaces the default reduced-motion detection (matchMedia
   * + the testBridge sentinel). Production callers omit this and get the
   * default behaviour.
   */
  readonly shouldReduceMotion?: () => boolean;
  /**
   * Test seam — replaces `setTimeout`. Returning value is ignored; tests
   * use Vitest fake timers and don't need cancellation.
   */
  readonly schedule?: (cb: () => void, ms: number) => void;
}

/**
 * Run the drill-into animation, then commit the navigation.
 *
 * On reduced-motion (system-level OR test-bridge sentinel), commit fires
 * synchronously and the host's class list is never touched.
 */
export function runDrillTransition(opts: RunDrillTransitionOptions): void {
  const reduce = (opts.shouldReduceMotion ?? defaultShouldReduceMotion)();
  if (reduce) {
    opts.commit();
    return;
  }
  const className = opts.className ?? DRILL_CLASS;
  const settleMs = opts.settleMs ?? DRILL_SETTLE_MS;
  const host = opts.host;
  host.classList.add(className);
  (opts.schedule ?? defaultSchedule)(() => {
    try {
      opts.commit();
    } finally {
      host.classList.remove(className);
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
