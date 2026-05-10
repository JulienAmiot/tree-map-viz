import type { BusinessScoreNode } from "../nodes/BusinessScoreNode.js";

import { Card } from "./Card.js";

/**
 * `BusinessScoreCardV4<T>` — v4 concrete visual card hosting a
 * `BusinessScoreNode<T>` (SPEC §17.78; mirrors `class
 * BusinessScoreCard~T~ { +BusinessScoreNode~T~ node; +getNode()
 * BusinessScoreNode~T~ }` in the v4 class diagram with `Card~N~ <|--
 * BusinessScoreCard~T~` binding `N = BusinessScoreNode<T>`).
 *
 * V4 suffix because v3 already owns `BusinessScoreCard` as a history-
 * aggregate (`src/domain/nodes/BusinessScoreCard.ts`) bundling
 * `Unit` + `Objective` + history — same name, completely different
 * concern. In v4 the history moved to `HistorizableValueNode<T>`
 * (§17.73), the objective moved to `BusinessScoreNode<T>` (§17.76 via
 * `ObjectiveV4<T>`), and the unit slot is currently absent from the
 * v4 diagram (deferred — the v4 diagram does not mark Unit on any
 * Node-side class; if v4 needs Unit it'll likely sit on a future Card
 * field, but the diagram doesn't pin that yet so this strand stays
 * minimal). Suffix drops at the v3-retirement strand. The v4 diagram's
 * authoritative class name is `BusinessScoreCard<T>`.
 *
 * Generic propagates `T` from the hosted node down to the card so
 * consumers reading `card.getNode().objective.value` get the right
 * type at every step.
 */
export class BusinessScoreCardV4<T> extends Card<BusinessScoreNode<T>> {
  constructor(node: BusinessScoreNode<T>) {
    super(node);
  }
}
