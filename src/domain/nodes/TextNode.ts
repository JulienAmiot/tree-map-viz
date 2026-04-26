import type { TimestampedValue } from "../values/TimestampedValue.js";
import { TreeNode } from "./TreeNode.js";

export class NotValuedError extends Error {
  constructor(nodeId: string) {
    super(`TextNode "${nodeId}" has no value: currentValue() is not defined for text-only nodes`);
    this.name = "NotValuedError";
  }
}

export class TextNode extends TreeNode<never> {
  currentValue(): TimestampedValue<never> {
    throw new NotValuedError(this.id);
  }
}
