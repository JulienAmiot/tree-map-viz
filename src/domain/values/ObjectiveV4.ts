import { Timestamp } from "./Timestamp.js";

/**
 * `ObjectiveV4<T>` value object — v4 redesign of v3's `Objective<T>`
 * (SPEC §17.76; mirrors `<<value>> class Objective~T~ { +Timestamp at;
 * +T value }` in the v4 class diagram).
 *
 * Shape delta vs v3: 3 fields (`initialValue`, `targetValue`,
 * `targetDate`) collapse to 2 (`at`, `value`). `initialValue` is
 * redundant in v4 (the parent `HistorizableValueNode<T>`'s first history
 * entry IS the initial value); the (target, by-when) pair becomes
 * (`value`, `at`) — same shape as `TimestampedValue<T>` but semantically
 * distinct (TV is a HISTORY entry, Objective is a GOAL entry).
 *
 * Class name carries a temporary `V4` suffix because v3's `Objective`
 * still owns the unsuffixed name (precedent: `TextNodeV4` §17.74). Suffix
 * drops at the v3-retirement strand. Storage + accessor pattern mirrors
 * `TimestampedValue<T>` (§17.61) — `atMs: number` for fast compare; `at`
 * getter rebuilds a fresh Timestamp per call. Validation is at
 * `Timestamp.of`.
 */
export class ObjectiveV4<T> {
  private readonly atMs: number;

  private constructor(
    readonly value: T,
    atMs: number,
  ) {
    this.atMs = atMs;
  }

  static of<T>(value: T, at: Timestamp): ObjectiveV4<T> {
    return new ObjectiveV4<T>(value, at.moment.getTime());
  }

  get at(): Timestamp {
    return Timestamp.of(new Date(this.atMs));
  }

  equals(other: ObjectiveV4<T>): boolean {
    return Object.is(this.value, other.value) && this.atMs === other.atMs;
  }
}
