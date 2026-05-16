import type { Clock } from "../domain/capabilities/Clock.js";
import { canAddChildV4 } from "../domain/capacity/childrenCapacityV4.js";
import type { ComputationKind } from "../domain/computation/ComputationKind.js";
import { BusinessScoreNode } from "../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../domain/nodes/ComputedNode.js";
import type { HistorizableValueNode } from "../domain/nodes/HistorizableValueNode.js";
import type { Node } from "../domain/nodes/Node.js";
import { StrictRangeNode } from "../domain/nodes/StrictRangeNode.js";
import { TextNodeV4 } from "../domain/nodes/TextNodeV4.js";
import type { ValueNode } from "../domain/nodes/ValueNode.js";
import { NumericComparator } from "../domain/values/Comparator.js";
import { ObjectiveV4 } from "../domain/values/ObjectiveV4.js";
import { LenientRange, StrictRange } from "../domain/values/Range.js";
import { Timestamp } from "../domain/values/Timestamp.js";
import { Weight } from "../domain/values/Weight.js";

import type { IdGenerator } from "./ports/IdGenerator.js";

/**
 * Plain-data payload from the Add-child modal — v4 successor to v3's
 * `AddChildPayload` (SPEC §17.100a + §17.100b). Five kinds: 2 v3-compat
 * (`TextNode`, `BusinessScore`) + 3 round-7 (`StrictRange`, `Computed`,
 * `ComputedBusinessScore`). Defaults: `weight=1`, `description=""`,
 * `disabled=false`, history empty. Computed* kinds carry an
 * operator-selected `computationKind` (per §17.94 plan dropdown) and
 * have NO `initialHistory` field — their history is audit-only per
 * §17.94 D5 (`addValue` throws `ComputationOverrideError`).
 */
export type AddChildPayloadV4 =
  | {
      readonly kind: "TextNode";
      readonly title: string;
      readonly weight?: number;
      readonly initialHistory?: readonly { readonly value: string; readonly asOf: Date }[];
    }
  | {
      readonly kind: "BusinessScore";
      readonly title: string;
      readonly description?: string;
      readonly weight?: number;
      readonly unit: string;
      readonly objective: { readonly value: number; readonly at: Date };
      readonly disabled?: boolean;
      readonly initialHistory?: readonly { readonly value: number; readonly asOf: Date }[];
    }
  | {
      readonly kind: "StrictRange";
      readonly title: string;
      readonly description?: string;
      readonly weight?: number;
      readonly min: number;
      readonly max: number;
      readonly disabled?: boolean;
      readonly initialHistory?: readonly { readonly value: number; readonly asOf: Date }[];
    }
  | {
      readonly kind: "Computed";
      readonly title: string;
      readonly description?: string;
      readonly weight?: number;
      readonly computationKind: ComputationKind;
      readonly disabled?: boolean;
    }
  | {
      readonly kind: "ComputedBusinessScore";
      readonly title: string;
      readonly description?: string;
      readonly weight?: number;
      readonly unit: string;
      readonly objective: { readonly value: number; readonly at: Date };
      readonly computationKind: ComputationKind;
      readonly disabled?: boolean;
    };

/** Async callback invoked after a successful append; failures are caught and rolled back. */
export type PersisterV4 = () => Promise<void>;

type OutcomeV4 =
  | { readonly ok: true; readonly child: Node }
  | { readonly ok: false; readonly reason: string };

/**
 * Builds a v4 node from a payload, appends it to the focused v4 parent,
 * persists, rejects at MAX_CHILDREN_V4 (SPEC §17.100a). v4 successor to v3's
 * `AddChildService`; parallel additive — v3 stays live in `main.ts` until
 * §17.110 Phase E cutover. Deltas vs v3: `Clock` injected; `disabled`
 * propagates via `setDisabled(true)` per §17.99a (no ctor option); title
 * validated here (v4 dropped the v3 `Title` VO). Atomicity preserved: cap →
 * build → attach → persist; rolls back on persist throw.
 */
export class AddChildServiceV4 {
  constructor(
    private readonly idGen: IdGenerator,
    private readonly clock: Clock,
    private readonly persist: PersisterV4,
  ) {}

  async addChild(parent: Node, payload: AddChildPayloadV4): Promise<OutcomeV4> {
    if (!canAddChildV4(parent)) {
      return {
        ok: false,
        reason: `Children cap reached (MAX_CHILDREN). Cannot add another child to "${parent.id}".`,
      };
    }

    let child: Node;
    try {
      child = this.buildNode(payload);
    } catch (err) {
      return { ok: false, reason: AddChildServiceV4.errorReason(err) };
    }

    parent.attach(child);
    try {
      await this.persist();
    } catch (err) {
      parent.detach(child);
      return { ok: false, reason: AddChildServiceV4.errorReason(err) };
    }
    return { ok: true, child };
  }

  protected buildNode(payload: AddChildPayloadV4): Node {
    const title = payload.title.trim();
    if (!title) throw new Error("Title cannot be empty");
    const id = this.idGen();
    const weight = Weight.of(payload.weight ?? 1);
    if (payload.kind === "TextNode") {
      const node = new TextNodeV4(id, title, weight, this.clock);
      this.replayHistory(node, payload.initialHistory);
      return node;
    }
    if (payload.kind === "BusinessScore") {
      return this.buildBusinessScoreNode(id, title, weight, payload);
    }
    if (payload.kind === "StrictRange") {
      return this.buildStrictRangeNode(id, title, weight, payload);
    }
    if (payload.kind === "Computed") {
      const node = new ComputedNode<number>(
        id, title, weight, payload.description ?? "", this.clock, payload.computationKind,
      );
      AddChildServiceV4.applyDisabled(node, payload.disabled);
      return node;
    }
    if (payload.kind === "ComputedBusinessScore") {
      return this.buildComputedBusinessScoreNode(id, title, weight, payload);
    }
    throw new Error(`Unknown node kind: ${(payload as { kind: string }).kind}`);
  }

  private buildStrictRangeNode(
    id: string,
    title: string,
    weight: Weight,
    payload: Extract<AddChildPayloadV4, { kind: "StrictRange" }>,
  ): StrictRangeNode<number> {
    const range = StrictRange.of(payload.min, payload.max, NumericComparator.INSTANCE);
    const node = new StrictRangeNode<number>(
      id, title, weight, payload.description ?? "", this.clock, range,
    );
    this.replayHistory(node, payload.initialHistory);
    AddChildServiceV4.applyDisabled(node, payload.disabled);
    return node;
  }

  private buildComputedBusinessScoreNode(
    id: string,
    title: string,
    weight: Weight,
    payload: Extract<AddChildPayloadV4, { kind: "ComputedBusinessScore" }>,
  ): ComputedBusinessScoreNode<number> {
    const range = LenientRange.of(
      Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, NumericComparator.INSTANCE,
    );
    const objective = ObjectiveV4.of(payload.objective.value, Timestamp.of(payload.objective.at));
    const node = new ComputedBusinessScoreNode<number>(
      id, title, weight, payload.description ?? "", this.clock, range,
      { objective, initialKind: payload.computationKind, unit: payload.unit },
    );
    AddChildServiceV4.applyDisabled(node, payload.disabled);
    return node;
  }

  private buildBusinessScoreNode(
    id: string,
    title: string,
    weight: Weight,
    payload: Extract<AddChildPayloadV4, { kind: "BusinessScore" }>,
  ): BusinessScoreNode<number> {
    const range = LenientRange.of(
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      NumericComparator.INSTANCE,
    );
    const objective = ObjectiveV4.of(payload.objective.value, Timestamp.of(payload.objective.at));
    const node = new BusinessScoreNode<number>(
      id, title, weight, payload.description ?? "", this.clock, range,
      { objective, unit: payload.unit },
    );
    this.replayHistory(node, payload.initialHistory);
    AddChildServiceV4.applyDisabled(node, payload.disabled);
    return node;
  }

  protected replayHistory<T>(
    node: HistorizableValueNode<T>,
    history: readonly { readonly value: T; readonly asOf: Date }[] | undefined,
  ): void {
    for (const entry of history ?? []) {
      node.addValue(Timestamp.of(entry.asOf), entry.value);
    }
  }

  protected static applyDisabled(node: ValueNode<unknown>, disabled?: boolean): void {
    if (disabled === true) node.setDisabled(true);
  }

  private static errorReason(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
