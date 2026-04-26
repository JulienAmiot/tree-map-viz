import { implementsContributesToParent } from "../capabilities/capabilityGuards.js";
import type { ContributesToParent } from "../capabilities/ContributesToParent.js";
import type { BusinessScoreCardNode } from "../nodes/BusinessScoreCardNode.js";
import type { TreeNode } from "../nodes/TreeNode.js";
import type { TimestampedValue } from "../values/TimestampedValue.js";

export type ComputedValueResult<T = unknown> =
  | { kind: "recordedValue"; value: TimestampedValue<T> }
  | { kind: "computedValue"; value: number }
  | { kind: "childrenCount"; n: number };

type EligibleChild = TreeNode<unknown> & ContributesToParent<unknown>;

export function computedValue<T>(node: BusinessScoreCardNode<T>): ComputedValueResult<T> {
  if (!node.computed) {
    return { kind: "recordedValue", value: node.currentValue() };
  }

  const children = node.children;
  const eligible: EligibleChild[] = [];
  for (const child of children) {
    if (implementsContributesToParent(child) && child.isEligible()) {
      eligible.push(child);
    }
  }

  if (eligible.length === 0) {
    return { kind: "childrenCount", n: children.length };
  }

  let weightedSum = 0;
  let weightSum = 0;
  for (const child of eligible) {
    const contribution = child.contribution();
    weightedSum += Number(contribution.value) * child.weight.value;
    weightSum += child.weight.value;
  }
  return { kind: "computedValue", value: weightedSum / weightSum };
}
