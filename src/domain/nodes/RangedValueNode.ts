import type { Clock } from "../capabilities/Clock.js";
import type { Range } from "../values/Range.js";
import type { Timestamp } from "../values/Timestamp.js";
import type { Weight } from "../values/Weight.js";

import { HistorizableValueNode } from "./HistorizableValueNode.js";

/**
 * `RangedValueNode<T>` — v4 abstract history-aware node bounded by a
 * `Range<T>` (SPEC §17.75; mirrors `<<abstract>> class RangedValueNode~T~`
 * in the v4 class diagram, with `HistorizableValueNode~T~ <|--
 * RangedValueNode~T~`). `RangedValueNode` IS a `HistorizableValueNode`
 * (it inherits the full history surface — entries / setValue / addValue
 * / removeValue / getValue) and additionally enforces a value-domain
 * constraint via the §17.71 `Range<T>` hierarchy.
 *
 * The single new behaviour vs the parent: the `addValue(t, v)`
 * override calls `this.range.requireValue(v)` BEFORE delegating to
 * `super.addValue(t, v)`. That delegation step is what populates the
 * history; the requireValue gate is what makes the strand range-aware.
 * Concrete subclasses choose between StrictRange (throws
 * `OutOfRangeError` on out-of-range writes per §17.71) and LenientRange
 * (silently accepts; `requireValue` is a no-op). The inherited
 * `setValue(v)` does NOT need a parallel override — its body is
 * `this.addValue(this._clock.now(), v)` which now resolves to the
 * overridden form by virtual dispatch, so setValue ALSO propagates the
 * range check. This is the subtle but valuable consequence of using a
 * single overridden choke-point: every entry-creating path (whether
 * the caller went through setValue or addValue) is guaranteed to pass
 * through requireValue exactly once.
 *
 * The `range` field is exposed as a public readonly (per the v4
 * diagram's `+Range~T~ range` slot) so consumers + tests can introspect
 * it. Reference equality is the binding model (Range subclasses use
 * private constructors + static `of(...)` factories per §17.71, so
 * `range1 === range2` iff both consumers got the same factory output).
 *
 * No v3 namesake — `RangedValueNode<T>` ships under its v4-final
 * name (no V4 suffix needed, unlike §17.74's `TextNodeV4`).
 */
export abstract class RangedValueNode<T> extends HistorizableValueNode<T> {
  protected constructor(
    id: string,
    title: string,
    weight: Weight,
    description: string,
    clock: Clock,
    readonly range: Range<T>,
  ) {
    super(id, title, weight, description, clock);
  }

  override addValue(timestamp: Timestamp, value: T): void {
    this.range.requireValue(value);
    super.addValue(timestamp, value);
  }
}
