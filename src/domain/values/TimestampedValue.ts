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
 * inside hot history-sort loops; the `asOf` getter narrowed from `Date`
 * to `Timestamp` in §17.62 (paired with `Objective.targetDate` getter
 * narrowing — the v4 class diagram now matches end-to-end). Consumers
 * (`viewModelMapper`, `currentValueDateIso`, JSON encode) read the
 * underlying `Date` via `.asOf.moment.*` when they need ISO/getTime
 * primitives.
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

  get asOf(): Timestamp {
    return Timestamp.of(new Date(this.asOfMs));
  }

  isAfter(other: TimestampedValue<T>): boolean {
    return this.asOfMs > other.asOfMs;
  }

  static compareByDate<T>(a: TimestampedValue<T>, b: TimestampedValue<T>): number {
    return a.asOfMs - b.asOfMs;
  }
}
