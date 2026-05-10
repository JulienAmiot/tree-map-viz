import type { Clock } from "../capabilities/Clock.js";
import type { StrictRange } from "../values/Range.js";
import type { Weight } from "../values/Weight.js";

import { RangedValueNode } from "./RangedValueNode.js";

/**
 * `StrictRangeNode<T>` — v4 concrete range-bounded historicised node
 * whose values MUST stay within a strict closed interval (SPEC §17.77;
 * mirrors `class StrictRangeNode~T~ { +StrictRange~T~ range }` in the v4
 * class diagram, with `RangedValueNode~T~ <|-- StrictRangeNode~T~`
 * inheritance and `*-- "1" StrictRange~T~ : range` composition).
 *
 * Symmetric sister of §17.76's `BusinessScoreNode<T>` but stricter and
 * slimmer: (a) `range` field type-narrowed to `StrictRange<T>` (vs
 * BusinessScoreNode's `LenientRange<T>`) via TS `declare readonly range:
 * StrictRange<T>`, so the inherited choke-point in
 * `RangedValueNode<T>.addValue` resolves to `StrictRange.requireValue`
 * which throws `OutOfRangeError` on out-of-range writes (per §17.71);
 * (b) NO `objective` slot — the diagram only declares `+StrictRange<T>
 * range` on this class. A StrictRangeNode is a "value-must-stay-in-
 * range" node (e.g. response-time SLO, saturation level, percentage)
 * NOT a goal-tracked node; objectives are reserved for BusinessScoreNode.
 *
 * NO V4 suffix — no v3 namesake (StrictRangeNode is a v4 invention).
 * Concrete, not abstract per the diagram: public constructor, clients
 * instantiate directly.
 *
 * Pure "binding leaf" with NO method overrides — picks the range type,
 * behaviour comes entirely from the 5-layer inheritance chain (Node →
 * ValueNode → HistorizableValueNode → RangedValueNode → StrictRangeNode).
 */
export class StrictRangeNode<T> extends RangedValueNode<T> {
  declare readonly range: StrictRange<T>;

  constructor(
    id: string,
    title: string,
    weight: Weight,
    description: string,
    clock: Clock,
    range: StrictRange<T>,
  ) {
    super(id, title, weight, description, clock, range);
  }
}
