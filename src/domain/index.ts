/**
 * Public domain barrel (SPEC §3 / §17.111).
 *
 * Surfaces the v4 domain layer to application + adapters. Domain modules MUST
 * NOT import from `application/**`, `adapters/**`, or any browser API
 * (SPEC §12, Phase 1).
 *
 * Organization mirrors the v4 class diagram
 * (`examples/classDiagramMermaid.v3.mermaid`): values → capabilities →
 * computation → cards → nodes → Tree → aggregation → capacity → layout.
 *
 * §17.111 Phase E cleanup — the post-§17.110 cutover barrel. Every v3-only
 * export retires here (Title / Description / NodeIdentity / Objective VOs;
 * the three capability mixins `Historizable` / `HasObjective` /
 * `ContributesToParent` + `capabilityGuards`; `TreeNode` / `TextNode` /
 * `BusinessScoreCardNode` / `BusinessScoreCard` / `TextCard` v3 nodes +
 * cards; v3 `computedValue` + `currentValueDateIso`; v3 `childrenCapacity`
 * + `treeQueries`). The v3 source files stay live until §17.112+ Phase F
 * deletion because the §17.107 LSR's v3-fallback shim still uses the v3
 * codec + `v4TreeFromV3Root` bridge; the barrel just stops advertising
 * them as public domain surface.
 */

export type { Clock } from "./capabilities/Clock.js";
export type { Ranged } from "./capabilities/Ranged.js";

export { Weight, InvalidWeightError } from "./values/Weight.js";
export { Unit, InvalidUnitError } from "./values/Unit.js";
export { Timestamp, InvalidTimestampError } from "./values/Timestamp.js";
export { TimestampedValue } from "./values/TimestampedValue.js";
export { Objective } from "./values/Objective.js";
export { Range, StrictRange, LenientRange, OutOfRangeError } from "./values/Range.js";
export type { Comparator } from "./values/Comparator.js";
export { NumericComparator, LexicographicComparator } from "./values/Comparator.js";
export { Direction } from "./values/Direction.js";
export {
  WorkflowStatus,
  InvalidWorkflowStatusError,
  DEFAULT_WORKFLOW_STATUSES,
  DEFAULT_WORKFLOW_STATUS_ID,
} from "./values/WorkflowStatus.js";

export { ComputationKind } from "./computation/ComputationKind.js";
export { Computation } from "./computation/Computation.js";
export {
  SumComputation, AverageComputation, MinComputation, MaxComputation,
  WeightedAverageComputation, CountComputation,
} from "./computation/strategies.js";
export { ComputationRegistry } from "./computation/ComputationRegistry.js";
export { ComputationCache } from "./computation/ComputationCache.js";
export type { Computed } from "./computation/Computed.js";
export { EmptyChildrenError } from "./computation/EmptyChildrenError.js";
export { ComputationOverrideError } from "./computation/ComputationOverrideError.js";

export { Card } from "./cards/Card.js";
export { BusinessScoreCard } from "./cards/BusinessScoreCard.js";
export { TextCard } from "./cards/TextCard.js";
export { StrictRangeCard } from "./cards/StrictRangeCard.js";
export { PictureCard } from "./cards/PictureCard.js";
export { WorkflowCard } from "./cards/WorkflowCard.js";
export { URLCard } from "./cards/URLCard.js";

export { Node } from "./nodes/Node.js";
export { ValueNode } from "./nodes/ValueNode.js";
export { HistorizableValueNode, TimestampNotFoundError } from "./nodes/HistorizableValueNode.js";
export { RangedValueNode } from "./nodes/RangedValueNode.js";
export { TextNode } from "./nodes/TextNode.js";
export { WorkflowNode } from "./nodes/WorkflowNode.js";
export { BusinessScoreNode } from "./nodes/BusinessScoreNode.js";
export { StrictRangeNode } from "./nodes/StrictRangeNode.js";
export { ComputedNode } from "./nodes/ComputedNode.js";
export { ComputedBusinessScoreNode } from "./nodes/ComputedBusinessScoreNode.js";
export { PictureNode } from "./nodes/PictureNode.js";
export { URLNode } from "./nodes/URLNode.js";
export { EmptyHistoryError } from "./nodes/EmptyHistoryError.js";

export { Tree } from "./Tree.js";
export type { CardRegistry } from "./Tree.js";

export { computedValue } from "./aggregation/computedValue.js";
export type { ComputedValueResult } from "./aggregation/computedValue.js";
export { currentValueDateIso, mostRecentChildDateIso } from "./aggregation/currentValueDate.js";
export {
  gradientPositionFraction, linearRegressionPrediction, linearRegressionSlope,
  deadlineShortfall, progressRate, trendArrowFromRate, gradientColorAt,
  warningGradientColorAt,
} from "./aggregation/objectiveProgress.js";
export type { HistoryPoint, TrendArrow } from "./aggregation/objectiveProgress.js";

export { MAX_CHILDREN, canAddChild, shouldRenderPlusTile } from "./capacity/childrenCapacity.js";

export { layoutSquarified } from "./treemapSquarify.js";
