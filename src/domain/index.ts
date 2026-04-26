/**
 * Public domain barrel — Option B (SPEC §3).
 *
 * Surfaces the domain layer to application + adapters. Domain modules MUST NOT
 * import from `application/**`, `adapters/**`, or any browser API (SPEC §12, Phase 1).
 *
 * Organization mirrors the Option B class diagram (`examples/classDiagramMermaid.v2.mermaid`):
 *   values → capabilities → nodes → aggregation → capacity → queries → layout
 */

// — Values —
export * from "./values/Title.js";
export * from "./values/Description.js";
export * from "./values/Weight.js";
export * from "./values/Unit.js";
export * from "./values/NodeIdentity.js";
export * from "./values/TimestampedValue.js";
export * from "./values/Objective.js";

// — Capabilities (interfaces + structural guards) —
export type { Historizable } from "./capabilities/Historizable.js";
export type { HasObjective } from "./capabilities/HasObjective.js";
export type { ContributesToParent } from "./capabilities/ContributesToParent.js";
export {
  implementsHistorizable,
  implementsHasObjective,
  implementsContributesToParent,
} from "./capabilities/capabilityGuards.js";

// — Nodes —
export * from "./nodes/TreeNode.js";
export * from "./nodes/TextNode.js";
export * from "./nodes/BusinessScoreCard.js";
export * from "./nodes/BusinessScoreCardNode.js";

// — Aggregation —
export * from "./aggregation/computedValue.js";

// — Capacity —
export * from "./capacity/childrenCapacity.js";

// — Queries —
export { findNodeById, findParentOf, walkPath } from "./treeQueries.js";

// — Layout —
export { layoutSquarified } from "./treemapSquarify.js";
