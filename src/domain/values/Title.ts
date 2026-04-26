const MAX_TITLE_LENGTH = 120;

export class InvalidTitleError extends Error {
  constructor(reason: string) {
    super(`Invalid Title: ${reason}`);
    this.name = "InvalidTitleError";
  }
}

export class Title {
  private constructor(readonly value: string) {}

  static of(raw: string): Title {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new InvalidTitleError("must be non-empty after trim");
    }
    if (trimmed.length > MAX_TITLE_LENGTH) {
      throw new InvalidTitleError(
        `must be at most ${MAX_TITLE_LENGTH} chars (got ${trimmed.length})`,
      );
    }
    return new Title(trimmed);
  }

  equals(other: Title): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
