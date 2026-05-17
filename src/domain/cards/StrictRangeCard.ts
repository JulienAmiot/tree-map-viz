import type { StrictRangeNode } from "../nodes/StrictRangeNode.js";

import { Card } from "./Card.js";

/**
 * `StrictRangeCard<T>` — v4 concrete visual card hosting a
 * `StrictRangeNode<T>` (SPEC §17.78; mirrors `class StrictRangeCard~T~
 * { +StrictRangeNode~T~ node; +getNode() StrictRangeNode~T~ }` in the
 * v4 class diagram with `Card~N~ <|-- StrictRangeCard~T~` binding
 * `N = StrictRangeNode<T>`).
 *
 * NO V4 suffix — no v3 namesake (StrictRangeCard is a v4 invention,
 * matching the §17.77 StrictRangeNode<T> which is also a v4 invention;
 * v3 conflated strict + lenient semantics into the single
 * `BusinessScoreCardNode` / `BusinessScoreCard` pair). Ships under its
 * v4-final name directly.
 *
 * Pure "binding leaf" — same shape as TextCard / BusinessScoreCard,
 * differs only in the bound generic argument.
 */
export class StrictRangeCard<T> extends Card<StrictRangeNode<T>> {
  constructor(node: StrictRangeNode<T>) {
    super(node);
  }
}
