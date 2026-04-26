import type { ContributesToParent } from "../capabilities/ContributesToParent.js";
import type { HasObjective } from "../capabilities/HasObjective.js";
import type { Historizable } from "../capabilities/Historizable.js";
import type { NodeIdentity } from "../values/NodeIdentity.js";
import type { Objective } from "../values/Objective.js";
import type { TimestampedValue } from "../values/TimestampedValue.js";
import type { Weight } from "../values/Weight.js";
import type { BusinessScoreCard } from "./BusinessScoreCard.js";
import { TreeNode } from "./TreeNode.js";

export class EmptyHistoryError extends Error {
  constructor(nodeId: string) {
    super(`BusinessScoreCardNode "${nodeId}" has no recorded values yet`);
    this.name = "EmptyHistoryError";
  }
}

export class BusinessScoreCardNode<T>
  extends TreeNode<T>
  implements Historizable<T>, HasObjective<T>, ContributesToParent<T>
{
  constructor(
    id: string,
    identity: NodeIdentity,
    weight: Weight,
    readonly card: BusinessScoreCard<T>,
    readonly computed: boolean,
    readonly eligibleForParentComputation: boolean,
  ) {
    super(id, identity, weight);
  }

  history(): readonly TimestampedValue<T>[] {
    return this.card.history();
  }

  objective(): Objective<T> {
    return this.card.objective;
  }

  isEligible(): boolean {
    return this.eligibleForParentComputation;
  }

  contribution(): TimestampedValue<T> {
    return this.currentValue();
  }

  currentValue(): TimestampedValue<T> {
    const history = this.card.history();
    const latest = history.at(-1);
    if (latest === undefined) {
      throw new EmptyHistoryError(this.id);
    }
    return latest;
  }
}
