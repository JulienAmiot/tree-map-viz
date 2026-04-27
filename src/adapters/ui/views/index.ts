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

import "./BusinessScoreCardNode/BusinessScoreCardNodeAsChild.js";
import "./BusinessScoreCardNode/BusinessScoreCardNodeAsParent.js";
import "./NodeView.js";
import "./TextNode/TextNodeAsChild.js";
import "./TextNode/TextNodeAsParent.js";
import "./plus/PlusTile.js";

import { nodeViewRegistry } from "./nodeViewRegistry.js";

if (!nodeViewRegistry.isFrozen()) {
  nodeViewRegistry.register("TextNode", {
    asParent: "text-node-as-parent",
    asChild: "text-node-as-child",
  });
  nodeViewRegistry.register("BusinessScoreCardNode", {
    asParent: "business-score-card-as-parent",
    asChild: "business-score-card-as-child",
  });
  nodeViewRegistry.freeze();
}

export type {
  BusinessScoreCardNodeViewModel,
  BusinessScoreCardValueViewModel,
  ChildSlotViewModel,
  FocusedTreeViewModel,
  NodeKind,
  NodeRole,
  NodeViewModel,
  TextNodeViewModel,
} from "./NodeViewModel.js";
export { nodeViewRegistry, NodeViewRegistryError } from "./nodeViewRegistry.js";
export { PLUS_TILE_ACTIVATE_EVENT } from "./plus/PlusTile.js";
export type { PlusTileActivateDetail } from "./plus/PlusTile.js";
