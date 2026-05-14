/**
 * Raised by `Computation<T>.apply()` (SPEC §17.95) when no eligible
 * non-disabled child survives the strategy's filters. Numeric strategies
 * raise; `CountComputation` returns 0 instead (§17.94 risk #2). Stable
 * `name` mirrors §17.73 `EmptyHistoryError` for cross-module `instanceof`.
 */
export class EmptyChildrenError extends Error {
  constructor(kind: string) {
    super(`${kind} computation has no eligible children`);
    this.name = "EmptyChildrenError";
  }
}
