import type { TextNode } from "../nodes/TextNode.js";

import { Card } from "./Card.js";

/**
 * `TextCard` — v4 concrete visual card hosting a `TextNode` (SPEC
 * §17.78; mirrors `class TextCard { +TextNode node; +getNode()
 * TextNode }` in the v4 class diagram with `Card~N~ <|-- TextCard`
 * binding `N = TextNode`).
 *
 * V4 suffix retired at §17.114b — v3's same-name `TextCard` (a
 * history-aggregate at `src/domain/nodes/TextCard.ts`) — same name,
 * completely different concern. V4's TextCard is purely a visual wrapper hosting a Node;
 * v3's TextCard was the timestamped string-history aggregate (now
 * absorbed into `HistorizableValueNode<string>` since §17.73). Suffix
 * dropped at §17.114b after §17.112 Phase F retired v3's TextCard. The
 * v4 diagram's authoritative class name is `TextCard`.
 *
 * Pure "binding leaf" — no field overrides, no method overrides
 * beyond the covariant-return-narrowing of `getNode()` to `TextNode`
 * (TS infers this automatically from the parent's `getNode(): N`
 * signature given `N = TextNode`).
 */
export class TextCard extends Card<TextNode> {
  constructor(node: TextNode) {
    super(node);
  }
}
