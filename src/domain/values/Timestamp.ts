/**
 * `Timestamp` value object — a single moment in time, validated at the
 * boundary so the rest of the domain can rely on a non-`NaN` Date
 * (SPEC §17.58; mirrors `class Timestamp { +Date moment }` in v4).
 *
 * Native `Date` is mutable and can silently carry `NaN`
 * (`new Date("not-a-date")`); the VO rejects that at the factory and
 * the `moment` accessor returns a fresh `Date` so callers cannot
 * corrupt the wrapped instant via a shared reference. Storage is a
 * `number` (ms since epoch) for fast numeric compare in sorted-history
 * loops. The v4 class diagram uses `Timestamp` as the type of every
 * "when did this happen?" field on `TimestampedValue<T>`, `Objective<T>`,
 * and `Clock.now()`; consumers migrate to it strand-by-strand.
 */
export class InvalidTimestampError extends Error {
  constructor(reason: string) {
    super(`Invalid Timestamp: ${reason}`);
    this.name = "InvalidTimestampError";
  }
}

export class Timestamp {
  private constructor(private readonly momentMs: number) {}

  /** Factory — rejects invalid `Date` inputs (`new Date("not-a-date")`). */
  static of(moment: Date): Timestamp {
    const ms = moment.getTime();
    if (Number.isNaN(ms)) {
      throw new InvalidTimestampError("moment must be a valid Date");
    }
    return new Timestamp(ms);
  }

  /** The wrapped moment as a fresh `Date` (defensive copy). */
  get moment(): Date {
    return new Date(this.momentMs);
  }

  equals(other: Timestamp): boolean {
    return this.momentMs === other.momentMs;
  }

  isAfter(other: Timestamp): boolean {
    return this.momentMs > other.momentMs;
  }

  isBefore(other: Timestamp): boolean {
    return this.momentMs < other.momentMs;
  }

  /** Numeric comparator suitable for `Array#sort` (ascending). */
  static compare(a: Timestamp, b: Timestamp): number {
    return a.momentMs - b.momentMs;
  }
}
