import type { Clock } from "../capabilities/Clock.js";
import type { Weight } from "../values/Weight.js";

import { TextNode } from "./TextNode.js";

/**
 * `WorkflowNode` — v4 concrete text-typed node carrying a board-level
 * workflow-status reference (SPEC §17.117).
 *
 * Inherits the full `TextNode` surface (`HistorizableValueNode<string>`
 * value + history + `getDescription() === getValue()` polymorphism)
 * and adds a single mutable `statusId: string` field referencing one
 * entry of the focused `Board.workflowStatuses` table. The id is a
 * stable slug rather than a colour or label so renaming / recolouring
 * a status at the board level never orphans the nodes that reference
 * it (a re-styled "DO" status keeps its `id: "do"`; only `label` and
 * `color` change).
 *
 * §17.117 status-label policy:
 *
 *   - The status id is the SOURCE OF TRUTH. The view layer resolves
 *     the id against the focused board's status table at map time to
 *     bake a `{ label, color }` pair into the VM. The node itself
 *     stores ONLY the id; label + colour never enter the domain.
 *   - A WorkflowNode whose `statusId` references a status that no
 *     longer exists on the board (e.g. operator deleted it before
 *     migrating downstream nodes) is NOT invalidated here at the
 *     domain layer. The mapper falls back to a neutral
 *     ALL-CAPS rendering of the id with a muted grey colour so the
 *     tile still renders. Garbage-collecting orphaned ids belongs
 *     to a future board-settings strand.
 *   - The status is independent of the `value` history. Changing the
 *     status does NOT append a history entry on the value-history
 *     timeline; status transitions are a per-board lightweight signal
 *     rather than a timestamped value series. A future strand may add
 *     a separate status-history slot if operator feedback motivates
 *     it; for now `setStatusId` is a plain mutating setter.
 *
 * Architecturally `WorkflowNode` is a *sibling-by-extension* of
 * `TextNode`: every WorkflowNode IS-A TextNode in the JS class
 * hierarchy, but persistence + view + service layers treat it as a
 * distinct kind (separate wire `kind`, separate `WorkflowNodeViewModel`,
 * separate `AddChildPayload` / `EditNodePayload` variant). The
 * `instanceof` order in encoders, the view-model mapper, and main.ts'
 * `inferV4Kind` therefore MUST place WorkflowNode BEFORE TextNode so
 * the more-specific kind wins over the generic catch-all.
 */
export class WorkflowNode extends TextNode {
  private _statusId: string;

  constructor(
    id: string,
    title: string,
    weight: Weight,
    clock: Clock,
    statusId: string,
  ) {
    super(id, title, weight, clock);
    this._statusId = WorkflowNode.normaliseStatusId(statusId);
  }

  get statusId(): string {
    return this._statusId;
  }

  setStatusId(statusId: string): void {
    this._statusId = WorkflowNode.normaliseStatusId(statusId);
  }

  private static normaliseStatusId(raw: string): string {
    if (typeof raw !== "string") {
      throw new Error(
        `WorkflowNode.statusId must be a string; got ${typeof raw}`,
      );
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new Error("WorkflowNode.statusId cannot be empty");
    }
    return trimmed;
  }
}
