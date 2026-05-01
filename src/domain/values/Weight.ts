/**
 * `Weight` value object — a node's relative size in the squarified treemap.
 *
 * Domain rules (post-§17.31):
 *   - finite number (no `NaN`, no `Infinity`),
 *   - `MIN_WEIGHT <= value <= MAX_WEIGHT` inclusive,
 *   - **fractional values are allowed** (`0.5`, `1.25`, `7.3`, …).
 *
 * Pre-§17.31 the validator additionally required `Number.isInteger`. The
 * UI side has carried `step="0.5"` on its weight slider since §17.26 (so
 * the operator could already drag to `2.5`), but the domain rejected
 * anything non-integer at `Weight.of` — a silent UX trap the operator
 * only hit at confirm time. §17.31 reconciles the two by dropping the
 * integer check and bumping `MIN_WEIGHT` from `1` to `0.5`, the
 * smallest non-zero step the slider already advertises. The treemap
 * algorithm (`treemapSquarify`) consumes weights as raw ratios so it
 * doesn't care whether they're integral.
 *
 * The lower bound is **non-zero on purpose**: a weight of `0` would
 * collapse the tile to zero area which the layout cannot render, so
 * `0.5` is the minimum visible weight. The slider's pre-§17.31
 * `min="0"` was therefore a UX bug, also fixed in §17.31.
 */
const MIN_WEIGHT = 0.5;
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
    if (!Number.isFinite(raw)) {
      throw new InvalidWeightError(`must be a finite number (got ${raw})`);
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
