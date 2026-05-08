import { BusinessScoreCardNode } from "../domain/nodes/BusinessScoreCardNode.js";
import { TextNode } from "../domain/nodes/TextNode.js";
import type { TreeNode } from "../domain/nodes/TreeNode.js";
import { Description } from "../domain/values/Description.js";
import { NodeIdentity } from "../domain/values/NodeIdentity.js";
import { Objective } from "../domain/values/Objective.js";
import { TimestampedValue } from "../domain/values/TimestampedValue.js";
import { Title } from "../domain/values/Title.js";
import { Unit } from "../domain/values/Unit.js";
import { Weight } from "../domain/values/Weight.js";

import type { Persister } from "./AddChildService.js";
import type { Clock } from "./ports/Clock.js";

/**
 * Plain-data payload from the Edit-node modal (SPEC §17.28).
 *
 * Mirrors `AddChildPayload`'s shape on a per-kind basis but with **all
 * fields optional**: an "edit" flow is a partial update — the operator
 * may change just the title and leave weight / description / … alone.
 * The service applies whatever fields are present.
 *
 * Two design choices encoded here:
 *
 * 1. **Kind is required and must match the node's existing kind.** A
 *    node can't be morphed from `TextNode` into `BusinessScoreCardNode`
 *    in place — the underlying card aggregates differ structurally
 *    (`TextCard<string>` vs `BusinessScoreCard<number>`). The service
 *    rejects a kind-mismatch with an `Outcome.ok=false`.
 * 2. **History is not editable through this payload.** The latest value
 *    is appended via the dedicated {@link EditNodeService.appendValue}
 *    seam (driven by the inline value-edit on the focused panel, also
 *    §17.28). Keeping the modal scoped to "fields" and the inline edit
 *    scoped to "values" prevents the two flows from racing each other
 *    on the same domain mutation.
 */
export type EditNodePayload =
  | {
      readonly kind: "TextNode";
      readonly title?: string;
      readonly weight?: number;
    }
  | {
      readonly kind: "BusinessScoreCardNode";
      readonly title?: string;
      readonly description?: string;
      readonly weight?: number;
      readonly unit?: string;
      readonly objective?: {
        readonly initialValue: number;
        readonly targetValue: number;
        readonly targetDate: Date;
      };
      readonly computed?: boolean;
      readonly eligibleForParentComputation?: boolean;
    };

type Outcome =
  | { readonly ok: true; readonly node: TreeNode<unknown> }
  | { readonly ok: false; readonly reason: string };

/**
 * Application service: applies a partial edit payload to an existing
 * node, persists, and rolls back on failure (SPEC §17.28).
 *
 * Two methods:
 *  - {@link editFields} — modal flow: change any subset of the
 *    operator-editable fields (title, weight, description, unit,
 *    objective, computed flags). History is preserved untouched.
 *  - {@link appendValue} — inline value-edit flow: append a new
 *    `TimestampedValue` to the node's history. Type matches the node
 *    kind (`string` for TextNode, `number` for BusinessScoreCardNode).
 *
 * Persistence + rollback: same contract as `AddChildService`. The
 * service captures the pre-edit state of every field it touches so a
 * persister failure restores the in-memory tree to exactly what it was
 * before the call. The rollback is field-level, not full-node, so a
 * concurrent edit on a different field of the same node would not be
 * undone (the kiosk is single-operator so this isn't a real risk; the
 * documentation pins it as a known limitation).
 */
export class EditNodeService {
  /**
   * SPEC §17.57 — `Clock` injected so `appendValue` can default `asOf`
   * to "now" without a `new Date()` reaching the service code. The
   * inline value-edit path (no operator-supplied date — the kiosk's
   * "I just measured this" gesture) is the sole consumer today.
   * Tests stub the port to a fixed instant for determinism.
   */
  constructor(
    private readonly clock: Clock,
    private readonly persist: Persister,
  ) {}

  async editFields(
    node: TreeNode<unknown>,
    payload: EditNodePayload,
  ): Promise<Outcome> {
    const kindMatch = EditNodeService.kindMatches(node, payload.kind);
    if (!kindMatch.ok) {
      return { ok: false, reason: kindMatch.reason };
    }

    // `applyFields` may throw partway through (e.g. `Weight.of(0)` rejects
    // ≤ 0 after `setIdentity` already ran). It returns the rollback closure
    // for the partial application via `tryApplyFields`, which always
    // surfaces the closure even on throw — so we can roll back to the
    // pre-edit state regardless of where the failure happened.
    const { undo, error } = this.tryApplyFields(node, payload);
    if (error) {
      undo();
      return { ok: false, reason: EditNodeService.errorReason(error) };
    }
    try {
      await this.persist();
    } catch (err) {
      undo();
      return { ok: false, reason: EditNodeService.errorReason(err) };
    }
    return { ok: true, node };
  }

  /**
   * Append a new `TimestampedValue` to the node's history.
   *
   * `asOf` is optional: omit it (the inline value-edit kiosk gesture
   * has no date field) and the service stamps the entry with
   * `clock.now()`. The §17.57 default lives here rather than in the
   * composition root so no service consumer needs to know about the
   * Clock port — they can always pass `asOf` explicitly when they
   * have one (e.g. an "I forgot to log this yesterday" back-fill flow
   * in a later strand).
   */
  async appendValue(
    node: TreeNode<unknown>,
    value: string | number,
    asOf?: Date,
  ): Promise<Outcome> {
    // SPEC §17.58 — unwrap Timestamp → Date for the still-Date-shaped factory.
    const stampedAt = asOf ?? this.clock.now().moment;
    let undo: () => void;
    try {
      undo = this.applyAppendValue(node, value, stampedAt);
    } catch (err) {
      return { ok: false, reason: EditNodeService.errorReason(err) };
    }
    try {
      await this.persist();
    } catch (err) {
      undo();
      return { ok: false, reason: EditNodeService.errorReason(err) };
    }
    return { ok: true, node };
  }

  /**
   * Applies the partial payload field-by-field, recording an undo entry
   * after every successful step. If any step throws, returns the
   * `undo` closure for the partial work and the captured `error`; the
   * caller is expected to invoke `undo()` to roll back the partial
   * mutation. On success returns `{ undo, error: null }`.
   *
   * The undo closure restores the exact pre-edit references of
   * NodeIdentity / Weight / Unit / Objective / computed flags — so a
   * roll-back leaves the tree structurally indistinguishable from the
   * pre-edit state, regardless of how far through the apply sequence
   * the failure occurred.
   */
  private tryApplyFields(
    node: TreeNode<unknown>,
    payload: EditNodePayload,
  ): { undo: () => void; error: unknown } {
    const undoActions: Array<() => void> = [];
    const undo = (): void => {
      // Roll back in reverse order so a sequence of dependent edits
      // (e.g. setIdentity then setIdentity) restores the original
      // reference, not the intermediate one.
      for (let i = undoActions.length - 1; i >= 0; i--) {
        undoActions[i]!();
      }
    };

    try {
      if (payload.title !== undefined) {
        const prev = node.identity;
        const nextIdentity = NodeIdentity.of(
          Title.of(payload.title),
          prev.description,
        );
        node.setIdentity(nextIdentity);
        undoActions.push(() => node.setIdentity(prev));
      }

      if (payload.weight !== undefined) {
        const prev = node.weight;
        node.setWeight(Weight.of(payload.weight));
        undoActions.push(() => node.setWeight(prev));
      }

      if (payload.kind === "BusinessScoreCardNode") {
        const bsc = node as BusinessScoreCardNode<number>;
        if (payload.description !== undefined) {
          const prev = bsc.identity;
          const nextIdentity = NodeIdentity.of(
            prev.title,
            Description.of(payload.description),
          );
          bsc.setIdentity(nextIdentity);
          undoActions.push(() => bsc.setIdentity(prev));
        }
        if (payload.unit !== undefined) {
          const prev = bsc.card.unit;
          bsc.card.setUnit(Unit.of(payload.unit));
          undoActions.push(() => bsc.card.setUnit(prev));
        }
        if (payload.objective !== undefined) {
          const prev = bsc.card.objective;
          bsc.card.setObjective(
            Objective.of(
              payload.objective.initialValue,
              payload.objective.targetValue,
              payload.objective.targetDate,
            ),
          );
          undoActions.push(() => bsc.card.setObjective(prev));
        }
        if (payload.computed !== undefined) {
          const prev = bsc.computed;
          bsc.setComputed(payload.computed);
          undoActions.push(() => bsc.setComputed(prev));
        }
        if (payload.eligibleForParentComputation !== undefined) {
          const prev = bsc.eligibleForParentComputation;
          bsc.setEligibleForParentComputation(
            payload.eligibleForParentComputation,
          );
          undoActions.push(() =>
            bsc.setEligibleForParentComputation(prev),
          );
        }
      }
    } catch (error) {
      return { undo, error };
    }
    return { undo, error: null };
  }

  private applyAppendValue(
    node: TreeNode<unknown>,
    value: string | number,
    asOf: Date,
  ): () => void {
    if (node instanceof TextNode) {
      if (typeof value !== "string") {
        throw new Error(
          `appendValue: TextNode "${node.id}" requires a string value, got ${typeof value}`,
        );
      }
      const tv = TimestampedValue.of(value, asOf);
      node.card.addRecorded(tv);
      return () => {
        EditNodeService.removeFirstMatching(
          node.card as unknown as { readonly historizedValues: TimestampedValue<string>[] },
          tv,
        );
      };
    }
    if (node instanceof BusinessScoreCardNode) {
      if (typeof value !== "number") {
        throw new Error(
          `appendValue: BusinessScoreCardNode "${node.id}" requires a numeric value, got ${typeof value}`,
        );
      }
      const tv = TimestampedValue.of(value, asOf);
      const bsc = node as BusinessScoreCardNode<number>;
      bsc.card.addRecorded(tv);
      return () => {
        EditNodeService.removeFirstMatching(
          bsc.card as unknown as { readonly historizedValues: TimestampedValue<number>[] },
          tv,
        );
      };
    }
    throw new Error(
      `appendValue: unsupported node kind "${node.constructor.name}"`,
    );
  }

  /**
   * Card aggregates expose `addRecorded(tv)` but no remove API (the
   * domain has no "delete a history entry" use case). For rollback we
   * reach into the private `historizedValues` array via a typed escape
   * hatch — the only place the application layer touches a card's
   * internals. Confined here so the domain surface stays clean.
   */
  private static removeFirstMatching<T>(
    card: { readonly historizedValues: TimestampedValue<T>[] },
    tv: TimestampedValue<T>,
  ): void {
    const i = card.historizedValues.indexOf(tv);
    if (i >= 0) {
      card.historizedValues.splice(i, 1);
    }
  }

  private static kindMatches(
    node: TreeNode<unknown>,
    kind: EditNodePayload["kind"],
  ): { ok: true } | { ok: false; reason: string } {
    if (kind === "TextNode" && node instanceof TextNode) return { ok: true };
    if (kind === "BusinessScoreCardNode" && node instanceof BusinessScoreCardNode)
      return { ok: true };
    return {
      ok: false,
      reason: `Edit kind "${kind}" does not match node "${node.id}" kind "${node.constructor.name}".`,
    };
  }

  private static errorReason(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }
}
