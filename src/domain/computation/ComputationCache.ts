import type { Computation } from "./Computation.js";
import type { ComputationKind } from "./ComputationKind.js";
import { ComputationRegistry } from "./ComputationRegistry.js";

/**
 * `ComputationCache<T>` — internal helper class extracted at §17.98 to
 * deduplicate the cached-strategy + setComputationKind-invalidates-cache
 * mechanism shared by §17.97 `ComputedNode<T>` and §17.98
 * `ComputedBusinessScoreNode<T>` (both implement `Computed<T>` and both
 * need to amortise `ComputationRegistry.resolve` to O(1) per kind change
 * per §17.94 risk row 6).
 *
 * NOT part of the v5 class diagram — this is an implementation detail the
 * two Computed* classes compose privately (no `Computed<T>` interface
 * member exposes the cache). The public `Computed<T>` surface stays
 * `{ computationKind, computation, setComputationKind }` unchanged from
 * §17.96; consumers traverse `node.computation` → strategy and never see
 * the cache directly.
 *
 * The §17.94 risk row 1 type-erasure cast (`ComputationRegistry.resolve`
 * returns `Computation<number>`, cast to `Computation<T>`) lives here as
 * the single canonical site — pre-§17.98 it was duplicated at every
 * `Computed<T>` impl's constructor + setComputationKind. Today's only
 * valid instantiation is `ComputationCache<number>`; a future
 * non-numeric strategy would widen the registry's return type and the
 * cast site here.
 */
export class ComputationCache<T> {
  private _kind: ComputationKind;
  private _strategy: Computation<T>;

  constructor(initial: ComputationKind) {
    this._kind = initial;
    this._strategy = ComputationRegistry.resolve(initial) as Computation<T>;
  }

  get kind(): ComputationKind { return this._kind; }
  get strategy(): Computation<T> { return this._strategy; }

  set(kind: ComputationKind): void {
    this._kind = kind;
    this._strategy = ComputationRegistry.resolve(kind) as Computation<T>;
  }
}
