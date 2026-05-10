import type { TextNodeV4 } from "../nodes/TextNodeV4.js";

import { Card } from "./Card.js";

/**
 * `TextCardV4` — v4 concrete visual card hosting a `TextNodeV4` (SPEC
 * §17.78; mirrors `class TextCard { +TextNode node; +getNode()
 * TextNode }` in the v4 class diagram with `Card~N~ <|-- TextCard`
 * binding `N = TextNode`).
 *
 * V4 suffix because v3 already owns `TextCard` as a history-aggregate
 * (`src/domain/nodes/TextCard.ts`) — same name, completely different
 * concern. V4's TextCard is purely a visual wrapper hosting a Node;
 * v3's TextCard was the timestamped string-history aggregate (now
 * absorbed into `HistorizableValueNode<string>` since §17.73). Suffix
 * drops at the v3-retirement strand once v3's TextCard is gone. The
 * v4 diagram's authoritative class name is `TextCard`.
 *
 * Pure "binding leaf" — no field overrides, no method overrides
 * beyond the covariant-return-narrowing of `getNode()` to `TextNodeV4`
 * (TS infers this automatically from the parent's `getNode(): N`
 * signature given `N = TextNodeV4`).
 */
export class TextCardV4 extends Card<TextNodeV4> {
  constructor(node: TextNodeV4) {
    super(node);
  }
}
