/**
 * Domain → view-model mapper (SPEC §5 — boundary that keeps domain types
 * out of Lit reactive updates).
 *
 * Lives in `adapters/ui/views/` because it's a UI concern (the shape of
 * `NodeViewModel` is a UI contract); it imports from `domain/**`, which is
 * allowed by §14.1 / `eslint.config.js` for adapters. **It does not import
 * `application/**`** — the VM is built directly from the focused-view
 * snapshot the composition root already has from
 * `TreeNavigationService.getFocusedView()`.
 *
 * The three branches of `BusinessScoreCardValueViewModel` mirror the three
 * branches of `domain/aggregation/computedValue` 1:1; this mapper is the
 * only place that translation lives, so adding a value branch is a
 * single-file change.
 */

import { computedValue } from "../../../domain/aggregation/computedValue.js";
import { shouldRenderPlusTile } from "../../../domain/capacity/childrenCapacity.js";
import { BusinessScoreCardNode } from "../../../domain/nodes/BusinessScoreCardNode.js";
import { TextNode } from "../../../domain/nodes/TextNode.js";
import type { TreeNode } from "../../../domain/nodes/TreeNode.js";

import type {
  BusinessScoreCardValueViewModel,
  ChildSlotViewModel,
  FocusedTreeViewModel,
  NodeViewModel,
} from "./NodeViewModel.js";

export class ViewModelMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViewModelMappingError";
  }
}

/** Map a single domain node to its plain-data view model. */
export function mapNodeToViewModel(node: TreeNode<unknown>): NodeViewModel {
  if (node instanceof TextNode) {
    // SPEC §17.14 — pull the latest entry from the `TextCard` history;
    // when the history is empty (default-seed root before first input,
    // pre-§17.14 imported data without `historizedValues`) we fall back
    // to empty strings so the view degrades gracefully. We avoid
    // throwing `EmptyHistoryError` here because `mapNodeToViewModel`
    // runs on every refresh — surfacing it would crash the whole
    // composition root over a single empty leaf.
    const latest = node.card.history().at(-1);
    return {
      kind: "TextNode",
      id: node.id,
      title: node.identity.title.value,
      description: node.identity.description.value,
      value: {
        text: latest?.value ?? "",
        dateIso: latest?.asOf.toISOString() ?? "",
      },
    };
  }
  if (node instanceof BusinessScoreCardNode) {
    return {
      kind: "BusinessScoreCardNode",
      id: node.id,
      title: node.identity.title.value,
      description: node.identity.description.value,
      value: mapBusinessScoreValue(node),
    };
  }
  throw new ViewModelMappingError(
    `viewModelMapper: unsupported TreeNode subclass "${node.constructor.name}"`,
  );
}

function mapBusinessScoreValue(
  node: BusinessScoreCardNode<unknown>,
): BusinessScoreCardValueViewModel {
  const result = computedValue(node);
  switch (result.kind) {
    case "recordedValue":
      return {
        kind: "recordedValue",
        value: Number(result.value.value),
        unit: node.card.unit.value,
        dateIso: result.value.asOf.toISOString(),
      };
    case "computedValue":
      return {
        kind: "computedMean",
        mean: result.value,
        unit: node.card.unit.value,
      };
    case "childrenCount":
      return { kind: "childrenCount", n: result.n };
  }
}

/**
 * Map a focused-view snapshot (center node + its direct children) to the
 * shell's `FocusedTreeViewModel`. Appends a `plus` slot to the children
 * list iff the focused parent has capacity for a new child (§4 +
 * `shouldRenderPlusTile`).
 */
export function mapFocusedToViewModel(
  center: TreeNode<unknown>,
  children: readonly TreeNode<unknown>[],
): FocusedTreeViewModel {
  const slots: ChildSlotViewModel[] = children.map((c) => ({
    slot: "node",
    weight: c.weight.value,
    vm: mapNodeToViewModel(c),
  }));
  if (shouldRenderPlusTile(center)) {
    slots.push({ slot: "plus", weight: 1, parentId: center.id });
  }
  return {
    center: mapNodeToViewModel(center),
    children: slots,
  };
}
