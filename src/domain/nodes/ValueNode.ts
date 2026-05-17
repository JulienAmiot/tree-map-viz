import type { Weight } from "../values/Weight.js";
import { Node } from "./Node.js";

/**
 * `ValueNode<T>` — v4 abstract value-bearing node (SPEC §17.72; mirrors
 * `<<abstract>> class ValueNode~T~` in the v4 class diagram, extended in v5
 * round-7 per §17.94 with the `+disabled : boolean` + `+setDisabled(boolean d)`
 * member pair). Sits between `Node` and the historizable / ranged subclasses:
 * introduces the value type `T`, the description slot, the abstract
 * `getValue()` accessor, and (since §17.99a) the `disabled` eligibility flag.
 *
 * `getDescription()` is a method (not a JS getter) so subclasses can
 * override polymorphically — `TextNode` is expected to override it to
 * return `getValue()` per SPEC §17.15 (the rendered "description" of a
 * text node IS the value; the underlying description field stays empty).
 * The default impl returns `this._description` verbatim.
 *
 * `disabled` (§17.99a) — v5 round-7 D4 broader successor to v3's
 * `BusinessScoreCardNode.eligibleForParentComputation` flag. Default
 * `false` (every existing kiosk node is enabled by construction; no
 * existing call site sets it). Semantics: "park this node — exclude from
 * aggregation AND grey out in the UI" (broader than v3 which only
 * excluded from aggregation). First behavioural consumer is the §17.95
 * `Computation<T>` strategy hierarchy — `enabledValueNodes` filters
 * `child.disabled` directly post-§17.99a (was a duck-typed predicate
 * pre-§17.99a, hardcoded to return `false` because no node had the
 * field yet). The `setDisabled(boolean)` mutator is plumbed for the
 * future §17.101 `EditNodeServiceV4` operator-facing toggle; today
 * the only call sites that flip it are the §17.99a Computation tests.
 * The §17.93-introduced `BusinessScoreNode.eligibleForParentComputation`
 * field is NOT retired by this strand (`computedValue` still reads
 * the v3-compat flag); §17.99b will migrate the band-aid field by
 * setting `disabled: true` at the §17.81 adapter for every v3 BSC
 * with `eligibleForParentComputation: false`.
 */
export abstract class ValueNode<T> extends Node {
  private _description: string;
  private _disabled = false;

  protected constructor(
    id: string,
    title: string,
    weight: Weight,
    description: string,
  ) {
    super(id, title, weight);
    this._description = description;
  }

  getDescription(): string {
    return this._description;
  }

  setDescription(description: string): void {
    this._description = description;
  }

  get disabled(): boolean {
    return this._disabled;
  }

  setDisabled(disabled: boolean): void {
    this._disabled = disabled;
  }

  abstract getValue(): T;
}
