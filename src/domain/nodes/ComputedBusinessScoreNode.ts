import type { Clock } from "../capabilities/Clock.js";
import { ComputationCache } from "../computation/ComputationCache.js";
import type { Computation } from "../computation/Computation.js";
import type { ComputationKind } from "../computation/ComputationKind.js";
import { ComputationOverrideError } from "../computation/ComputationOverrideError.js";
import type { Computed } from "../computation/Computed.js";
import type { Objective } from "../values/Objective.js";
import type { LenientRange } from "../values/Range.js";
import type { Timestamp } from "../values/Timestamp.js";
import type { Weight } from "../values/Weight.js";

import { BusinessScoreNode } from "./BusinessScoreNode.js";

/**
 * `ComputedBusinessScoreNode<T>` — v4 concrete value-bearing node whose value
 * is auto-derived from its children via a polymorphic `Computation<T>` strategy
 * AND whose value-domain is bounded by a `LenientRange<T>` AND which carries a
 * single goal-point `Objective<T>` (SPEC §17.98 / v5 round 7; mirrors
 * `class ComputedBusinessScoreNode~T~` + `BusinessScoreNode~T~ <|--
 * ComputedBusinessScoreNode~T~` + `ComputedBusinessScoreNode~T~ ..|>
 * Computed~T~` in the v5 class diagram).
 *
 * Second concrete realisation of `Computed<T>` after §17.97 `ComputedNode<T>`.
 * Both classes share the audit-only override contract; they differ only in
 * what they inherit. `ComputedNode<T>` extends `HistorizableValueNode<T>`
 * (history-only — text-typed or raw-scalar auto-derived metrics);
 * `ComputedBusinessScoreNode<T>` extends `BusinessScoreNode<T>` (history +
 * range + objective + unit — auto-derived metric ALSO scored against a target).
 *
 * Three structural traits per §17.94 design:
 *  - **`getValue()` dispatches via the cached strategy** — same
 *    `ComputationCache<T>` composition as §17.97; the helper centralises the
 *    cached `(kind, strategy)` pair + the §17.94 risk row 1 type-erasure cast.
 *  - **`setValue` + `addValue` throw `ComputationOverrideError`** per §17.94
 *    D5. The inherited `BusinessScoreNode<T>.range.requireValue` gate (§17.75
 *    `RangedValueNode<T>.addValue` override) is bypassed harmlessly because
 *    the override throws BEFORE delegating to `super.addValue` — and the
 *    lenient gate is a no-op anyway (§17.71 `LenientRange.requireValue` is
 *    the empty op), so no behavioural contract is violated. `entries()` /
 *    `removeValue` / `range` / `objective` / `unit` all stay inherited.
 *  - **Computed-ness is now class identity** — §17.98 originally forced the
 *    §17.93 `BusinessScoreNode<T>.computed: boolean` band-aid to `true` in
 *    the `super()` call so the §17.93 read-side mapper would render
 *    auto-derived BSCs correctly without requiring any mapper-side change
 *    at §17.98. The §17.99c retirement strand drops the band-aid field
 *    entirely; computed BSC detection is now a polymorphic `node instanceof
 *    ComputedBusinessScoreNode` check at the `computedValue` aggregation
 *    site (the only v4 consumer of the band-aid prior to retirement; the
 *    view-model mapper never read it). The §17.93 sister band-aid
 *    `eligibleForParentComputation` is retired at §17.99b — operators
 *    needing an auto-derived BSC excluded from a parent's mean call
 *    `node.setDisabled(true)` on the produced instance (the §17.99a
 *    successor field on `ValueNode<T>` with broader UI-grey-out semantics).
 */
export class ComputedBusinessScoreNode<T> extends BusinessScoreNode<T> implements Computed<T> {
  private readonly _cache: ComputationCache<T>;

  constructor(
    id: string,
    title: string,
    weight: Weight,
    description: string,
    clock: Clock,
    range: LenientRange<T>,
    options: {
      objective: Objective<T>;
      initialKind: ComputationKind;
      unit?: string;
    },
  ) {
    super(id, title, weight, description, clock, range, {
      objective: options.objective,
      unit: options.unit,
    });
    this._cache = new ComputationCache<T>(options.initialKind);
  }

  get computationKind(): ComputationKind { return this._cache.kind; }
  get computation(): Computation<T> { return this._cache.strategy; }

  setComputationKind(kind: ComputationKind): void { this._cache.set(kind); }

  override getValue(): T {
    return this._cache.strategy.apply(this.children);
  }

  override setValue(_value: T): void {
    throw new ComputationOverrideError(this.id);
  }

  override addValue(_timestamp: Timestamp, _value: T): void {
    throw new ComputationOverrideError(this.id);
  }
}
