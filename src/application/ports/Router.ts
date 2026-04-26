/**
 * Application port for hash-based routing per SPEC §9.
 *
 * Wire format: `#/b/<boardId>/n/<focusNodeUuid>`.
 *
 * Other hash shapes (`#/foo`, empty, ...) are not part of the contract:
 * `parse` returns `null` for them and adapters MUST ignore them in `current`.
 */

export type RouteState = {
  readonly boardId: string;
  readonly focusNodeUuid: string;
};

export interface Router {
  /** Parse a raw hash string (e.g. `"#/b/abc/n/xyz"`); returns `null` if it doesn't match the contract. */
  parse(hash: string): RouteState | null;

  /** Build the canonical hash for a route state, including the leading `#`. */
  build(state: RouteState): string;

  /** Return the current route from the underlying location, or `null` if it doesn't match. */
  current(): RouteState | null;

  /** Navigate to `state` using `history.pushState` (creates a new history entry). */
  push(state: RouteState): void;

  /** Replace the current entry with `state` using `history.replaceState` (no new history entry). */
  replace(state: RouteState): void;

  /**
   * Subscribe to route changes. The handler fires on `hashchange` with the
   * parsed route (or `null` for non-matching hashes).
   * Returns an unsubscribe function.
   */
  onChange(handler: (state: RouteState | null) => void): () => void;
}
