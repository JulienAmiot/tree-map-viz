import type { Direction } from "../values/Direction.js";

/**
 * `Ranged<T>` — capability interface declaring "this object behaves like a
 * bounded interval over `T` with a known direction" (SPEC §17.71; mirrors
 * `interface Ranged<T>` in the v4 class diagram). Realized by `Range<T>`.
 *
 * Slots vs ordering: `minimalValue` / `maximalValue` are SLOT names, not a
 * numeric ordering — `minimalValue` precedes `maximalValue` in the
 * comparator's order for an `ASCENDING` range, follows it for `DESCENDING`,
 * and equals it for `FLAT`.
 *
 * `requireValue(v)` is a tell-don't-ask membership assertion — strict impls
 * throw on out-of-range, lenient impls treat membership as advisory. See
 * `Range.ts` for the concrete contract.
 */
export interface Ranged<T> {
  readonly minimalValue: T;
  readonly maximalValue: T;
  compare(a: T, b: T): number;
  direction(): Direction;
  contains(v: T): boolean;
  requireValue(v: T): void;
}
