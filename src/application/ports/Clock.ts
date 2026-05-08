import type { Timestamp } from "../../domain/values/Timestamp.js";

/**
 * Application port: a clock that returns the current moment (SPEC §17.57).
 *
 * Mirrors `IdGenerator` (§17.3) at the boundary level: a tiny port owned
 * by the application layer, bound to a real-clock impl in the composition
 * root, and stubbed for deterministic tests. Encoded as a method on an
 * interface (rather than IdGenerator's callable-type shape) so:
 *
 * - the v4 class diagram's `Clock { +now() Timestamp }` signature maps
 *   to TS one-for-one (a callable `() => Date` would not), and
 * - if a future strand adds a sibling reading (e.g. monotonic ticks for
 *   animation timing, or an `nowIso()` accessor for codec-friendly
 *   strings), it lands on the same port without a callable→object
 *   refactor at every call site.
 *
 * **Return type since §17.58**: `Timestamp` — the v4-aligned VO that
 * wraps a validated `Date` (§17.57 returned raw `Date`). Boundary-level
 * consumers that still need a raw `Date` unwrap with `clock.now().moment`.
 *
 * Stubs in tests stay near zero-ceremony:
 *
 *     const fixed = Timestamp.of(new Date("2026-05-01T12:00:00Z"));
 *     const clock: Clock = { now: () => fixed };
 */
export interface Clock {
  /** Current moment, sampled at call time. Pure — no side-effects. */
  now(): Timestamp;
}
