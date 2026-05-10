import type { Clock } from "../capabilities/Clock.js";
import type { ObjectiveV4 } from "../values/ObjectiveV4.js";
import type { LenientRange } from "../values/Range.js";
import type { Weight } from "../values/Weight.js";

import { RangedValueNode } from "./RangedValueNode.js";

/**
 * `BusinessScoreNode<T>` — v4 concrete range-bounded historicised node
 * with a single goal-point Objective (SPEC §17.76; mirrors
 * `class BusinessScoreNode~T~ { +LenientRange~T~ range;
 * +Objective~T~ objective }` in the v4 class diagram, with
 * `RangedValueNode~T~ <|-- BusinessScoreNode~T~` inheritance and
 * composition edges to LenientRange<T> + ObjectiveV4<T>).
 *
 * v4 successor to v3's `BusinessScoreCardNode` — different name (note
 * `Card` infix in v3), so NO `V4` suffix; ships under its v4-final name.
 * Inherits the full 5-layer abstract chain (Node → ValueNode →
 * HistorizableValueNode → RangedValueNode → BusinessScoreNode); pure
 * "binding leaf" with NO method overrides — picks the range type,
 * exposes objective, behaviour comes entirely from the chain.
 *
 *   - **`range` narrowed to `LenientRange<T>`** via TS `declare` — type
 *     only, storage stays on the parent slot. Lenient because business
 *     scores legitimately fall outside their display corridor (stretch
 *     above max, dip below min); record-keeping accepts verbatim,
 *     `requireValue` is a no-op per §17.71. `range.contains(v)` still
 *     answers truthfully — the gate is opt-in, not silent rejection.
 *
 *   - **`objective: ObjectiveV4<T>`** as public `readonly` per the
 *     `*-- "1" Objective<T>` composition edge. Mandatory (a score node
 *     without a goal is a category error). v3 stored it on a separate
 *     `BusinessScoreCard` companion (`BusinessScoreCardNode.card`); v4
 *     hoists it onto the node directly, dissolving the v3 Card layer.
 *
 * Concrete (not abstract per the diagram): public constructor, clients
 * `new BusinessScoreNode<T>(...)` directly.
 */
export class BusinessScoreNode<T> extends RangedValueNode<T> {
  declare readonly range: LenientRange<T>;

  constructor(
    id: string,
    title: string,
    weight: Weight,
    description: string,
    clock: Clock,
    range: LenientRange<T>,
    readonly objective: ObjectiveV4<T>,
  ) {
    super(id, title, weight, description, clock, range);
  }
}
