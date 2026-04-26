export class InvalidObjectiveError extends Error {
  constructor(reason: string) {
    super(`Invalid Objective: ${reason}`);
    this.name = "InvalidObjectiveError";
  }
}

export class Objective<T> {
  private readonly targetDateMs: number;

  private constructor(
    readonly initialValue: T,
    readonly targetValue: T,
    targetDateMs: number,
  ) {
    this.targetDateMs = targetDateMs;
  }

  static of<T>(initialValue: T, targetValue: T, targetDate: Date): Objective<T> {
    const ms = targetDate.getTime();
    if (Number.isNaN(ms)) {
      throw new InvalidObjectiveError("targetDate must be a valid Date");
    }
    return new Objective<T>(initialValue, targetValue, ms);
  }

  get targetDate(): Date {
    return new Date(this.targetDateMs);
  }

  equals(other: Objective<T>): boolean {
    return (
      Object.is(this.initialValue, other.initialValue) &&
      Object.is(this.targetValue, other.targetValue) &&
      this.targetDateMs === other.targetDateMs
    );
  }
}
