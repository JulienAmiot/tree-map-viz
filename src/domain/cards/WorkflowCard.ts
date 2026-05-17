import type { WorkflowNode } from "../nodes/WorkflowNode.js";

import { Card } from "./Card.js";

/**
 * `WorkflowCard` — v4 concrete visual card hosting a `WorkflowNode`
 * (SPEC §17.117; mirrors the `Card~N~ <|-- WorkflowCard` binding
 * pattern from `TextCard` / `BusinessScoreCard` / `StrictRangeCard`).
 *
 * Pure binding leaf — no field overrides, no method overrides beyond
 * the covariant-return-narrowing of `getNode()` to `WorkflowNode` (TS
 * infers automatically from `Card<N>.getNode(): N`). Sidecar card
 * registry storage stays unchanged: the §17.100.5 `Tree.cards` map
 * holds visual-only sidecar data (Unit for BSCs) and does NOT need
 * to grow a slot for WorkflowCard — the workflow status reference
 * lives on the node itself per §17.117 (board-level status table is
 * the only out-of-tree concern, and that lives on the `Board`, not
 * on the per-node `Card`).
 */
export class WorkflowCard extends Card<WorkflowNode> {
  constructor(node: WorkflowNode) {
    super(node);
  }
}
