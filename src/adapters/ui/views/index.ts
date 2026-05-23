/**
 * Views barrel — single side-effect entry point for the view layer
 * (SPEC §5 — Dispatcher / OCP).
 *
 * Importing this module:
 *   1. registers each per-kind custom element via its module's
 *      `@customElement(...)` decorator (a side effect of the import);
 *   2. registers the (kind, role) → tag mapping in `nodeViewRegistry`;
 *   3. freezes the registry so the runtime invariant "no late additions"
 *      cannot be violated by accident.
 *
 * Adding a new node kind:
 *   - drop a `views/<Kind>/{<Kind>AsParent,<Kind>AsChild}.ts` pair;
 *   - import them here and add the `nodeViewRegistry.register(...)` line;
 *   - the dispatcher (`<node-view>`) needs no edit — that's the point of
 *     the registry indirection.
 *
 * The "+" affordance (`PlusTile`) is intentionally **not** in the registry
 * (§5 final sentence). The shell decides whether to render it directly.
 */

import "../organisms/BusinessScoreCardNode/BusinessScoreCardNodeAsChild.js";
import "../organisms/BusinessScoreCardNode/BusinessScoreCardNodeAsParent.js";
import "./ComputedNode/ComputedCards.js";
import "../molecules/NodeView.js";
import "./PictureNode/PictureNodeAsChild.js";
import "./PictureNode/PictureNodeAsParent.js";
import "./TextNode/TextNodeAsChild.js";
import "./TextNode/TextNodeAsParent.js";
import "./WorkflowNode/WorkflowNodeAsChild.js";
import "./WorkflowNode/WorkflowNodeAsParent.js";
import "./URLNode/URLNodeAsChild.js";
import "./URLNode/URLNodeAsParent.js";
import "../molecules/plus/PlusTile.js";

import { nodeViewRegistry } from "../molecules/nodeViewRegistry.js";

if (!nodeViewRegistry.isFrozen()) {
  nodeViewRegistry.register("TextNode", {
    asParent: "text-node-as-parent",
    asChild: "text-node-as-child",
  });
  // §17.117 — WorkflowNode mirrors TextNode + the bottom-left status
  // badge; each role gets its own tag (parent role carries the
  // inline-edit affordances, child role is read-only).
  nodeViewRegistry.register("WorkflowNode", {
    asParent: "workflow-node-as-parent",
    asChild: "workflow-node-as-child",
  });
  nodeViewRegistry.register("BusinessScoreCardNode", {
    asParent: "business-score-card-as-parent",
    asChild: "business-score-card-as-child",
  });
  // §17.104 — Computed* tiles reuse the same tag for both roles (value-area identical).
  nodeViewRegistry.register("ComputedNode", { asParent: "computed-card", asChild: "computed-card" });
  nodeViewRegistry.register("ComputedBusinessScoreNode", {
    asParent: "computed-business-score-card",
    asChild: "computed-business-score-card",
  });
  // §17.119 — PictureNode strand. Distinct tags per role: parent
  // surfaces the click-to-edit title affordance; child stays read-
  // only (parity with TextNode / BSC role split).
  nodeViewRegistry.register("PictureNode", {
    asParent: "picture-node-as-parent",
    asChild: "picture-node-as-child",
  });
  // §17.120 — URLNode strand. Same role split as PictureNode: parent
  // exposes the inline title-edit affordance, child stays read-only.
  // Both roles render the same QR-code `<img>` (object-fit: contain)
  // with a `warning-fill` fallback on generation failure.
  nodeViewRegistry.register("URLNode", {
    asParent: "url-node-as-parent",
    asChild: "url-node-as-child",
  });
  nodeViewRegistry.freeze();
}

export type {
  BusinessScoreCardNodeViewModel,
  BusinessScoreCardValueViewModel,
  ChildSlotViewModel,
  ComputationKindName,
  ComputedBusinessScoreNodeViewModel,
  ComputedNodeViewModel,
  ComputedValueViewModel,
  FocusedTreeViewModel,
  NodeKind,
  NodeRole,
  NodeViewModel,
  PictureNodeViewModel,
  TextNodeViewModel,
  WorkflowNodeViewModel,
  URLNodeViewModel,
} from "../molecules/NodeViewModel.js";
export { nodeViewRegistry, NodeViewRegistryError } from "../molecules/nodeViewRegistry.js";
export { COMPUTATION_KIND_CHANGE_EVENT, type ComputationKindChangeDetail } from "./ComputedNode/ComputedCards.js";
export { PLUS_TILE_ACTIVATE_EVENT } from "../molecules/plus/PlusTile.js";
export type { PlusTileActivateDetail } from "../molecules/plus/PlusTile.js";
