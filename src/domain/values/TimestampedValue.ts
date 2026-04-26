export class InvalidTimestampedValueError extends Error {
  constructor(reason: string) {
    super(`Invalid TimestampedValue: ${reason}`);
    this.name = "InvalidTimestampedValueError";
  }
}

export class TimestampedValue<T> {
  private readonly asOfMs: number;

  private constructor(
    readonly value: T,
    asOfMs: number,
  ) {
    this.asOfMs = asOfMs;
  }

  static of<T>(value: T, asOf: Date): TimestampedValue<T> {
    const ms = asOf.getTime();
    if (Number.isNaN(ms)) {
      throw new InvalidTimestampedValueError("asOf must be a valid Date");
    }
    return new TimestampedValue<T>(value, ms);
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
