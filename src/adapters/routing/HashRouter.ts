/**
 * Hash-based router adapter implementing the `Router` port (SPEC §9).
 *
 * Wire format: `#/b/<boardId>/n/<focusNodeUuid>`. Other hash shapes are
 * deliberately ignored — `parse` and `current` return `null`, and
 * `onChange` forwards `null` so subscribers can fall back to the board
 * root with `replaceState` (SPEC line 206).
 *
 * Browser globals are injected via the `RouterEnv` interface so the same
 * implementation can be driven by the real `window` in production and by
 * a stub in unit tests.
 */

import type { Router, RouteState } from "../../application/ports/Router.js";

const HASH_PATTERN = /^#\/b\/([^/]+)\/n\/([^/]+)$/;

/**
 * Browser-context surface the router needs. Subset of `Window` — small
 * enough to stub in tests, real `window` satisfies it structurally in app code.
 */
export interface RouterEnv {
  readonly location: Pick<Location, "hash">;
  readonly history: Pick<History, "pushState" | "replaceState">;
  addEventListener(type: "hashchange", listener: EventListener): void;
  removeEventListener(type: "hashchange", listener: EventListener): void;
}

export class HashRouter implements Router {
  constructor(private readonly env: RouterEnv) {}

  parse(hash: string): RouteState | null {
    const match = HASH_PATTERN.exec(hash);
    if (!match) {
      return null;
    }
    const [, boardId, focusNodeUuid] = match;
    if (!boardId || !focusNodeUuid) {
      return null;
    }
    return { boardId, focusNodeUuid };
  }

  build(state: RouteState): string {
    return `#/b/${state.boardId}/n/${state.focusNodeUuid}`;
  }

  current(): RouteState | null {
    return this.parse(this.env.location.hash);
  }

  push(state: RouteState): void {
    this.env.history.pushState(null, "", this.build(state));
  }

  replace(state: RouteState): void {
    this.env.history.replaceState(null, "", this.build(state));
  }

  onChange(handler: (state: RouteState | null) => void): () => void {
    const listener: EventListener = () => {
      handler(this.current());
    };
    this.env.addEventListener("hashchange", listener);
    return () => {
      this.env.removeEventListener("hashchange", listener);
    };
  }
}
