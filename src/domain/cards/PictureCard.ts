import type { PictureNode } from "../nodes/PictureNode.js";

import { Card } from "./Card.js";

/**
 * `PictureCard` — v4 concrete visual card hosting a `PictureNode`
 * (SPEC §17.119; mirrors the `Card~N~ <|-- PictureCard` binding
 * pattern from `TextCard` / `BusinessScoreCard` / `WorkflowCard`).
 *
 * Pure binding leaf — no field overrides, no method overrides beyond
 * the covariant-return-narrowing of `getNode()` to `PictureNode` (TS
 * infers automatically from `Card<N>.getNode(): N`). The §17.100.5
 * `Tree.cards` sidecar map does NOT grow a slot for PictureCard:
 * the only per-picture data is the URL itself, which lives on the
 * node (no UI-only sidecar like the BSC `Unit`).
 */
export class PictureCard extends Card<PictureNode> {
  constructor(node: PictureNode) {
    super(node);
  }
}
