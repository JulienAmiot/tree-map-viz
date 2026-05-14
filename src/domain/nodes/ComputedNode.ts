import type { Clock } from "../capabilities/Clock.js";
import { ComputationCache } from "../computation/ComputationCache.js";
import type { Computation } from "../computation/Computation.js";
import type { ComputationKind } from "../computation/ComputationKind.js";
import { ComputationOverrideError } from "../computation/ComputationOverrideError.js";
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
 * subclass.
 *
 * Three structural traits per §17.94 design:
 *  - **`getValue()` dispatches via the cached strategy** — returns
 *    `this._cache.strategy.apply(this.children)`. The strategy cache is the
 *    §17.98-extracted `ComputationCache<T>` helper (deduplicates the cached
 *    `(kind, strategy)` pair shared with `ComputedBusinessScoreNode<T>`).
 *    Strategy resolved O(1) per kind change per §17.94 risk row 6.
 *  - **`setValue` + `addValue` throw `ComputationOverrideError`** per §17.94
 *    D5 — history is audit-only. The inherited `entries()` getter stays
 *    readable but is never operator-populated through this strand; future
 *    write-side strands at §17.101+ will add a stamping path. `removeValue`
 *    stays inherited (operator can prune the audit trail without violating
 *    the "no overwrite" contract).
 *  - **Type-erasure across the registry boundary** — moved to
 *    `ComputationCache<T>` at §17.98 (was inline here pre-§17.98 + duplicated
 *    in `ComputedBusinessScoreNode<T>`; the cache now owns the single
 *    canonical cast site). See `ComputationCache.ts`'s docblock.
 */
export class ComputedNode<T> extends HistorizableValueNode<T> implements Computed<T> {
  private readonly _cache: ComputationCache<T>;

  constructor(
    id: string,
    title: string,
    weight: Weight,
    description: string,
    clock: Clock,
    initialKind: ComputationKind,
  ) {
    super(id, title, weight, description, clock);
    this._cache = new ComputationCache<T>(initialKind);
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
