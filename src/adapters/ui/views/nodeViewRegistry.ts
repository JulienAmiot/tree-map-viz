/**
 * Registry mapping `(kind, role) → custom-element tag name` used by the
 * `<node-view>` dispatcher (SPEC §5 — Dispatcher / OCP).
 *
 * Adding a new node kind = register one entry; the dispatcher needs no edit.
 *
 * Lifecycle:
 *   1. App start: each per-kind module registers its (asParent, asChild) tags
 *      via `nodeViewRegistry.register(kind, { asParent, asChild })`.
 *   2. After all kinds are registered, the views barrel calls
 *      `nodeViewRegistry.freeze()` — further `register()` calls throw.
 *   3. `<node-view>` calls `lookup(kind, role)` on every render.
 *
 * Tests can call `nodeViewRegistry.__resetForTests()` between cases to start
 * from an empty, unfrozen registry. The double-underscore prefix mirrors the
 * `__appTestApi__` convention from `src/adapters/testBridge.ts` — name shouts
 * "non-production seam".
 */

import type { NodeKind, NodeRole } from "./NodeViewModel.js";

export class NodeViewRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NodeViewRegistryError";
  }
}

type RegistryEntry = {
  readonly asParent: string;
  readonly asChild: string;
};

class NodeViewRegistryImpl {
  private readonly entries = new Map<NodeKind, RegistryEntry>();
  private frozen = false;

  register(kind: NodeKind, entry: RegistryEntry): void {
    if (this.frozen) {
      throw new NodeViewRegistryError(
        `nodeViewRegistry: cannot register "${kind}" after freeze()`,
      );
    }
    if (this.entries.has(kind)) {
      throw new NodeViewRegistryError(
        `nodeViewRegistry: kind "${kind}" already registered`,
      );
    }
    this.entries.set(kind, { asParent: entry.asParent, asChild: entry.asChild });
  }

  freeze(): void {
    this.frozen = true;
  }

  isFrozen(): boolean {
    return this.frozen;
  }

  lookup(kind: NodeKind, role: NodeRole): string {
    const entry = this.entries.get(kind);
    if (!entry) {
      throw new NodeViewRegistryError(
        `nodeViewRegistry: no view registered for kind "${kind}"`,
      );
    }
    return role === "asParent" ? entry.asParent : entry.asChild;
  }

  /** Test-only: clear all entries and unfreeze. Never call from production code. */
  __resetForTests(): void {
    this.entries.clear();
    this.frozen = false;
  }
}

export const nodeViewRegistry = new NodeViewRegistryImpl();
