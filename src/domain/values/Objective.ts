import { Timestamp } from "./Timestamp.js";

/**
 * `Objective<T>` value object — the (initial, target, by-when) tuple a
 * `BusinessScoreCard` is graded against (SPEC §17.60 — `targetDate`
 * factory narrows from raw `Date` to the `Timestamp` value object
 * introduced in §17.58; SPEC §17.62 — `targetDate` getter also narrows
 * from `Date` to `Timestamp`, paired with the symmetric
 * `TimestampedValue.asOf` getter narrowing — the v4 class diagram's
 * `+Timestamp targetDate` field now matches at every direction).
 *
 * The narrowing pushes "is this a valid moment?" validation down into
 * `Timestamp.of`, so the legacy `InvalidObjectiveError` (which only
 * existed to flag `NaN`-Dates) is no longer needed — `Timestamp.of`
 * already throws `InvalidTimestampError` at the boundary. Consumers
 * that need a raw `Date` (ISO formatting, `getTime()` arithmetic) read
 * via `.targetDate.moment.*`.
 */
export class Objective<T> {
  private readonly targetDateMs: number;

  private constructor(
    readonly initialValue: T,
    readonly targetValue: T,
    targetDateMs: number,
  ) {
    this.targetDateMs = targetDateMs;
  }

  static of<T>(initialValue: T, targetValue: T, targetDate: Timestamp): Objective<T> {
    return new Objective<T>(initialValue, targetValue, targetDate.moment.getTime());
  }

  get targetDate(): Timestamp {
    return Timestamp.of(new Date(this.targetDateMs));
  }

  equals(other: Objective<T>): boolean {
    return (
      Object.is(this.initialValue, other.initialValue) &&
      Object.is(this.targetValue, other.targetValue) &&
      this.targetDateMs === other.targetDateMs
    );
  }
}
