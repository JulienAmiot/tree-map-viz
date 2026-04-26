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

  constructor(
    readonly id: string,
    readonly identity: NodeIdentity,
    readonly weight: Weight,
  ) {}

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
