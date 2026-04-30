/**
 * Thrown by any `TreeNode` whose `currentValue()` is asked for before its
 * history has at least one `TimestampedValue` (SPEC §3 + §17.13/§17.14).
 *
 * Both `BusinessScoreCardNode` (numeric history) and `TextNode` (string
 * history) raise this error from a shared module so `instanceof`-based
 * recovery in the application + UI layers does not need to know which
 * concrete subclass produced it.
 */
export class EmptyHistoryError extends Error {
  constructor(nodeId: string) {
    super(`Node "${nodeId}" has no recorded values yet`);
    this.name = "EmptyHistoryError";
  }
}
