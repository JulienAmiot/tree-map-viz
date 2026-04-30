import type { Historizable } from "../capabilities/Historizable.js";
import type { NodeIdentity } from "../values/NodeIdentity.js";
import type { TimestampedValue } from "../values/TimestampedValue.js";
import type { Weight } from "../values/Weight.js";
import { EmptyHistoryError } from "./EmptyHistoryError.js";
import type { TextCard } from "./TextCard.js";
import { TreeNode } from "./TreeNode.js";

/**
 * `TextNode` — a free-form **string-typed** node (SPEC §3, refined in §17.14).
 *
 * Like `BusinessScoreCardNode`, a `TextNode` carries a timestamped history
 * (`TextCard`) — but its values are strings, not numbers. The displayed
 * "value" of a text node is the most recent string in its history; the
 * timestamp goes in the tile's bottom-right corner (§17.18) just like for BSC.
 *
 * What `TextNode` is **not**:
 *   - Not `ContributesToParent` — text values can never feed a parent's
 *     weighted-mean computation (only `BusinessScoreCardNode` is eligible).
 *     Compile-time-checked by `TextNode.test.ts` (`@ts-expect-error`).
 *   - Not `HasObjective` — a string value has no goal trajectory.
 *
 * What `TextNode` **is**:
 *   - `TreeNode<string>` — the abstract `currentValue()` returns a
 *     `TimestampedValue<string>`.
 *   - `Historizable<string>` — exposes the `TimestampedValue<string>[]`
 *     history of the underlying `TextCard`.
 */
export class TextNode extends TreeNode<string> implements Historizable<string> {
  constructor(
    id: string,
    identity: NodeIdentity,
    weight: Weight,
    readonly card: TextCard,
  ) {
    super(id, identity, weight);
  }

  history(): readonly TimestampedValue<string>[] {
    return this.card.history();
  }

  currentValue(): TimestampedValue<string> {
    const latest = this.card.history().at(-1);
    if (latest === undefined) {
      throw new EmptyHistoryError(this.id);
    }
    return latest;
  }
}
