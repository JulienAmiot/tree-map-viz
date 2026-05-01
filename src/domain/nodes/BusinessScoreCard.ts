import type { Historizable } from "../capabilities/Historizable.js";
import type { Objective } from "../values/Objective.js";
import { TimestampedValue } from "../values/TimestampedValue.js";
import type { Unit } from "../values/Unit.js";

export class BusinessScoreCard<T> implements Historizable<T> {
  private readonly historizedValues: TimestampedValue<T>[];
  private _unit: Unit;
  private _objective: Objective<T>;

  private constructor(
    unit: Unit,
    objective: Objective<T>,
    initial: readonly TimestampedValue<T>[],
  ) {
    this._unit = unit;
    this._objective = objective;
    this.historizedValues = [...initial].sort(TimestampedValue.compareByDate);
  }

  static of<T>(
    unit: Unit,
    objective: Objective<T>,
    initialHistory: readonly TimestampedValue<T>[] = [],
  ): BusinessScoreCard<T> {
    return new BusinessScoreCard<T>(unit, objective, initialHistory);
  }

  /**
   * `unit` / `objective` are exposed via getters so the §17.28 edit flow
   * can swap them through dedicated setters. The Unit and Objective
   * value objects themselves remain immutable; the card just changes
   * which reference it holds. History sequence is preserved across the
   * swap (editing the unit doesn't reset the history).
   */
  get unit(): Unit {
    return this._unit;
  }

  get objective(): Objective<T> {
    return this._objective;
  }

  setUnit(unit: Unit): void {
    this._unit = unit;
  }

  setObjective(objective: Objective<T>): void {
    this._objective = objective;
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
