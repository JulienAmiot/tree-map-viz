import type { Clock } from "../capabilities/Clock.js";
import type { Weight } from "../values/Weight.js";

import { HistorizableValueNode } from "./HistorizableValueNode.js";

/**
 * `TextNodeV4` — v4 concrete text-typed node (SPEC §17.74; mirrors
 * `class TextNode { +getValue() String }` in the v4 class diagram, with
 * `HistorizableValueNode~T~ <|-- TextNode` binding `T = string`). The
 * v4 successor to v3's `TextNode` (`src/domain/nodes/TextNode.ts`).
 *
 * The class name carries a temporary `V4` suffix because v3's
 * `TextNode` already owns the `TextNode` filename + class name and the
 * strict-additive precedent from §17.72 / §17.73 forbids touching v3
 * files. The suffix drops at the eventual v3-retirement strand (a
 * single rename + import-path updates change, no logic delta). The
 * v4 diagram's authoritative class name is `TextNode`.
 *
 * Two structural traits per the diagram:
 *
 *   - **Trivial `getValue()`** — inherited verbatim from
 *     `HistorizableValueNode<string>`'s most-recent-entry tail-read.
 *     No override needed; the v4 diagram's `+getValue() String` slot
 *     on `TextNode` is the inherited concrete impl from the parent
 *     (which already provides the tail-read logic + EmptyHistoryError
 *     on empty history per §17.73). Subtle but intentional: the
 *     diagram redeclares `getValue() T → String` on `TextNode` to
 *     make the bound generic explicit at the leaf level, NOT to
 *     introduce a new override.
 *
 *   - **Polymorphic `getDescription()` override** — returns
 *     `this.getValue()` rather than the parent's `_description` slot.
 *     Implements SPEC §17.15: "the current value IS the description
 *     for a text card — the underlying NodeIdentity.description is
 *     always empty for TextNode (and the modal omits the field), so
 *     the same string is never collected/displayed twice." In v4
 *     this becomes a clean polymorphic dispatch: TextNode's rendered
 *     description = its value, BusinessScoreNode's rendered
 *     description = its description field. Consumers (UI card view,
 *     viewModelMapper) call `node.getDescription()` uniformly without
 *     branching on node kind. The `_description` field inherited from
 *     `ValueNode<string>` (§17.72) stays empty by convention for
 *     TextNodeV4 instances; the constructor accepts only id / title
 *     / weight / clock — description is hard-wired to `""`.
 *
 * Because `getDescription()` ignores the parent's `_description`
 * slot, the constructor doesn't expose a `description` parameter:
 * passing one would be misleading (the field is shadowed by the
 * override anyway). `setDescription()` inherited from ValueNode
 * stays accessible for completeness but has no rendering effect on
 * a TextNodeV4; this is the v4-correct shape (the diagram's
 * `<|-- TextNode` arrow doesn't introduce a description field on
 * TextNode itself).
 */
export class TextNodeV4 extends HistorizableValueNode<string> {
  constructor(id: string, title: string, weight: Weight, clock: Clock) {
    super(id, title, weight, "", clock);
  }

  override getDescription(): string {
    return this.getValue();
  }
}
