import type { Historizable } from "../capabilities/Historizable.js";
import { TimestampedValue } from "../values/TimestampedValue.js";

/**
 * Aggregate that owns the **string-typed** `TimestampedValue` history of a
 * `TextNode` (SPEC §3 + §17.14).
 *
 * Mirrors `BusinessScoreCard` for numeric histories: an internal array
 * kept sorted ascending by date so `latest = history.at(-1)`. The domain
 * surface only exposes a frozen copy via {@link history()}; mutation goes
 * through {@link addRecorded}.
 *
 * `TextNode` uses `TextCard` instead of `BusinessScoreCard` because a
 * text-typed metric has no `Unit` and no `Objective` — only the timestamped
 * record of what the operator wrote (and when). The aggregate stays small
 * on purpose: extending it with a unit / objective would conflate two
 * distinct domain concerns.
 */
export class TextCard implements Historizable<string> {
  private readonly historizedValues: TimestampedValue<string>[];

  private constructor(initial: readonly TimestampedValue<string>[]) {
    this.historizedValues = [...initial].sort(TimestampedValue.compareByDate);
  }

  static of(initialHistory: readonly TimestampedValue<string>[] = []): TextCard {
    return new TextCard(initialHistory);
  }

  history(): readonly TimestampedValue<string>[] {
    return Object.freeze([...this.historizedValues]);
  }

  addRecorded(tv: TimestampedValue<string>): void {
    const insertAt = this.firstIndexAfter(tv);
    this.historizedValues.splice(insertAt, 0, tv);
  }

  private firstIndexAfter(tv: TimestampedValue<string>): number {
    for (let i = 0; i < this.historizedValues.length; i++) {
      if (TimestampedValue.compareByDate(this.historizedValues[i]!, tv) > 0) {
        return i;
      }
    }
    return this.historizedValues.length;
  }
}
