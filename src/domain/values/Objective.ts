import { Timestamp } from "./Timestamp.js";

/**
 * `Objective<T>` value object (SPEC §17.76 / §17.114a; mirrors
 * `<<value>> class Objective~T~ { +Timestamp at; +T value }` in the
 * v4 class diagram; v3's same-name class retired at §17.112 Phase F).
 *
 * Shape delta vs v3: 3 fields (`initialValue`, `targetValue`,
 * `targetDate`) collapse to 2 (`at`, `value`). `initialValue` is
 * redundant in v4 (the parent `HistorizableValueNode<T>`'s first history
 * entry IS the initial value); the (target, by-when) pair becomes
 * (`value`, `at`) — same shape as `TimestampedValue<T>` but semantically
 * distinct (TV is a HISTORY entry, Objective is a GOAL entry).
 *
 * §17.114a drops the `V4` suffix (v3's same-name class is gone since
 * §17.112). Storage + accessor pattern mirrors `TimestampedValue<T>`
 * (§17.61) — `atMs: number` for fast compare; `at` getter rebuilds a
 * fresh Timestamp per call. Validation is at `Timestamp.of`.
 */
export class Objective<T> {
  private readonly atMs: number;

  private constructor(
    readonly value: T,
    atMs: number,
  ) {
    this.atMs = atMs;
  }

  static of<T>(value: T, at: Timestamp): Objective<T> {
    return new Objective<T>(value, at.moment.getTime());
  }

  get at(): Timestamp {
    return Timestamp.of(new Date(this.atMs));
  }

  equals(other: Objective<T>): boolean {
    return Object.is(this.value, other.value) && this.atMs === other.atMs;
  }
}
