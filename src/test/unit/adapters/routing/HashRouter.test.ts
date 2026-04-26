import { beforeEach, describe, expect, it, vi } from "vitest";

import { HashRouter, type RouterEnv } from "../../../../adapters/routing/HashRouter.js";

// ---------------------------------------------------------------------------
// Test scaffolding — a stub Window-like environment for the router.
// ---------------------------------------------------------------------------

class StubEnv implements RouterEnv {
  hash = "";
  pushState = vi.fn<(data: unknown, title: string, url?: string | null) => void>();
  replaceState = vi.fn<(data: unknown, title: string, url?: string | null) => void>();
  private listeners = new Set<EventListener>();

  get location(): Location {
    const self = this;
    return { get hash() { return self.hash; } } as unknown as Location;
  }

  get history(): History {
    return { pushState: this.pushState, replaceState: this.replaceState } as unknown as History;
  }

  addEventListener(type: "hashchange", listener: EventListener): void {
    if (type === "hashchange") {
      this.listeners.add(listener);
    }
  }

  removeEventListener(type: "hashchange", listener: EventListener): void {
    if (type === "hashchange") {
      this.listeners.delete(listener);
    }
  }

  /** Test helper: simulate a browser hash change. */
  fireHashChange(newHash: string): void {
    this.hash = newHash;
    for (const l of this.listeners) {
      l(new Event("hashchange"));
    }
  }

  hasListeners(): boolean {
    return this.listeners.size > 0;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HashRouter", () => {
  let env: StubEnv;
  let router: HashRouter;

  beforeEach(() => {
    env = new StubEnv();
    router = new HashRouter(env);
  });

  describe("parse", () => {
    it("parses the canonical shape #/b/<boardId>/n/<uuid>", () => {
      expect(router.parse("#/b/board-1/n/uuid-abc")).toEqual({
        boardId: "board-1",
        focusNodeUuid: "uuid-abc",
      });
    });

    it("parses uuids with hyphens (RFC4122 v4 shape)", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      expect(router.parse(`#/b/board-1/n/${uuid}`)).toEqual({
        boardId: "board-1",
        focusNodeUuid: uuid,
      });
    });

    it("returns null for non-matching hash shapes (per SPEC §9 'ignores other hash shapes')", () => {
      expect(router.parse("")).toBeNull();
      expect(router.parse("#")).toBeNull();
      expect(router.parse("#/b/abc")).toBeNull();
      expect(router.parse("#/b/abc/n/")).toBeNull();
      expect(router.parse("#/b//n/uuid")).toBeNull();
      expect(router.parse("#/n/uuid/b/abc")).toBeNull();
      expect(router.parse("#/foo/bar")).toBeNull();
      expect(router.parse("#b/abc/n/uuid")).toBeNull();
      expect(router.parse("/b/abc/n/uuid")).toBeNull();
    });

    it("returns null when an extra path segment is appended", () => {
      expect(router.parse("#/b/abc/n/uuid/extra")).toBeNull();
    });
  });

  describe("build", () => {
    it("builds the canonical hash including the leading '#'", () => {
      expect(router.build({ boardId: "b1", focusNodeUuid: "u1" })).toBe("#/b/b1/n/u1");
    });

    it("build then parse round-trips", () => {
      const state = { boardId: "alpha", focusNodeUuid: "node-42" };
      expect(router.parse(router.build(state))).toEqual(state);
    });
  });

  describe("current", () => {
    it("reads location.hash and parses it", () => {
      env.hash = "#/b/cur/n/me";
      expect(router.current()).toEqual({ boardId: "cur", focusNodeUuid: "me" });
    });

    it("returns null when location.hash doesn't match the contract", () => {
      env.hash = "#nope";
      expect(router.current()).toBeNull();
    });
  });

  describe("push", () => {
    it("invokes history.pushState with the built URL", () => {
      router.push({ boardId: "abc", focusNodeUuid: "xyz" });
      expect(env.pushState).toHaveBeenCalledTimes(1);
      const args = env.pushState.mock.calls[0]!;
      expect(args[2]).toBe("#/b/abc/n/xyz");
    });

    it("does not call replaceState", () => {
      router.push({ boardId: "abc", focusNodeUuid: "xyz" });
      expect(env.replaceState).not.toHaveBeenCalled();
    });
  });

  describe("replace", () => {
    it("invokes history.replaceState with the built URL", () => {
      router.replace({ boardId: "abc", focusNodeUuid: "xyz" });
      expect(env.replaceState).toHaveBeenCalledTimes(1);
      const args = env.replaceState.mock.calls[0]!;
      expect(args[2]).toBe("#/b/abc/n/xyz");
    });

    it("does not call pushState", () => {
      router.replace({ boardId: "abc", focusNodeUuid: "xyz" });
      expect(env.pushState).not.toHaveBeenCalled();
    });
  });

  describe("onChange", () => {
    it("invokes the handler on hashchange with the parsed state", () => {
      const handler = vi.fn();
      router.onChange(handler);

      env.fireHashChange("#/b/b1/n/u1");

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ boardId: "b1", focusNodeUuid: "u1" });
    });

    it("invokes the handler with null for non-matching hashes", () => {
      const handler = vi.fn();
      router.onChange(handler);

      env.fireHashChange("#nope");

      expect(handler).toHaveBeenCalledWith(null);
    });

    it("returns an unsubscribe function that detaches the listener", () => {
      const handler = vi.fn();
      const unsubscribe = router.onChange(handler);

      env.fireHashChange("#/b/b/n/u");
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
      env.fireHashChange("#/b/b/n/u2");
      expect(handler).toHaveBeenCalledTimes(1);
      expect(env.hasListeners()).toBe(false);
    });

    it("supports multiple independent subscribers", () => {
      const a = vi.fn();
      const b = vi.fn();
      router.onChange(a);
      router.onChange(b);

      env.fireHashChange("#/b/x/n/y");

      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });
  });
});
