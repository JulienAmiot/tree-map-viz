import type { Node } from "../nodes/Node.js";

/**
 * `Card<N extends Node>` — v4 abstract visual wrapper hosting a Node
 * (SPEC §17.78; mirrors `<<abstract>> class Card~N~ { +N node;
 * +getNode() N }` in the v4 class diagram, with the
 * `Card~N~ <|-- TextCard / BusinessScoreCard~T~ / StrictRangeCard~T~`
 * inheritance arrows and `*-- "1" Node : node` composition).
 *
 * **Purely a visual-layer concept** — distinct from v3's `TextCard` /
 * `BusinessScoreCard` which were history-aggregates owning the
 * timestamped value sequence. In v4 history lives on
 * `HistorizableValueNode<T>` (§17.73) and objective lives on
 * `BusinessScoreNode<T>` (§17.76), so cards reduce to "thing that hosts
 * a Node for visual rendering". The generic argument `N` (bounded to
 * `Node` so the type system enforces the host contract) lets concrete
 * subclasses narrow the hosted-node type at the leaf level.
 *
 * `getNode()` is the diagram's authoritative read accessor (vs a JS
 * getter) so subclasses can override its return type via TS covariant-
 * return-narrowing — a TextCard's `getNode()` returns `TextNode`, a
 * BusinessScoreCard's returns `BusinessScoreNode<T>`, etc.
 *
 * No method overrides expected on concrete subclasses other than the
 * covariant-return-narrowing of `getNode()` — concretes are pure
 * "binding leaves" that pick `N` at instantiation, identical pattern
 * to §17.76 / §17.77's RangedValueNode subclasses.
 */
export abstract class Card<N extends Node> {
  protected constructor(readonly node: N) {}

  getNode(): N {
    return this.node;
  }
}
