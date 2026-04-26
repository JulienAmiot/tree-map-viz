const MAX_DESCRIPTION_LENGTH = 280;

export class InvalidDescriptionError extends Error {
  constructor(reason: string) {
    super(`Invalid Description: ${reason}`);
    this.name = "InvalidDescriptionError";
  }
}

export class Description {
  private constructor(readonly value: string) {}

  static of(raw: string): Description {
    const trimmed = raw.trim();
    if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
      throw new InvalidDescriptionError(
        `must be at most ${MAX_DESCRIPTION_LENGTH} chars (got ${trimmed.length})`,
      );
    }
    return new Description(trimmed);
  }

  isEmpty(): boolean {
    return this.value.length === 0;
  }

  equals(other: Description): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
