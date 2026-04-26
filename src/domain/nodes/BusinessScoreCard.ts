import type { Historizable } from "../capabilities/Historizable.js";
import type { Objective } from "../values/Objective.js";
import { TimestampedValue } from "../values/TimestampedValue.js";
import type { Unit } from "../values/Unit.js";

export class BusinessScoreCard<T> implements Historizable<T> {
  private readonly historizedValues: TimestampedValue<T>[];

  private constructor(
    readonly unit: Unit,
    readonly objective: Objective<T>,
    initial: readonly TimestampedValue<T>[],
  ) {
    this.historizedValues = [...initial].sort(TimestampedValue.compareByDate);
  }

  static of<T>(
    unit: Unit,
    objective: Objective<T>,
    initialHistory: readonly TimestampedValue<T>[] = [],
  ): BusinessScoreCard<T> {
    return new BusinessScoreCard<T>(unit, objective, initialHistory);
  }

  history(): readonly TimestampedValue<T>[] {
    return Object.freeze([...this.historizedValues]);
  }

  addRecorded(tv: TimestampedValue<T>): void {
    const insertAt = this.firstIndexAfter(tv);
    this.historizedValues.splice(insertAt, 0, tv);
  }

  private firstIndexAfter(tv: TimestampedValue<T>): number {
    for (let i = 0; i < this.historizedValues.length; i++) {
      if (TimestampedValue.compareByDate(this.historizedValues[i]!, tv) > 0) {
        return i;
      }
    }
    return this.historizedValues.length;
  }
}
