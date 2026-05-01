import type { ContributesToParent } from "../capabilities/ContributesToParent.js";
import type { HasObjective } from "../capabilities/HasObjective.js";
import type { Historizable } from "../capabilities/Historizable.js";
import type { NodeIdentity } from "../values/NodeIdentity.js";
import type { Objective } from "../values/Objective.js";
import type { TimestampedValue } from "../values/TimestampedValue.js";
import type { Weight } from "../values/Weight.js";
import type { BusinessScoreCard } from "./BusinessScoreCard.js";
import { EmptyHistoryError } from "./EmptyHistoryError.js";
import { TreeNode } from "./TreeNode.js";

// Back-compat re-export: pre-§17.14 callers imported `EmptyHistoryError`
// from this module. The error now lives in its own file (shared with
// `TextNode`), but consumer paths through this module keep working.
export { EmptyHistoryError };

export class BusinessScoreCardNode<T>
  extends TreeNode<T>
  implements Historizable<T>, HasObjective<T>, ContributesToParent<T>
{
  private _computed: boolean;
  private _eligibleForParentComputation: boolean;

  constructor(
    id: string,
    identity: NodeIdentity,
    weight: Weight,
    readonly card: BusinessScoreCard<T>,
    computed: boolean,
    eligibleForParentComputation: boolean,
  ) {
    super(id, identity, weight);
    this._computed = computed;
    this._eligibleForParentComputation = eligibleForParentComputation;
  }

  /**
   * `computed` / `eligibleForParentComputation` are exposed via getters
   * so the §17.28 edit flow can flip them in place through dedicated
   * setters. Same rationale as `TreeNode.setIdentity` / `setWeight`:
   * a single explicit mutation surface, identical read access path.
   */
  get computed(): boolean {
    return this._computed;
  }

  get eligibleForParentComputation(): boolean {
    return this._eligibleForParentComputation;
  }

  setComputed(value: boolean): void {
    this._computed = value;
  }

  setEligibleForParentComputation(value: boolean): void {
    this._eligibleForParentComputation = value;
  }

  history(): readonly TimestampedValue<T>[] {
    return this.card.history();
  }

  objective(): Objective<T> {
    return this.card.objective;
  }

  isEligible(): boolean {
    return this._eligibleForParentComputation;
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
