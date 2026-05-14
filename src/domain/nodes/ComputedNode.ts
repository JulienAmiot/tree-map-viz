import type { Clock } from "../capabilities/Clock.js";
import type { Computation } from "../computation/Computation.js";
import type { ComputationKind } from "../computation/ComputationKind.js";
import { ComputationOverrideError } from "../computation/ComputationOverrideError.js";
import { ComputationRegistry } from "../computation/ComputationRegistry.js";
import type { Computed } from "../computation/Computed.js";
import type { Timestamp } from "../values/Timestamp.js";
import type { Weight } from "../values/Weight.js";

import { HistorizableValueNode } from "./HistorizableValueNode.js";

/**
 * `ComputedNode<T>` — v4 concrete value-bearing node whose value is auto-derived
 * from its children via a polymorphic `Computation<T>` strategy (SPEC §17.97 /
 * v5 round 7; mirrors `class ComputedNode~T~` + `HistorizableValueNode~T~ <|--
 * ComputedNode~T~` + `ComputedNode~T~ ..|> Computed~T~` in the v5 class diagram).
 *
 * Sibling of `TextNodeV4` (§17.74) and `RangedValueNode<T>` (§17.75) under
 * `HistorizableValueNode<T>`. First round-7 strand to exercise the §17.95
 * strategy chassis + §17.96 `Computed<T>` interface from a real value-node
 * subclass; first round-7 file to reach the production bundle (was only
 * tree-shaken pre-§17.97).
 *
 * Three structural traits per §17.94 design:
 *  - **`getValue()` dispatches via the cached strategy** — returns
 *    `this._strategy.apply(this.children)`. The strategy is cached after
 *    `setComputationKind` per §17.94 risk row 6 (O(1) lookup amortised per
 *    kind change; the alternative — registry lookup on every getValue —
 *    was rejected).
 *  - **`setValue` + `addValue` throw `ComputationOverrideError`** per §17.94
 *    D5 — history is audit-only. The inherited `HistorizableValueNode.history`
 *    field stays readable via the inherited `entries()` getter, but no public
 *    method on this strand can populate it; future write-side strands will
 *    add a stamping path (audit-only by construction). `removeValue` stays
 *    inherited — operator can prune the audit trail without violating the
 *    "no overwrite" contract.
 *  - **Type-erasure across the registry boundary** — `ComputationRegistry`
 *    returns `Computation<number>` (all 6 §17.95 strategies are numeric);
 *    `ComputedNode<T>` casts to `Computation<T>` at the constructor +
 *    `setComputationKind` sites. Matches the §17.94 risk row 1 type-erasure
 *    intent; today's only valid instantiation is `ComputedNode<number>`.
 */
export class ComputedNode<T> extends HistorizableValueNode<T> implements Computed<T> {
  private _kind: ComputationKind;
  private _strategy: Computation<T>;

  constructor(
    id: string,
    title: string,
    weight: Weight,
    description: string,
    clock: Clock,
    initialKind: ComputationKind,
  ) {
    super(id, title, weight, description, clock);
    this._kind = initialKind;
    this._strategy = ComputationRegistry.resolve(initialKind) as Computation<T>;
  }

  get computationKind(): ComputationKind { return this._kind; }
  get computation(): Computation<T> { return this._strategy; }

  setComputationKind(kind: ComputationKind): void {
    this._kind = kind;
    this._strategy = ComputationRegistry.resolve(kind) as Computation<T>;
  }

  override getValue(): T {
    return this._strategy.apply(this.children) as T;
  }

  override setValue(_value: T): void {
    throw new ComputationOverrideError(this.id);
  }

  override addValue(_timestamp: Timestamp, _value: T): void {
    throw new ComputationOverrideError(this.id);
  }
}
