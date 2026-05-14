import type { Clock } from "../capabilities/Clock.js";
import type { Computation } from "../computation/Computation.js";
import type { ComputationKind } from "../computation/ComputationKind.js";
import { ComputationOverrideError } from "../computation/ComputationOverrideError.js";
import { ComputationRegistry } from "../computation/ComputationRegistry.js";
import type { Computed } from "../computation/Computed.js";
import type { ObjectiveV4 } from "../values/ObjectiveV4.js";
import type { LenientRange } from "../values/Range.js";
import type { Timestamp } from "../values/Timestamp.js";
import type { Weight } from "../values/Weight.js";

import { BusinessScoreNode } from "./BusinessScoreNode.js";

/**
 * `ComputedBusinessScoreNode<T>` — v4 concrete value-bearing node whose value
 * is auto-derived from its children via a polymorphic `Computation<T>` strategy
 * AND whose value-domain is bounded by a `LenientRange<T>` AND which carries a
 * single goal-point `ObjectiveV4<T>` (SPEC §17.98 / v5 round 7; mirrors
 * `class ComputedBusinessScoreNode~T~` + `BusinessScoreNode~T~ <|--
 * ComputedBusinessScoreNode~T~` + `ComputedBusinessScoreNode~T~ ..|>
 * Computed~T~` in the v5 class diagram).
 *
 * The second concrete realisation of `Computed<T>` after §17.97
 * `ComputedNode<T>`. Both classes ship the same audit-only override contract
 * (`setValue` / `addValue` throw `ComputationOverrideError`, `getValue`
 * dispatches via the cached strategy resolved at `setComputationKind`); they
 * differ only in what they inherit: `ComputedNode<T>` extends
 * `HistorizableValueNode<T>` (history-only); `ComputedBusinessScoreNode<T>`
 * extends `BusinessScoreNode<T>` (history + range + objective + unit), so it
 * is what the kiosk operator picks when the auto-derived metric is ALSO
 * scored against a target.
 *
 * Three structural traits per §17.94 design (same shape as §17.97 modulo the
 * parent class):
 *  - **`getValue()` dispatches via the cached strategy** — returns
 *    `this._strategy.apply(this.children)`. The strategy is cached after
 *    `setComputationKind` per §17.94 risk row 6 (O(1) lookup amortised per
 *    kind change). Identical mechanism to §17.97.
 *  - **`setValue` + `addValue` throw `ComputationOverrideError`** per §17.94
 *    D5 — history is audit-only. The inherited
 *    `BusinessScoreNode<T>.range.requireValue` gate (§17.75 RangedValueNode
 *    addValue override) is bypassed because the override throws BEFORE
 *    delegating to `super.addValue` — but the lenient gate is a no-op anyway
 *    (§17.71 LenientRange), and no value is ever recorded so range
 *    conformity is moot by construction. `entries()` / `removeValue` /
 *    `range` / `objective` / `unit` all stay inherited unchanged.
 *  - **`computed` band-aid hardwired to `true`** — the §17.93
 *    `BusinessScoreNode<T>.computed: boolean` flag (added as a v3-compat
 *    band-aid to keep the §17.93 read-side mapper rendering computed BSCs
 *    correctly) is forced to `true` in the super() call regardless of the
 *    operator's options. A `ComputedBusinessScoreNode<T>` IS computed by
 *    class identity — the flag becomes redundant once §17.91's successor
 *    learns to type-switch on this class (at which point a future strand
 *    can retire the flag entirely per the §17.93 docblock). Forcing it
 *    `true` keeps the existing §17.93 mapper happy WHEN this class first
 *    reaches the production bundle, without requiring any mapper change
 *    at §17.98. `eligibleForParentComputation` stays operator-controllable
 *    (it has independent semantics — "include this score in the parent's
 *    mean even though it's auto-derived").
 *
 * Type-erasure across the registry boundary follows the §17.97 pattern
 * verbatim: `ComputationRegistry.resolve(kind)` returns `Computation<number>`
 * (all 6 §17.95 strategies are numeric); cast to `Computation<T>` at the
 * constructor + `setComputationKind` sites. Today's only valid instantiation
 * is `ComputedBusinessScoreNode<number>`.
 */
export class ComputedBusinessScoreNode<T> extends BusinessScoreNode<T> implements Computed<T> {
  private _kind: ComputationKind;
  private _strategy: Computation<T>;

  constructor(
    id: string,
    title: string,
    weight: Weight,
    description: string,
    clock: Clock,
    range: LenientRange<T>,
    options: {
      objective: ObjectiveV4<T>;
      initialKind: ComputationKind;
      unit?: string;
      eligibleForParentComputation?: boolean;
    },
  ) {
    super(id, title, weight, description, clock, range, {
      objective: options.objective,
      unit: options.unit,
      computed: true,
      eligibleForParentComputation: options.eligibleForParentComputation,
    });
    this._kind = options.initialKind;
    this._strategy = ComputationRegistry.resolve(options.initialKind) as Computation<T>;
  }

  get computationKind(): ComputationKind { return this._kind; }
  get computation(): Computation<T> { return this._strategy; }

  setComputationKind(kind: ComputationKind): void {
    this._kind = kind;
    this._strategy = ComputationRegistry.resolve(kind) as Computation<T>;
  }

  override getValue(): T {
    return this._strategy.apply(this.children);
  }

  override setValue(_value: T): void {
    throw new ComputationOverrideError(this.id);
  }

  override addValue(_timestamp: Timestamp, _value: T): void {
    throw new ComputationOverrideError(this.id);
  }
}
