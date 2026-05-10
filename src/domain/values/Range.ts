import type { Ranged } from "../capabilities/Ranged.js";
import type { Comparator } from "./Comparator.js";
import { Direction } from "./Direction.js";

/**
 * `OutOfRangeError` — thrown by `StrictRange<T>.requireValue(v)` when `v`
 * lies outside the closed interval `[minimalValue, maximalValue]`. Mirrors
 * the `Timestamp` / `InvalidTimestampError` co-location pattern.
 */
export class OutOfRangeError extends Error {
  constructor(reason: string) {
    super(`Out of range: ${reason}`);
    this.name = "OutOfRangeError";
  }
}

/**
 * `Range<T>` — abstract closed interval over `T` paired with a
 * `Comparator<T>` (SPEC §17.71; v4 class diagram). Composition over the
 * comparator means the range delegates ordering to a strategy rather than
 * baking in numeric / string assumptions.
 *
 * Construction is via the `of(min, max, cmp)` static factories on the
 * concrete subclasses (`StrictRange.of` / `LenientRange.of`); the abstract
 * constructor is `protected` to force that path.
 *
 * The `contains(v)` impl uses the sign-product trick — `v` is in the closed
 * interval iff `sign(compare(min, v)) * sign(compare(v, max)) >= 0`. Works
 * uniformly for `ASCENDING` (both signs negative ⇒ product positive),
 * `DESCENDING` (both positive ⇒ product positive), and `FLAT` (one factor
 * is zero ⇒ product zero) without branching on direction. Endpoints are
 * inclusive (an endpoint match drives one factor to zero).
 */
export abstract class Range<T> implements Ranged<T> {
  protected constructor(
    public readonly minimalValue: T,
    public readonly maximalValue: T,
    private readonly comparator: Comparator<T>,
  ) {}

  compare(a: T, b: T): number {
    return this.comparator.compare(a, b);
  }

  direction(): Direction {
    return Direction.fromCompareSign(
      this.comparator.compare(this.minimalValue, this.maximalValue),
    );
  }

  contains(v: T): boolean {
    const aSign = Math.sign(this.comparator.compare(this.minimalValue, v));
    const bSign = Math.sign(this.comparator.compare(v, this.maximalValue));
    return aSign * bSign >= 0;
  }

  abstract requireValue(v: T): void;
}

/**
 * `StrictRange<T>` — `requireValue(v)` throws `OutOfRangeError` if
 * `!contains(v)`. The "tell, don't ask" enforcement variant — caller code
 * surfaces a violation immediately rather than silently storing a bad value.
 */
export class StrictRange<T> extends Range<T> {
  private constructor(min: T, max: T, comparator: Comparator<T>) {
    super(min, max, comparator);
  }

  static of<T>(min: T, max: T, comparator: Comparator<T>): StrictRange<T> {
    return new StrictRange(min, max, comparator);
  }

  requireValue(v: T): void {
    if (!this.contains(v)) {
      throw new OutOfRangeError(
        `value ${String(v)} is not within [${String(this.minimalValue)}, ${String(this.maximalValue)}]`,
      );
    }
  }
}

/**
 * `LenientRange<T>` — `requireValue(v)` is a no-op. Membership is advisory;
 * `contains(v)` still answers truthfully but no enforcement happens at the
 * range boundary. Used by `BusinessScoreNode<T>` whose objective values may
 * legitimately fall outside the displayed range (a stretch goal beyond
 * `maximalValue`, an under-target dip below `minimalValue`).
 */
export class LenientRange<T> extends Range<T> {
  private constructor(min: T, max: T, comparator: Comparator<T>) {
    super(min, max, comparator);
  }

  static of<T>(min: T, max: T, comparator: Comparator<T>): LenientRange<T> {
    return new LenientRange(min, max, comparator);
  }

  requireValue(_v: T): void {
    // Intentionally a no-op — see class docblock. Membership is advisory
    // for lenient ranges; out-of-range values are explicitly permitted.
  }
}
