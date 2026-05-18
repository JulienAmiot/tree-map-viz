import type { Clock } from "../domain/capabilities/Clock.js";
import { canAddChild } from "../domain/capacity/childrenCapacity.js";
import type { ComputationKind } from "../domain/computation/ComputationKind.js";
import { BusinessScoreNode } from "../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../domain/nodes/ComputedNode.js";
import type { HistorizableValueNode } from "../domain/nodes/HistorizableValueNode.js";
import type { Node } from "../domain/nodes/Node.js";
import { PictureNode } from "../domain/nodes/PictureNode.js";
import { StrictRangeNode } from "../domain/nodes/StrictRangeNode.js";
import { TextNode } from "../domain/nodes/TextNode.js";
import { URLNode } from "../domain/nodes/URLNode.js";
import type { ValueNode } from "../domain/nodes/ValueNode.js";
import { WorkflowNode } from "../domain/nodes/WorkflowNode.js";
import { NumericComparator } from "../domain/values/Comparator.js";
import { Objective } from "../domain/values/Objective.js";
import { LenientRange, StrictRange } from "../domain/values/Range.js";
import { Timestamp } from "../domain/values/Timestamp.js";
import { Weight } from "../domain/values/Weight.js";

import type { IdGenerator } from "./ports/IdGenerator.js";

/**
 * Plain-data payload from the Add-child modal — v4 successor to v3's
 * `AddChildPayload` (SPEC §17.100a + §17.100b + §17.117). Six kinds:
 * 2 v3-compat (`TextNode`, `BusinessScore`) + 3 round-7 (`StrictRange`,
 * `Computed`, `ComputedBusinessScore`) + 1 §17.117 (`Workflow`).
 * Defaults: `weight=1`, `description=""`, `disabled=false`, history
 * empty. Computed* kinds carry an operator-selected `computationKind`
 * (per §17.94 plan dropdown) and have NO `initialHistory` field —
 * their history is audit-only per §17.94 D5 (`addValue` throws
 * `ComputationOverrideError`). `Workflow` mirrors `TextNode` plus a
 * required `statusId` referencing the focused board's status table.
 */
export type AddChildPayload =
  | {
      readonly kind: "TextNode";
      readonly title: string;
      readonly weight?: number;
      readonly initialHistory?: readonly { readonly value: string; readonly asOf: Date }[];
    }
  | {
      readonly kind: "Workflow";
      readonly title: string;
      readonly weight?: number;
      readonly statusId: string;
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
    }
  | {
      /**
       * SPEC §17.119 — snapshot leaf carrying a single image URL. No
       * description / history / objective / range; the modal collects
       * title + weight + imageUrl and that is the full surface.
       */
      readonly kind: "Picture";
      readonly title: string;
      readonly weight?: number;
      readonly imageUrl: string;
      readonly disabled?: boolean;
    }
  | {
      /**
       * SPEC §17.120 — snapshot leaf carrying a single URL the view
       * layer renders as a QR code. The URL lives in the inherited
       * description slot (per the operator's "URL is in the description"
       * contract); the modal collects title + weight + url and that
       * is the full surface (no separate description field — entering
       * the URL IS entering the description).
       */
      readonly kind: "URL";
      readonly title: string;
      readonly weight?: number;
      readonly url: string;
      readonly disabled?: boolean;
    };

/** Async callback invoked after a successful append; failures are caught and rolled back. */
export type Persister = () => Promise<void>;

type Outcome =
  | { readonly ok: true; readonly child: Node }
  | { readonly ok: false; readonly reason: string };

/**
 * Builds a v4 node from a payload, appends it to the focused v4 parent,
 * persists, rejects at MAX_CHILDREN (SPEC §17.100a). v4 successor to v3's
 * `AddChildService`; parallel additive — v3 stays live in `main.ts` until
 * §17.110 Phase E cutover. Deltas vs v3: `Clock` injected; `disabled`
 * propagates via `setDisabled(true)` per §17.99a (no ctor option); title
 * validated here (v4 dropped the v3 `Title` VO). Atomicity preserved: cap →
 * build → attach → persist; rolls back on persist throw.
 */
export class AddChildService {
  constructor(
    private readonly idGen: IdGenerator,
    private readonly clock: Clock,
    private readonly persist: Persister,
  ) {}

  async addChild(parent: Node, payload: AddChildPayload): Promise<Outcome> {
    if (!canAddChild(parent)) {
      return {
        ok: false,
        reason: `Children cap reached (MAX_CHILDREN). Cannot add another child to "${parent.id}".`,
      };
    }

    let child: Node;
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

  protected buildNode(payload: AddChildPayload): Node {
    const title = payload.title.trim();
    if (!title) throw new Error("Title cannot be empty");
    const id = this.idGen();
    const weight = Weight.of(payload.weight ?? 1);
    if (payload.kind === "TextNode") {
      const node = new TextNode(id, title, weight, this.clock);
      this.replayHistory(node, payload.initialHistory);
      return node;
    }
    if (payload.kind === "Workflow") {
      const node = new WorkflowNode(id, title, weight, this.clock, payload.statusId);
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
      AddChildService.applyDisabled(node, payload.disabled);
      return node;
    }
    if (payload.kind === "ComputedBusinessScore") {
      return this.buildComputedBusinessScoreNode(id, title, weight, payload);
    }
    if (payload.kind === "Picture") {
      const node = new PictureNode(id, title, weight, payload.imageUrl);
      AddChildService.applyDisabled(node, payload.disabled);
      return node;
    }
    if (payload.kind === "URL") {
      const node = new URLNode(id, title, weight, payload.url);
      AddChildService.applyDisabled(node, payload.disabled);
      return node;
    }
    throw new Error(`Unknown node kind: ${(payload as { kind: string }).kind}`);
  }

  private buildStrictRangeNode(
    id: string,
    title: string,
    weight: Weight,
    payload: Extract<AddChildPayload, { kind: "StrictRange" }>,
  ): StrictRangeNode<number> {
    const range = StrictRange.of(payload.min, payload.max, NumericComparator.INSTANCE);
    const node = new StrictRangeNode<number>(
      id, title, weight, payload.description ?? "", this.clock, range,
    );
    this.replayHistory(node, payload.initialHistory);
    AddChildService.applyDisabled(node, payload.disabled);
    return node;
  }

  private buildComputedBusinessScoreNode(
    id: string,
    title: string,
    weight: Weight,
    payload: Extract<AddChildPayload, { kind: "ComputedBusinessScore" }>,
  ): ComputedBusinessScoreNode<number> {
    const range = LenientRange.of(
      Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, NumericComparator.INSTANCE,
    );
    const objective = Objective.of(payload.objective.value, Timestamp.of(payload.objective.at));
    const node = new ComputedBusinessScoreNode<number>(
      id, title, weight, payload.description ?? "", this.clock, range,
      { objective, initialKind: payload.computationKind, unit: payload.unit },
    );
    AddChildService.applyDisabled(node, payload.disabled);
    return node;
  }

  private buildBusinessScoreNode(
    id: string,
    title: string,
    weight: Weight,
    payload: Extract<AddChildPayload, { kind: "BusinessScore" }>,
  ): BusinessScoreNode<number> {
    const range = LenientRange.of(
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      NumericComparator.INSTANCE,
    );
    const objective = Objective.of(payload.objective.value, Timestamp.of(payload.objective.at));
    const node = new BusinessScoreNode<number>(
      id, title, weight, payload.description ?? "", this.clock, range,
      { objective, unit: payload.unit },
    );
    this.replayHistory(node, payload.initialHistory);
    AddChildService.applyDisabled(node, payload.disabled);
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
