import type { Clock } from "../capabilities/Clock.js";
import type { Timestamp } from "../values/Timestamp.js";
import { TimestampedValue } from "../values/TimestampedValue.js";
import type { Weight } from "../values/Weight.js";

import { EmptyHistoryError } from "./EmptyHistoryError.js";
import { ValueNode } from "./ValueNode.js";

/**
 * Thrown by `HistorizableValueNode<T>.removeValue(t)` when no entry in
 * the node's history has a timestamp matching `t` (SPEC §17.73; mirrors
 * the v4 class diagram's `removeValue(Timestamp t) -> TimestampNotFoundError`
 * error edge). Co-located with the only thrower for the same reason
 * `OutOfRangeError` lives in `Range.ts` (§17.71).
 */
export class TimestampNotFoundError extends Error {
  constructor(nodeId: string, timestampMs: number) {
    super(
      `Node "${nodeId}" has no history entry at timestamp ${timestampMs} (ms since epoch)`,
    );
    this.name = "TimestampNotFoundError";
  }
}

/**
 * `HistorizableValueNode<T>` — v4 abstract value-bearing node with a
 * timestamped history slot (SPEC §17.73; mirrors `<<abstract>> class
 * HistorizableValueNode~T~ extends ValueNode~T~` in the v4 class
 * diagram). First real consumer of the §17.57 Clock port + §17.58
 * Timestamp / §17.61 TimestampedValue value objects; after §17.72
 * wired the top two layers (Node + ValueNode<T>), this strand brings
 * the history-aware abstract online.
 *
 * Composition (per the v4 diagram):
 *
 *   - `_clock: Clock` injected at construction (`..> Clock : injected
 *     at construction` in the diagram). Tests stub it as
 *     `{ now: () => fixed }` — see §17.57's docblock for the canonical
 *     pattern. Production code wires the real-clock impl in the
 *     composition root.
 *
 *   - `_history: TimestampedValue<T>[]` (`o-- "0..*" TimestampedValue~T~`
 *     in the diagram). Kept sorted ascending by timestamp so that the
 *     most-recent entry is always the last one — `getValue()` is then
 *     a constant-time tail read instead of a per-call max-by-timestamp
 *     scan, and `entries()` returns the canonical chronological order
 *     consumers (UI history view, JSON codec) expect.
 *
 * `getValue()` provides the concrete impl of the abstract slot
 * declared on `ValueNode<T>` (§17.72). It returns the value of the
 * most-recent entry and throws `EmptyHistoryError` if the history is
 * empty. The error class is the v3 one (already used by both
 * `BusinessScoreCardNode` and `TextNode`); reusing it lets future
 * `instanceof`-based recovery in the application + UI layers ignore
 * which v3-vs-v4 subclass produced the empty-history condition.
 *
 * `setValue(v)` appends a new `TimestampedValue<T>` stamped at
 * `clock.now()` — the convenient overload that doesn't require the
 * caller to obtain a Timestamp. `addValue(t, v)` is the explicit
 * overload for callers that already hold a Timestamp (e.g. JSON
 * codec restoring history); both keep the history sorted via a
 * single insertion-point binary search rather than a re-sort, so
 * the sorted invariant is maintained in O(log n) compares + O(n)
 * splice. `removeValue(t)` removes the entry whose timestamp's
 * `momentMs` matches `t.moment.getTime()` exactly, and throws
 * `TimestampNotFoundError` if no such entry exists — strict-by-
 * default since the diagram does not show a "best-effort" remove.
 */
export abstract class HistorizableValueNode<T> extends ValueNode<T> {
  private readonly _clock: Clock;
  private readonly _history: TimestampedValue<T>[] = [];

  protected constructor(
    id: string,
    title: string,
    weight: Weight,
    description: string,
    clock: Clock,
  ) {
    super(id, title, weight, description);
    this._clock = clock;
  }

  entries(): readonly TimestampedValue<T>[] {
    return Object.freeze([...this._history]);
  }

  getValue(): T {
    if (this._history.length === 0) {
      throw new EmptyHistoryError(this.id);
    }
    return this._history[this._history.length - 1].value;
  }

  setValue(value: T): void {
    this.addValue(this._clock.now(), value);
  }

  addValue(timestamp: Timestamp, value: T): void {
    const entry = TimestampedValue.of(value, timestamp);
    const index = this.findInsertionIndex(entry);
    this._history.splice(index, 0, entry);
  }

  removeValue(timestamp: Timestamp): void {
    const targetMs = timestamp.moment.getTime();
    const index = this._history.findIndex(
      (entry) => entry.asOf.moment.getTime() === targetMs,
    );
    if (index === -1) {
      throw new TimestampNotFoundError(this.id, targetMs);
    }
    this._history.splice(index, 1);
  }

  private findInsertionIndex(entry: TimestampedValue<T>): number {
    let low = 0;
    let high = this._history.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (TimestampedValue.compareByDate(this._history[mid], entry) <= 0) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }
}
