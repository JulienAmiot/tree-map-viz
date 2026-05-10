/**
 * `Comparator<T>` — capability interface for ordering two values of type T
 * (SPEC §17.68; mirrors `interface Comparator<T> { +compare(T a, T b) Number }`
 * in the v4 class diagram).
 *
 * Contract: `compare(a, b)` returns a **finite signed number** —
 *
 *   - a strictly negative result ⇒ `a` precedes `b`
 *   - zero                       ⇒ `a` and `b` are equivalent under this order
 *   - a strictly positive result ⇒ `a` follows  `b`
 *
 * Every conforming impl MUST return a finite number; `NaN` / ±Infinity are
 * out-of-spec and SHOULD be rejected at the comparator boundary so a buggy
 * caller surfaces loud. `Direction.fromCompareSign` (§17.67) re-validates
 * the verdict downstream as a defence-in-depth check.
 *
 * Two singletons ship in this strand:
 *   - `NumericComparator` for `Comparator<number>` (numeric −/+/0 ordering)
 *   - `LexicographicComparator` for `Comparator<string>` (UTF-16 codepoint
 *     ordering; locale-independent — see test rationale).
 *
 * The downstream consumer is `Range<T>` (§17.69+), which composes a
 * `Comparator<T>` to derive `Range<T>.direction()` via
 * `Direction.fromCompareSign(this.compare(min, max))`.
 */
export interface Comparator<T> {
  /** Returns a finite negative / 0 / positive number per the docblock contract. */
  compare(a: T, b: T): number;
}

/**
 * Singleton class-with-private-ctor pattern — same shape as `Direction`
 * (§17.67). Reference equality (`NumericComparator.INSTANCE === ...`) IS the
 * equality contract; the private constructor + lone static INSTANCE make a
 * second runtime instance impossible.
 */
export class NumericComparator implements Comparator<number> {
  private constructor() {}

  static readonly INSTANCE: NumericComparator = new NumericComparator();

  compare(a: number, b: number): number {
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      throw new RangeError(
        `NumericComparator.compare: expected finite numbers, got (${a}, ${b})`,
      );
    }
    // Equality fast-path canonicalises `-0` to `+0` (since `-0 === 0` is true
    // but `-0 - 0 === -0`). Downstream callers comparing the result with
    // `Object.is(result, 0)` (or vitest's `.toBe(0)`) need a true `+0`.
    if (a === b) return 0;
    return a - b;
  }
}

/**
 * UTF-16 codepoint ordering (locale-independent). `localeCompare` is
 * deliberately NOT used: kiosk-deterministic ordering must not vary by
 * `navigator.language`, and the lexicographic contract in CS literature is
 * "compare codepoint sequences" — exactly what `<` / `>` deliver on strings.
 */
export class LexicographicComparator implements Comparator<string> {
  private constructor() {}

  static readonly INSTANCE: LexicographicComparator =
    new LexicographicComparator();

  compare(a: string, b: string): number {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }
}
