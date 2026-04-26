const MIN_WEIGHT = 1;
const MAX_WEIGHT = 10;

export class InvalidWeightError extends Error {
  constructor(reason: string) {
    super(`Invalid Weight: ${reason}`);
    this.name = "InvalidWeightError";
  }
}

export class Weight {
  private constructor(readonly value: number) {}

  static of(raw: number): Weight {
    if (!Number.isInteger(raw)) {
      throw new InvalidWeightError(`must be an integer (got ${raw})`);
    }
    if (raw < MIN_WEIGHT || raw > MAX_WEIGHT) {
      throw new InvalidWeightError(
        `must be between ${MIN_WEIGHT} and ${MAX_WEIGHT} inclusive (got ${raw})`,
      );
    }
    return new Weight(raw);
  }

  equals(other: Weight): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
