import type { NodeIdentity } from "../values/NodeIdentity.js";
import type { TimestampedValue } from "../values/TimestampedValue.js";
import type { Weight } from "../values/Weight.js";

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

export abstract class TreeNode<T> {
  private _parent: TreeNode<unknown> | null = null;
  private readonly _children: TreeNode<unknown>[] = [];
  private _identity: NodeIdentity;
  private _weight: Weight;

  constructor(
    readonly id: string,
    identity: NodeIdentity,
    weight: Weight,
  ) {
    this._identity = identity;
    this._weight = weight;
  }

  /**
   * `identity` and `weight` are exposed as **getters** (not constructor
   * `readonly` fields) so the domain has a single, explicit mutation
   * surface (`setIdentity` / `setWeight`) that the EditNode application
   * service uses (SPEC §17.28). External readers keep the same property
   * access path (`node.identity`, `node.weight`) — no caller change.
   *
   * Why setters at all: the §17.28 edit flow needs to update a node's
   * title, description, or weight in place without rebuilding the whole
   * sub-tree. NodeIdentity / Weight stay immutable value objects; the
   * setter swaps the *reference* to a freshly-built one, so structural
   * sharing of the rest of the node (children, card history, …) is
   * preserved across edits.
   */
  get identity(): NodeIdentity {
    return this._identity;
  }

  get weight(): Weight {
    return this._weight;
  }

  setIdentity(identity: NodeIdentity): void {
    this._identity = identity;
  }

  setWeight(weight: Weight): void {
    this._weight = weight;
  }

  get parent(): TreeNode<unknown> | null {
    return this._parent;
  }

  get children(): readonly TreeNode<unknown>[] {
    return Object.freeze([...this._children]);
  }

  attach(child: TreeNode<unknown>): void {
    if (child._parent !== null) {
      throw new AlreadyAttachedError(child.id);
    }
    child._parent = this;
    this._children.push(child);
  }

  detach(child: TreeNode<unknown>): void {
    const index = this._children.indexOf(child);
    if (index === -1) {
      throw new NotAChildError(child.id, this.id);
    }
    this._children.splice(index, 1);
    child._parent = null;
  }

  abstract currentValue(): TimestampedValue<T>;
}
