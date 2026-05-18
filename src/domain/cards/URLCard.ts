import type { URLNode } from "../nodes/URLNode.js";

import { Card } from "./Card.js";

/**
 * `URLCard` — v4 concrete visual card hosting a `URLNode`
 * (SPEC §17.120; mirrors the `Card~N~ <|-- URLCard` binding pattern
 * from `TextCard` / `BusinessScoreCard` / `PictureCard` / `WorkflowCard`).
 *
 * Pure binding leaf — no field overrides, no method overrides beyond
 * the covariant-return-narrowing of `getNode()` to `URLNode` (TS
 * infers automatically from `Card<N>.getNode(): N`). The §17.100.5
 * `Tree.cards` sidecar map does NOT grow a slot for URLCard: the URL
 * itself lives on the node (in the description slot per the §17.120
 * "URL is in the description" contract), and the QR rendering is a
 * pure derivation at view time (no per-card UI-only sidecar like the
 * BSC `Unit`).
 */
export class URLCard extends Card<URLNode> {
  constructor(node: URLNode) {
    super(node);
  }
}
