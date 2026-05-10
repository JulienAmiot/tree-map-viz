/**
 * `Direction` — enumerated value object describing the orientation of a
 * `Range<T>` along its comparator's order. Three inhabitants:
 *
 *   - `ASCENDING`  — the range goes from minimal to maximal in the
 *                    comparator's natural order (e.g. `[0, 100]` under
 *                    `NumericComparator` — higher is "more").
 *   - `DESCENDING` — the range goes the other way (`[100, 0]` under
 *                    `NumericComparator` — lower is "better"; a
 *                    "lower-is-better" KPI like response-time SLO).
 *   - `FLAT`       — the range is degenerate (`min === max`); zero-width.
 *
 * Class-with-singletons shape (rather than a TS `enum` keyword or a
 * `as const` literal-union) for three reasons: (a) reference-equality
 * matches the v4 round-5 §5 / §10 pattern adopted for the upcoming
 * `Comparator<T>` singletons (`NumericComparator`, `LexicographicComparator`)
 * — same shape end-to-end keeps the codebase coherent; (b) attaches
 * behaviour to the type (the `fromCompareSign` factory below) rather
 * than scattering helper functions around; (c) avoids the runtime /
 * bundle quirks of TS `enum` (extra reverse-mapping object emitted at
 * runtime, awkward `const enum` rules under `isolatedModules`).
 *
 * Equality contract: there are exactly three inhabitants and the
 * constructor is private, so reference equality (`===`) IS value
 * equality. No `equals()` method (matches the round-5 §10 decision for
 * `Comparator<T>`).
 *
 * Introduced in §17.66 as the first v4-redesign foundation strand. The
 * downstream consumer is `Range<T>.direction()` (§17.69), which will
 * call `Direction.fromCompareSign(this.compare(min, max))` to derive
 * its direction from the comparator's verdict on the range endpoints.
 */
export class Direction {
  private constructor(readonly name: string) {}

  static readonly ASCENDING = new Direction("ASCENDING");
  static readonly DESCENDING = new Direction("DESCENDING");
  static readonly FLAT = new Direction("FLAT");

  /**
   * Maps a `Comparator<T>.compare(min, max)` numeric verdict to its
   * corresponding `Direction`:
   *
   *   - `n < 0` ⇒ `ASCENDING`  (`min < max` in the comparator's order)
   *   - `n > 0` ⇒ `DESCENDING` (`min > max` — flipped range)
   *   - `n === 0` ⇒ `FLAT`     (degenerate; `min === max`)
   *
   * `NaN` and non-finite inputs are rejected — comparators are
   * contractually required to return a finite signed number; an
   * out-of-spec comparator surfaces here rather than silently
   * collapsing to a wrong direction.
   */
  static fromCompareSign(n: number): Direction {
    if (!Number.isFinite(n)) {
      throw new RangeError(
        `Direction.fromCompareSign: expected a finite number, got ${n}`,
      );
    }
    if (n < 0) return Direction.ASCENDING;
    if (n > 0) return Direction.DESCENDING;
    return Direction.FLAT;
  }

  toString(): string {
    return this.name;
  }
}
