import type { BusinessScoreNode } from "../nodes/BusinessScoreNode.js";
import type { Unit } from "../values/Unit.js";

import { Card } from "./Card.js";

/**
 * `BusinessScoreCard<T>` — v4 concrete visual card hosting a
 * `BusinessScoreNode<T>` (SPEC §17.78 + §17.100.5; mirrors `class
 * BusinessScoreCard~T~ { +BusinessScoreNode~T~ node; +Unit unit;
 * +getNode() BusinessScoreNode~T~; +getUnit() Unit }` in the v4 class
 * diagram with `Card~N~ <|-- BusinessScoreCard~T~` binding `N =
 * BusinessScoreNode<T>`).
 *
 * V4 suffix retired at §17.114b — v3 used to own `BusinessScoreCard`
 * as a history-aggregate (`src/domain/nodes/BusinessScoreCard.ts`) bundling
 * `Unit` + `Objective` + history — same name, completely different
 * concern. In v4 history moved to `HistorizableValueNode<T>` (§17.73),
 * objective moved to `BusinessScoreNode<T>` (§17.76 via `Objective`),
 * and **unit lifts onto this card at §17.100.5** (the final resolution
 * of §17.80 D1; §17.91 parked unit on BSN as a band-aid until cards
 * were wired into the read path). The v3-bridge adapter
 * `v4TreeFromV3Root` produced a `BusinessScoreCardV4` for every v3
 * BSC with a non-empty unit; the §17.91 BSN `unit` getter survived
 * as the legacy fallback for any BSN constructed without a card (e.g.
 * via §17.100a/b `AddChildServiceV4`) until §17.112 Phase F deleted it.
 *
 * Generic propagates `T` from the hosted node so consumers reading
 * `card.getNode().objective.value` get the right type at every step.
 */
export class BusinessScoreCard<T> extends Card<BusinessScoreNode<T>> {
  unit: Unit;

  constructor(node: BusinessScoreNode<T>, unit: Unit) {
    super(node);
    this.unit = unit;
  }

  getUnit(): Unit {
    return this.unit;
  }

  /** §17.101a — operator-facing mutator for `EditNodeServiceV4`. */
  setUnit(unit: Unit): void {
    this.unit = unit;
  }
}
