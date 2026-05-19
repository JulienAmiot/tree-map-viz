/**
 * `WorkflowStatus` — v4 value object describing one entry in a
 * board-level workflow-status table (SPEC §17.117). The four PDCA
 * defaults seeded on every new board live in
 * {@link DEFAULT_WORKFLOW_STATUSES} below; operators can later
 * extend / reorder / recolour them through the board-settings modal
 * (a follow-up strand — the data shape lands here so the persistence
 * envelope is already shaped right when the settings UI ships).
 *
 * Three fields:
 *
 *   - `id` — stable identifier referenced by `WorkflowNode.statusId`.
 *     Lowercase ASCII slug ([a-z0-9_-]+). Choosing a slug here rather
 *     than relying on the human-visible `label` means renaming the
 *     status label on a board does NOT invalidate every WorkflowNode
 *     that already references it.
 *   - `label` — the operator-visible display text rendered inside the
 *     status badge (e.g. "PLAN", "DO"). Trimmed; non-empty.
 *   - `color` — CSS colour string used as both the badge border AND
 *     text colour (background stays transparent per §17.117 / the
 *     operator's "colored label button" requirement). Anything the
 *     browser accepts in a `color:` declaration is valid here; we
 *     keep it as an opaque string so a future "operator picks any
 *     hex / named colour" flow does not need to revisit this VO.
 *
 * Static factory `WorkflowStatus.of(id, label, color)` is the only
 * constructor surface (matches the `Unit.of` / `Timestamp.of`
 * convention) — keeps validation in one place and stops adapters
 * from instantiating with the `new` keyword.
 */

export class InvalidWorkflowStatusError extends Error {
  constructor(reason: string) {
    super(`Invalid WorkflowStatus: ${reason}`);
    this.name = "InvalidWorkflowStatusError";
  }
}

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export class WorkflowStatus {
  private constructor(
    readonly id: string,
    readonly label: string,
    readonly color: string,
  ) {}

  static of(id: string, label: string, color: string): WorkflowStatus {
    if (typeof id !== "string" || !ID_PATTERN.test(id)) {
      throw new InvalidWorkflowStatusError(
        `id must be a lowercase slug matching ${ID_PATTERN}; got ${JSON.stringify(id)}`,
      );
    }
    const trimmedLabel = typeof label === "string" ? label.trim() : "";
    if (trimmedLabel.length === 0) {
      throw new InvalidWorkflowStatusError(
        `label must be a non-empty trimmed string; got ${JSON.stringify(label)}`,
      );
    }
    const trimmedColor = typeof color === "string" ? color.trim() : "";
    if (trimmedColor.length === 0) {
      throw new InvalidWorkflowStatusError(
        `color must be a non-empty CSS colour string; got ${JSON.stringify(color)}`,
      );
    }
    return new WorkflowStatus(id, trimmedLabel, trimmedColor);
  }

  equals(other: WorkflowStatus): boolean {
    return (
      this.id === other.id &&
      this.label === other.label &&
      this.color === other.color
    );
  }
}

/**
 * Per-board default workflow-status table — the PDCA cycle (Plan-Do-
 * Check-Act). Every new `Board` is seeded with this table; the
 * §17.117 LSR v2 → v3 envelope migration also fills it in for boards
 * that pre-date the workflow strand. The colours target the kiosk's
 * dark theme — saturated mid-tones that read crisp at the badge's
 * ~1.15vh font-size, with PLAN sitting in a neutral grey so a "not
 * yet started" item reads as muted next to the three active phases.
 */
export const DEFAULT_WORKFLOW_STATUSES: readonly WorkflowStatus[] =
  Object.freeze([
    WorkflowStatus.of("plan", "PLAN", "rgb(161, 161, 170)"),
    WorkflowStatus.of("do", "DO", "rgb(59, 130, 246)"),
    WorkflowStatus.of("check", "CHECK", "rgb(34, 197, 94)"),
    WorkflowStatus.of("act", "ACT", "rgb(217, 119, 6)"),
  ]);

/**
 * The status id every freshly-built `WorkflowNode` adopts when no
 * explicit id is supplied (e.g. the Add-child modal's default
 * dropdown selection). Lands on `plan` because new workflow items
 * start in the planning phase before any work happens — picking
 * `plan` rather than the first PDCA entry in `DEFAULT_WORKFLOW_STATUSES`
 * (which happens to be `plan` today) is deliberate: a future strand
 * that reorders the defaults won't quietly change what "default" means.
 */
export const DEFAULT_WORKFLOW_STATUS_ID = "plan";
