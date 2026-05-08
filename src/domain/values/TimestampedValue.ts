import { Timestamp } from "./Timestamp.js";

/**
 * `TimestampedValue<T>` value object — a (value, when-it-was-recorded)
 * pair (SPEC §17.61 — `asOf` narrows from raw `Date` to the `Timestamp`
 * value object introduced in §17.58, mirroring the v4 class diagram's
 * `+Timestamp asOf` field on `class TimestampedValue<T> { <<value>> }`).
 *
 * Validation lives at `Timestamp.of` (a `NaN`-Date is rejected at the
 * boundary), so the legacy `InvalidTimestampedValueError` is gone — no
 * `TimestampedValue`-level invariant remains once the moment is a
 * non-`NaN` Timestamp.
 *
 * Storage stays as a `number` (ms since epoch) for fast numeric compare
 * inside hot history-sort loops; the `asOf: Date` getter is preserved
 * (deliberately) so consumers (`viewModelMapper`, `currentValueDateIso`,
 * JSON encode) keep working unchanged. A future strand can narrow the
 * getter to `Timestamp` once those consumers migrate.
 */
export class TimestampedValue<T> {
  private readonly asOfMs: number;

  private constructor(
    readonly value: T,
    asOfMs: number,
  ) {
    this.asOfMs = asOfMs;
  }

  static of<T>(value: T, asOf: Timestamp): TimestampedValue<T> {
    return new TimestampedValue<T>(value, asOf.moment.getTime());
  }

  get asOf(): Date {
    return new Date(this.asOfMs);
  }

  isAfter(other: TimestampedValue<T>): boolean {
    return this.asOfMs > other.asOfMs;
  }

  static compareByDate<T>(a: TimestampedValue<T>, b: TimestampedValue<T>): number {
    return a.asOfMs - b.asOfMs;
  }
}
