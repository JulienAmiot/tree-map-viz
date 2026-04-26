import { canAddChild } from "../domain/capacity/childrenCapacity.js";
import { BusinessScoreCard } from "../domain/nodes/BusinessScoreCard.js";
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

import type { IdGenerator } from "./ports/IdGenerator.js";

/**
 * Plain-data payload from the Add-child modal (§7).
 *
 * The form delivers raw user input; the service is the conversion boundary
 * that folds it into domain value objects. Optional fields default sensibly
 * (weight=1, description="", computed=false, eligibleForParentComputation=true,
 * empty initial history).
 */
export type AddChildPayload =
  | {
      readonly kind: "TextNode";
      readonly title: string;
      readonly description?: string;
      readonly weight?: number;
    }
  | {
      readonly kind: "BusinessScoreCardNode";
      readonly title: string;
      readonly description?: string;
      readonly weight?: number;
      readonly unit: string;
      readonly objective: {
        readonly initialValue: number;
        readonly targetValue: number;
        readonly targetDate: Date;
      };
      readonly computed?: boolean;
      readonly eligibleForParentComputation?: boolean;
      readonly initialHistory?: readonly { readonly value: number; readonly asOf: Date }[];
    };

/** Async callback invoked after a successful append; failures are caught and rolled back. */
export type Persister = () => Promise<void>;

type Outcome =
  | { readonly ok: true; readonly child: TreeNode<unknown> }
  | { readonly ok: false; readonly reason: string };

/**
 * Application service: builds an Option B node from a payload, appends it to
 * the focused parent, persists, and rejects when the children cap is reached
 * (`MAX_CHILDREN` from the capacity module).
 *
 * The service is decoupled from the persistence shape: callers wire a
 * `Persister` callback at the composition root that snapshots whatever
 * larger structure (board collection) needs to be re-saved.
 *
 * Invariants:
 * - cap check runs before any node construction;
 * - construction errors (invalid title, weight, unit, ...) surface as
 *   `{ ok: false, reason }` and never mutate the parent;
 * - if `persist()` throws, the freshly-attached child is detached so the
 *   in-memory tree stays consistent with the (un-)persisted state.
 */
export class AddChildService {
  constructor(
    private readonly idGen: IdGenerator,
    private readonly persist: Persister,
  ) {}

  async addChild(parent: TreeNode<unknown>, payload: AddChildPayload): Promise<Outcome> {
    if (!canAddChild(parent)) {
      return {
        ok: false,
        reason: `Children cap reached (MAX_CHILDREN). Cannot add another child to "${parent.id}".`,
      };
    }

    let child: TreeNode<unknown>;
    try {
      child = this.buildNode(payload);
    } catch (err) {
      return { ok: false, reason: AddChildService.errorReason(err) };
    }

    parent.attach(child);
    try {
      await this.persist();
    } catch (err) {
      parent.detach(child);
      return { ok: false, reason: AddChildService.errorReason(err) };
    }
    return { ok: true, child };
  }

  private buildNode(payload: AddChildPayload): TreeNode<unknown> {
    const id = this.idGen();
    const identity = NodeIdentity.of(
      Title.of(payload.title),
      Description.of(payload.description ?? ""),
    );
    const weight = Weight.of(payload.weight ?? 1);

    if (payload.kind === "TextNode") {
      return new TextNode(id, identity, weight);
    }
    if (payload.kind === "BusinessScoreCardNode") {
      const objective = Objective.of(
        payload.objective.initialValue,
        payload.objective.targetValue,
        payload.objective.targetDate,
      );
      const initialHistory = (payload.initialHistory ?? []).map((entry) =>
        TimestampedValue.of(entry.value, entry.asOf),
      );
      const card = BusinessScoreCard.of(Unit.of(payload.unit), objective, initialHistory);
      return new BusinessScoreCardNode<number>(
        id,
        identity,
        weight,
        card,
        payload.computed ?? false,
        payload.eligibleForParentComputation ?? true,
      );
    }
    throw new Error(`Unknown node kind: ${(payload as { kind: string }).kind}`);
  }

  private static errorReason(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }
}
