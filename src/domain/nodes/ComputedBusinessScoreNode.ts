import type { Clock } from "../capabilities/Clock.js";
import { ComputationCache } from "../computation/ComputationCache.js";
import type { Computation } from "../computation/Computation.js";
import type { ComputationKind } from "../computation/ComputationKind.js";
import { ComputationOverrideError } from "../computation/ComputationOverrideError.js";
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
 *  - **`computed` band-aid hardwired to `true`** — the §17.93
 *    `BusinessScoreNode<T>.computed: boolean` field (v3-compat band-aid
 *    keeping the §17.93 read-side mapper rendering computed BSCs correctly)
 *    is forced to `true` in the `super()` call regardless of the operator's
 *    options. A `ComputedBusinessScoreNode<T>` IS computed by class identity
 *    — the flag becomes redundant once §17.91's successor learns to
 *    type-switch on this class. Forcing it `true` keeps the existing §17.93
 *    mapper happy WHEN this class first reaches the production bundle,
 *    without requiring any mapper-side change at §17.98.
 *    `eligibleForParentComputation` stays operator-controllable (independent
 *    semantics — "include this score in the parent's mean even though it's
 *    auto-derived").
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
