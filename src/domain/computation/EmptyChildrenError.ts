/**
 * Thrown by `Computation<T>.apply(children)` (SPEC §17.95 / v5 round 7)
 * when no eligible non-disabled children remain after the strategy's
 * eligibility filter. Numeric strategies (SUM / AVERAGE / MIN / MAX /
 * WEIGHTED_AVERAGE) require at least one child with a finite numeric
 * `getValue()`; COUNT returns 0 on the empty set instead (§17.94 risk
 * register decision #2) so it never raises.
 *
 * Mirrors the `EmptyHistoryError` (§17.73) shape — stable `name` set
 * explicitly so `instanceof`-based recovery works across module
 * boundaries, message templated with the strategy kind + an optional
 * parent hint so the operator can locate the empty aggregator in the
 * tree without re-querying.
 */
export class EmptyChildrenError extends Error {
  constructor(kind: string, parentHint?: string) {
    const where =
      parentHint !== undefined && parentHint.length > 0
        ? ` for parent "${parentHint}"`
        : "";
    super(`${kind} computation has no eligible children${where}`);
    this.name = "EmptyChildrenError";
  }
}
