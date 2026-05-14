/**
 * Raised by `setValue` / `addValue` on `Computed<T>` nodes (SPEC §17.96 /
 * v5 round 7; §17.94 D5 — history is audit-only). The inherited
 * `HistorizableValueNode<T>.history` field on `ComputedNode<T>` /
 * `ComputedBusinessScoreNode<T>` records the computed value at each
 * evaluation point as a forensics trail ("what was this metric computing
 * in March?"); the operator cannot overwrite the computation, only edit
 * the children or change the `computationKind`.
 *
 * Stable `name` mirrors §17.73 `EmptyHistoryError` shape so cross-module
 * `instanceof`-based recovery in the UI + write services doesn't need to
 * know which concrete Computed* subclass raised it. Call sites land at
 * §17.97 + §17.98 when ComputedNode + ComputedBusinessScoreNode override
 * `setValue` / `addValue` to throw this error.
 */
export class ComputationOverrideError extends Error {
  constructor(nodeId: string) {
    super(
      `Node "${nodeId}" is computed: history is audit-only — edit the children or change the computationKind`,
    );
    this.name = "ComputationOverrideError";
  }
}
