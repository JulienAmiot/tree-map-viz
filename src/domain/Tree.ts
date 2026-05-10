import type { Node } from "./nodes/Node.js";

/**
 * `Tree` — v4 container wrapping the root of a node graph (SPEC §17.79;
 * mirrors `class Tree { +Node root; +findById(id) Node?; +nodes()
 * readonly Node[] }` in the v4 class diagram with the `Tree *-- "1"
 * Node : root` composition).
 *
 * Closes the v4 class-diagram side. The diagram declares three top-
 * level clusters beyond value objects: the Node taxonomy (closed at
 * §17.77), the Card visual layer (closed at §17.78), and this `Tree`
 * container. Tree is intentionally minimal — it's a thin orchestration
 * layer over the Node hierarchy's existing `parent` / `children` /
 * `attach` / `detach` graph (§17.72 Node base), not a separate
 * data structure. The actual tree shape is held by the Nodes
 * themselves; Tree is just the named entry point ("here is the root,
 * walk from here").
 *
 * No V4 suffix — no v3 namesake (v3 had `treeQueries.ts` as a
 * function-only utility and `TreeNavigationService.ts` as a service,
 * but never a `Tree` class). Ships under its v4-final name directly.
 * Lives at `src/domain/Tree.ts` (flat in domain root) since it's
 * neither a Node nor a Card; the directory split inside `domain/`
 * mirrors the diagram's clustering.
 *
 * `root` is a public readonly field per the diagram's `+Node root`
 * notation. The reference is fixed at construction; the rooted
 * subtree's shape can still mutate via `root.attach(child)` /
 * `root.detach(child)` on Node, which is the diagram's intended
 * mutation surface (`Node "0..1" o-- "0..*" Node : children / parent`,
 * with `attach` / `detach` as the maintenance methods).
 */
export class Tree {
  constructor(readonly root: Node) {}

  /**
   * Pre-order DFS lookup by id. Returns the first node whose `id`
   * matches; `undefined` if no such node exists. The diagram
   * marks the return type `Node?`, which TS spells as `Node |
   * undefined`. Pre-order matches `nodes()` for consistency: a
   * caller iterating `tree.nodes()` and a caller calling
   * `tree.findById(x)` walk the same order.
   */
  findById(id: string): Node | undefined {
    return Tree.findByIdFrom(this.root, id);
  }

  private static findByIdFrom(node: Node, id: string): Node | undefined {
    if (node.id === id) {
      return node;
    }
    for (const child of node.children) {
      const hit = Tree.findByIdFrom(child, id);
      if (hit !== undefined) {
        return hit;
      }
    }
    return undefined;
  }

  /**
   * Pre-order DFS flattening. Returns a frozen snapshot of every
   * Node reachable from `root`, root first then each child's
   * subtree in order. The diagram marks the return type `readonly
   * Node[]`; we honour that with `Object.freeze` on a fresh array
   * so callers can't mutate the result back into the tree.
   */
  nodes(): readonly Node[] {
    const out: Node[] = [];
    Tree.collectInto(this.root, out);
    return Object.freeze(out);
  }

  private static collectInto(node: Node, out: Node[]): void {
    out.push(node);
    for (const child of node.children) {
      Tree.collectInto(child, out);
    }
  }
}
