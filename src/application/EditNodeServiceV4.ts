import type { Clock } from "../domain/capabilities/Clock.js";
import type { BusinessScoreCardV4 } from "../domain/cards/BusinessScoreCardV4.js";
import type { Computed } from "../domain/computation/Computed.js";
import type { ComputationKind } from "../domain/computation/ComputationKind.js";
import { BusinessScoreNode } from "../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../domain/nodes/ComputedNode.js";
import type { Node } from "../domain/nodes/Node.js";
import { StrictRangeNode } from "../domain/nodes/StrictRangeNode.js";
import { TextNodeV4 } from "../domain/nodes/TextNodeV4.js";
import type { CardRegistry } from "../domain/Tree.js";
import { Objective } from "../domain/values/Objective.js";
import { Timestamp } from "../domain/values/Timestamp.js";
import { Unit } from "../domain/values/Unit.js";
import { Weight } from "../domain/values/Weight.js";

import type { PersisterV4 } from "./AddChildServiceV4.js";

/**
 * Plain-data payload from the Edit-node modal — v4 successor to v3's
 * `EditNodePayload` (SPEC §17.101a + §17.101b). All fields optional
 * (partial update); kind mandatory + must match the node's runtime
 * class (no morph between kinds). Description moves to CommonEdit at
 * §17.101b because every v4 value node extends `ValueNode<T>` which
 * carries `setDescription`. Round-7 kinds (StrictRange, Computed,
 * ComputedBusinessScore) added at §17.101b; Computed* gain
 * `computationKind?: ComputationKind`.
 */
type CommonEdit = {
  readonly title?: string;
  readonly weight?: number;
  readonly disabled?: boolean;
  readonly description?: string;
};
type BSEdit = { readonly unit?: string; readonly objective?: { readonly value: number; readonly at: Date } };
type ComputedEdit = { readonly computationKind?: ComputationKind };
export type EditNodePayloadV4 =
  | (CommonEdit & { readonly kind: "TextNode" })
  | (CommonEdit & BSEdit & { readonly kind: "BusinessScore" })
  | (CommonEdit & { readonly kind: "StrictRange" })
  | (CommonEdit & ComputedEdit & { readonly kind: "Computed" })
  | (CommonEdit & BSEdit & ComputedEdit & { readonly kind: "ComputedBusinessScore" });

type OutcomeV4 =
  | { readonly ok: true; readonly node: Node }
  | { readonly ok: false; readonly reason: string };

/**
 * Applies a partial edit payload to an existing v4 node, persists,
 * rolls back on failure (SPEC §17.101a). v4 successor to v3's
 * `EditNodeService`. Atomicity preserved field-level: a persister
 * failure restores every field this call touched. `setUnit` mutates
 * the §17.100.5 `BusinessScoreCardV4` via the optional `cards`
 * registry (no-card → `{ ok: false }`); `setObjective` mutates the
 * §17.91 BSN field (made non-readonly at §17.101a); `setDisabled` on
 * `ValueNode<T>` (§17.99a) applies uniformly across kinds.
 */
export class EditNodeServiceV4 {
  constructor(
    private readonly clock: Clock,
    private readonly persist: PersisterV4,
  ) {}

  async editFields(node: Node, payload: EditNodePayloadV4, options: { cards?: CardRegistry } = {}): Promise<OutcomeV4> {
    const kindCheck = EditNodeServiceV4.kindMatches(node, payload.kind);
    if (!kindCheck.ok) return kindCheck;
    const { undo, error } = this.tryApplyFields(node, payload, options.cards);
    if (error !== null) { undo(); return { ok: false, reason: EditNodeServiceV4.errorReason(error) }; }
    try { await this.persist(); }
    catch (err) { undo(); return { ok: false, reason: EditNodeServiceV4.errorReason(err) }; }
    return { ok: true, node };
  }

  async appendValue(node: Node, value: string | number, asOf?: Date): Promise<OutcomeV4> {
    const stampedAt = asOf ? Timestamp.of(asOf) : this.clock.now();
    let undo: () => void;
    try { undo = EditNodeServiceV4.applyAppendValue(node, value, stampedAt); }
    catch (err) { return { ok: false, reason: EditNodeServiceV4.errorReason(err) }; }
    try { await this.persist(); }
    catch (err) { undo(); return { ok: false, reason: EditNodeServiceV4.errorReason(err) }; }
    return { ok: true, node };
  }

  private tryApplyFields(
    node: Node,
    payload: EditNodePayloadV4,
    cards: CardRegistry | undefined,
  ): { undo: () => void; error: unknown } {
    const undos: Array<() => void> = [];
    const undo = (): void => { for (const a of [...undos].reverse()) a(); };
    try {
      EditNodeServiceV4.applyCommonEdits(node, payload, undos);
      if (payload.kind === "BusinessScore" || payload.kind === "ComputedBusinessScore") {
        EditNodeServiceV4.applyBusinessScoreEdits(node as BusinessScoreNode<number>, payload, cards, undos);
      }
      if (payload.kind === "Computed" || payload.kind === "ComputedBusinessScore") {
        EditNodeServiceV4.applyComputedEdits(node as unknown as Computed<number>, payload, undos);
      }
    } catch (error) {
      return { undo, error };
    }
    return { undo, error: null };
  }

  private static applyCommonEdits(node: Node, payload: EditNodePayloadV4, undos: Array<() => void>): void {
    if (payload.title !== undefined) {
      const t = payload.title.trim();
      if (t === "") throw new Error("Title cannot be empty");
      const prev = node.title;
      node.setTitle(t);
      undos.push(() => node.setTitle(prev));
    }
    if (payload.weight !== undefined) {
      const prev = node.weight;
      node.setWeight(Weight.of(payload.weight));
      undos.push(() => node.setWeight(prev));
    }
    const valueNode = node as TextNodeV4 | BusinessScoreNode<number> | StrictRangeNode<number> | ComputedNode<number>;
    if (payload.disabled !== undefined) {
      const prev = valueNode.disabled;
      valueNode.setDisabled(payload.disabled);
      undos.push(() => valueNode.setDisabled(prev));
    }
    if (payload.description !== undefined) {
      const prev = valueNode.getDescription();
      valueNode.setDescription(payload.description);
      undos.push(() => valueNode.setDescription(prev));
    }
  }

  private static applyBusinessScoreEdits(
    bsn: BusinessScoreNode<number>,
    payload: BSEdit,
    cards: CardRegistry | undefined,
    undos: Array<() => void>,
  ): void {
    if (payload.objective !== undefined) {
      const prev = bsn.objective;
      bsn.setObjective(Objective.of(payload.objective.value, Timestamp.of(payload.objective.at)));
      undos.push(() => bsn.setObjective(prev));
    }
    if (payload.unit !== undefined) {
      const card = cards?.get(bsn.id) as BusinessScoreCardV4<number> | undefined;
      if (card === undefined) throw new Error(`Cannot set unit on BSN "${bsn.id}" — no card in registry`);
      const prev = card.getUnit();
      card.setUnit(Unit.of(payload.unit));
      undos.push(() => card.setUnit(prev));
    }
  }

  private static applyComputedEdits(
    computed: Computed<number>,
    payload: ComputedEdit,
    undos: Array<() => void>,
  ): void {
    if (payload.computationKind !== undefined) {
      const prev = computed.computationKind;
      computed.setComputationKind(payload.computationKind);
      undos.push(() => computed.setComputationKind(prev));
    }
  }

  private static applyAppendValue(node: Node, value: string | number, asOf: Timestamp): () => void {
    if (node instanceof TextNodeV4 && typeof value === "string") {
      node.addValue(asOf, value);
      return () => node.removeValue(asOf);
    }
    if ((node instanceof BusinessScoreNode || node instanceof StrictRangeNode) && typeof value === "number") {
      const numericNode = node as BusinessScoreNode<number> | StrictRangeNode<number>;
      numericNode.addValue(asOf, value);
      return () => numericNode.removeValue(asOf);
    }
    throw new Error(`appendValue: unsupported (node="${node.constructor.name}", value type="${typeof value}")`);
  }

  private static kindMatches(node: Node, kind: EditNodePayloadV4["kind"]): { ok: true } | { ok: false; reason: string } {
    if (node.constructor === EditNodeServiceV4.classFor(kind)) return { ok: true };
    return { ok: false, reason: `Edit kind "${kind}" does not match node "${node.id}" runtime class "${node.constructor.name}"` };
  }

  private static classFor(kind: EditNodePayloadV4["kind"]): new (...args: never[]) => Node {
    switch (kind) {
      case "TextNode": return TextNodeV4;
      case "BusinessScore": return BusinessScoreNode;
      case "StrictRange": return StrictRangeNode;
      case "Computed": return ComputedNode;
      case "ComputedBusinessScore": return ComputedBusinessScoreNode;
    }
  }

  private static errorReason(err: unknown): string { return err instanceof Error ? err.message : String(err); }
}
