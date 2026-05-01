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
 *
 * SPEC §17.21 — the mapper now bakes the per-tile **dateColor** into
 * each VM, using a board-level fresh colour passed by the composition
 * root. Keeping the colour math here (instead of in the view templates)
 * means views stay pure consumers and unit-test the colour wiring at a
 * single seam.
 */

import { computedValue } from "../../../domain/aggregation/computedValue.js";
import { currentValueDateIso } from "../../../domain/aggregation/currentValueDate.js";
import { shouldRenderPlusTile } from "../../../domain/capacity/childrenCapacity.js";
import { BusinessScoreCardNode } from "../../../domain/nodes/BusinessScoreCardNode.js";
import { TextNode } from "../../../domain/nodes/TextNode.js";
import type { TreeNode } from "../../../domain/nodes/TreeNode.js";

import { dateAgeColor } from "./dateAgeColor.js";
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

/**
 * Optional context passed alongside a domain node. Currently carries only
 * the board-level fresh date colour (§17.21); intended to grow with other
 * board-level theming/policy fields rather than ballooning the function
 * signature.
 */
export interface MapToViewModelOptions {
  readonly freshDateColor?: string;
  /** Defaults to `new Date()`. Pass for deterministic tests. */
  readonly now?: Date;
}

/** Map a single domain node to its plain-data view model. */
export function mapNodeToViewModel(
  node: TreeNode<unknown>,
  options: MapToViewModelOptions = {},
): NodeViewModel {
  if (node instanceof TextNode) {
    // SPEC §17.14 — pull the latest entry from the `TextCard` history;
    // when the history is empty (default-seed root before first input,
    // pre-§17.14 imported data without `historizedValues`) we fall back
    // to empty strings so the view degrades gracefully.
    const latest = node.card.history().at(-1);
    const dateIso = latest?.asOf.toISOString() ?? "";
    // SPEC §17.15 — TextNode VM intentionally omits `description`; the
    // current value (`value.text`) IS the description for text cards.
    return {
      kind: "TextNode",
      id: node.id,
      title: node.identity.title.value,
      value: {
        text: latest?.value ?? "",
        dateIso,
        dateColor: dateIso ? colorFor(dateIso, options) : "",
      },
    };
  }
  if (node instanceof BusinessScoreCardNode) {
    // SPEC §17.18 — corner timestamp comes from the unified domain
    // helper. For computed BSCs this is the most-recent date amongst
    // the children's current values (recurses), so an aggregate's
    // displayed date answers "as of when is this aggregate current?".
    const dateIso = currentValueDateIso(node) ?? "";
    return {
      kind: "BusinessScoreCardNode",
      id: node.id,
      title: node.identity.title.value,
      description: node.identity.description.value,
      value: mapBusinessScoreValue(node),
      dateIso,
      dateColor: dateIso ? colorFor(dateIso, options) : "",
    };
  }
  throw new ViewModelMappingError(
    `viewModelMapper: unsupported TreeNode subclass "${node.constructor.name}"`,
  );
}

function colorFor(dateIso: string, options: MapToViewModelOptions): string {
  return dateAgeColor(dateIso, {
    ...(options.now ? { now: options.now } : {}),
    ...(options.freshDateColor !== undefined
      ? { freshColor: options.freshDateColor }
      : {}),
  });
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
 *
 * SPEC §17.21 — the optional `options.freshDateColor` is propagated to
 * every node's VM (centre + children), so a single mapper call themes
 * the whole focused view consistently.
 */
export function mapFocusedToViewModel(
  center: TreeNode<unknown>,
  children: readonly TreeNode<unknown>[],
  options: MapToViewModelOptions = {},
): FocusedTreeViewModel {
  const slots: ChildSlotViewModel[] = children.map((c) => ({
    slot: "node",
    weight: c.weight.value,
    vm: mapNodeToViewModel(c, options),
  }));
  if (shouldRenderPlusTile(center)) {
    slots.push({ slot: "plus", weight: 1, parentId: center.id });
  }
  return {
    center: mapNodeToViewModel(center, options),
    children: slots,
  };
}
