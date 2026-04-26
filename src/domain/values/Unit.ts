export class InvalidUnitError extends Error {
  constructor(reason: string) {
    super(`Invalid Unit: ${reason}`);
    this.name = "InvalidUnitError";
  }
}

export class Unit {
  private constructor(readonly value: string) {}

  static of(raw: string): Unit {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new InvalidUnitError("must be non-empty after trim");
    }
    return new Unit(trimmed);
  }

  static percent(): Unit {
    return new Unit("%");
  }

  equals(other: Unit): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
