import type { Weight } from "../values/Weight.js";

/**
 * `Node` — v4 abstract base of the node hierarchy (SPEC §17.72; mirrors
 * `<<abstract>> class Node` in the v4 class diagram). Successor to v3's
 * `TreeNode<T>`. Two structural deltas vs v3: the type parameter `T`
 * drops down to `ValueNode<T>` (Node itself is non-generic), and `title`
 * / `id` are plain `string` per the diagram's `+String` notation (v4
 * dissolves the v3 `Title` / `NodeIdentity` VOs; description splits off
 * onto `ValueNode<T>` — see `ValueNode.ts`).
 *
 * `attach` / `detach` errors live in this file post-§17.112 v3 sweep
 * (originally hosted by the v3 `TreeNode.ts` and re-imported here while
 * v3 was alive; the §17.111 docblock predicted "will migrate to this
 * file when v3 retires" and §17.112 closes that loop). Mutability
 * matches the v3 setter pattern (`setTitle` / `setWeight` swap the
 * reference; `id` is permanently `readonly`).
 */
export class AlreadyAttachedError extends Error {
  constructor(childId: string) {
    super(`Node "${childId}" is already attached to a parent`);
    this.name = "AlreadyAttachedError";
  }
}

export class NotAChildError extends Error {
  constructor(childId: string, parentId: string) {
    super(`Node "${childId}" is not a child of "${parentId}"`);
    this.name = "NotAChildError";
  }
}
export abstract class Node {
  private _parent: Node | null = null;
  private readonly _children: Node[] = [];
  private _title: string;
  private _weight: Weight;

  protected constructor(
    readonly id: string,
    title: string,
    weight: Weight,
  ) {
    this._title = title;
    this._weight = weight;
  }

  get title(): string {
    return this._title;
  }

  get weight(): Weight {
    return this._weight;
  }

  setTitle(title: string): void {
    this._title = title;
  }

  setWeight(weight: Weight): void {
    this._weight = weight;
  }

  get parent(): Node | null {
    return this._parent;
  }

  get children(): readonly Node[] {
    return Object.freeze([...this._children]);
  }

  attach(child: Node): void {
    if (child._parent !== null) {
      throw new AlreadyAttachedError(child.id);
    }
    child._parent = this;
    this._children.push(child);
  }

  detach(child: Node): void {
    const index = this._children.indexOf(child);
    if (index === -1) {
      throw new NotAChildError(child.id, this.id);
    }
    this._children.splice(index, 1);
    child._parent = null;
  }
}
