import { computedValueV4 } from "../../../domain/aggregation/computedValueV4.js";
import { currentValueDateIsoV4 } from "../../../domain/aggregation/currentValueDateV4.js";
import {
  deadlineShortfall,
  gradientColorAt,
  gradientPositionFraction,
  progressRate,
  trendArrowFromRate,
  warningGradientColorAt,
} from "../../../domain/aggregation/objectiveProgress.js";
import { shouldRenderPlusTileV4 } from "../../../domain/capacity/childrenCapacityV4.js";
import { BusinessScoreNode } from "../../../domain/nodes/BusinessScoreNode.js";
import type { Node } from "../../../domain/nodes/Node.js";
import { RangedValueNode } from "../../../domain/nodes/RangedValueNode.js";
import { TextNodeV4 } from "../../../domain/nodes/TextNodeV4.js";

import { dateAgeColor } from "./dateAgeColor.js";
import type {
  BusinessScoreCardObjectiveViewModel,
  BusinessScoreCardValueViewModel,
  ChildSlotViewModel,
  FocusedTreeViewModel,
  NodeViewModel,
} from "./NodeViewModel.js";

/**
 * V4 view-model mapper (SPEC §17.91 — Phase B.3 of the §17.80
 * v3-retirement migration; v4 successor to v3's
 * `viewModelMapper.ts`). Consumes v4 `Node` instances (the §17.72
 * abstract base) and produces the **same** `NodeViewModel` /
 * `FocusedTreeViewModel` types the v3 mapper produces. Same VM
 * contract = no view-layer changes when §17.93 cuts main.ts over
 * to the v4 read path.
 *
 * Lives at `src/adapters/ui/views/viewModelMapperV4.ts` next to the
 * v3 mapper; both coexist until Phase F deletes v3.
 *
 * **Three structural deltas from v3**:
 *
 *   - Type-switches on v4 leaves (`TextNodeV4`, `RangedValueNode`)
 *     instead of v3 (`TextNode`, `BusinessScoreCardNode`). Both
 *     `BusinessScoreNode` and `StrictRangeNode` extend
 *     `RangedValueNode`, so the BSC branch fires for both. The
 *     `BusinessScoreNode`-specific objective row is gated by
 *     `instanceof BusinessScoreNode` (StrictRangeNode has no
 *     objective per §17.77, so it falls back to a synthetic
 *     "no-objective" objective VM with empty colours / null arrow).
 *   - Reads aggregation via §17.89's `computedValueV4` + §17.89's
 *     `currentValueDateIsoV4` instead of v3's `computedValue` +
 *     `currentValueDateIso`. Shape is 1:1 modulo the
 *     `recordedValue` payload (§17.89 splits v3's
 *     `TimestampedValue<T>` into `value: T` + `asOf: Timestamp`).
 *   - Reads capacity via §17.90's `shouldRenderPlusTileV4` instead
 *     of v3's `shouldRenderPlusTile`. Same boolean answer.
 *
 * **Unit handling**: reads `node.unit` from v4 BusinessScoreNode
 * (added in §17.91 as the partial resolution of §17.80 D1; see
 * BusinessScoreNode.ts JSDoc). StrictRangeNode has no unit per
 * the v4 diagram — its tiles render with empty unit string.
 *
 * **Defensive fallbacks** mirror v3:
 *   - TextNodeV4 with empty history → empty value/date strings.
 *   - RangedValueNode with no usable value → childrenCount or
 *     empty string fields.
 *   - Unsupported v4 Node subclass → throws ViewModelMappingErrorV4.
 */
export class ViewModelMappingErrorV4 extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViewModelMappingErrorV4";
  }
}

/** Same shape as v3's `MapToViewModelOptions`. */
export interface MapToViewModelOptionsV4 {
  /** Defaults to `new Date()`. Pass for deterministic tests. */
  readonly now?: Date;
}

export function mapNodeToViewModelV4(
  node: Node,
  options: MapToViewModelOptionsV4 = {},
): NodeViewModel {
  if (node instanceof TextNodeV4) {
    return mapTextNode(node, options);
  }
  if (node instanceof RangedValueNode) {
    return mapBSCNode(node as RangedValueNode<number>, options);
  }
  throw new ViewModelMappingErrorV4(
    `viewModelMapperV4: unsupported v4 Node subclass "${node.constructor.name}"`,
  );
}

function mapTextNode(
  node: TextNodeV4,
  options: MapToViewModelOptionsV4,
): NodeViewModel {
  const latest = node.entries().at(-1);
  const dateIso = latest?.asOf.moment.toISOString() ?? "";
  return {
    kind: "TextNode",
    id: node.id,
    title: node.title,
    value: {
      text: latest?.value ?? "",
      dateIso,
      dateColor: dateIso ? colorFor(dateIso, options) : "",
    },
  };
}

function mapBSCNode(
  node: RangedValueNode<number>,
  options: MapToViewModelOptionsV4,
): NodeViewModel {
  const dateIso = currentValueDateIsoV4(node) ?? "";
  const value = mapBusinessScoreValueV4(node);
  return {
    kind: "BusinessScoreCardNode",
    id: node.id,
    title: node.title,
    description: node.getDescription(),
    value,
    dateIso,
    dateColor: dateIso ? colorFor(dateIso, options) : "",
    objective: mapBusinessScoreObjectiveV4(node, value, options),
  };
}

function colorFor(dateIso: string, options: MapToViewModelOptionsV4): string {
  return dateAgeColor(dateIso, options.now ? { now: options.now } : {});
}

function mapBusinessScoreValueV4(
  node: RangedValueNode<number>,
): BusinessScoreCardValueViewModel {
  const result = computedValueV4(node);
  const unit = node instanceof BusinessScoreNode ? node.unit : "";
  switch (result.kind) {
    case "recordedValue":
      return {
        kind: "recordedValue",
        value: Number(result.value),
        unit,
        dateIso: result.asOf.moment.toISOString(),
      };
    case "computedValue":
      return { kind: "computedMean", mean: result.value, unit };
    case "childrenCount":
      return { kind: "childrenCount", n: result.n };
  }
}

/**
 * V4 BSC objective-progress info — same five-piece structure as v3
 * (`targetValue`, `targetDateIso`, `unit`, `valueColor`,
 * `warningColor`, `trendArrow`). All three derived overlays
 * (valueColor, warningColor, trendArrow) keep v3's data-source
 * restriction: only `recordedValue` BSCs get warning + arrow
 * (computed/aggregate branches would mix data sources). StrictRangeNode
 * has no objective in v4 (the diagram declares `+StrictRange<T>
 * range` only); it falls back to the empty-objective VM that
 * mirrors v3's degenerate-objective behaviour.
 */
function mapBusinessScoreObjectiveV4(
  node: RangedValueNode<number>,
  value: BusinessScoreCardValueViewModel,
  options: MapToViewModelOptionsV4,
): BusinessScoreCardObjectiveViewModel {
  if (!(node instanceof BusinessScoreNode)) {
    return emptyObjectiveVM("");
  }

  const objective = node.objective;
  const targetValue = Number(objective.value);
  const targetDateIso = objective.at.moment.toISOString();
  const unit = node.unit;

  // §17.91 — v4 ObjectiveV4 is 2-tuple (value, at) vs v3's 3-tuple
  // (initialValue, targetValue, targetDate). v3's gradient ramp went
  // from `initialValue` (red) to `targetValue` (green); v4 has no
  // separate initialValue slot per §17.80 D5. Use the BSC's first
  // history entry as the v4-equivalent baseline; if no history,
  // fall back to `0` (matches v3 behaviour for objectives starting
  // at zero, the most common kiosk shape).
  const entries = node.entries();
  const initialValue = entries.length > 0 ? Number(entries[0].value) : 0;

  const currentNumber = numericValueOf(value);
  const valueColor =
    currentNumber === null
      ? ""
      : gradientColorAt(
          gradientPositionFraction(currentNumber, initialValue, targetValue),
        );

  let warningColor = "";
  let trendArrow: BusinessScoreCardObjectiveViewModel["trendArrow"] = null;
  if (value.kind === "recordedValue") {
    const points = entries.map((tv) => ({
      dateMs: tv.asOf.moment.getTime(),
      value: Number(tv.value),
    }));
    const targetDateMs = objective.at.moment.getTime();
    const shortfall = deadlineShortfall(
      points,
      initialValue,
      targetValue,
      targetDateMs,
      (options.now ?? new Date()).getTime(),
    );
    warningColor = warningGradientColorAt(shortfall);
    const rate = progressRate(points, initialValue, targetValue, targetDateMs);
    trendArrow = rate === null ? null : trendArrowFromRate(rate);
  }

  return { targetValue, targetDateIso, unit, valueColor, warningColor, trendArrow };
}

function emptyObjectiveVM(unit: string): BusinessScoreCardObjectiveViewModel {
  return {
    targetValue: NaN,
    targetDateIso: "",
    unit,
    valueColor: "",
    warningColor: "",
    trendArrow: null,
  };
}

function numericValueOf(
  value: BusinessScoreCardValueViewModel,
): number | null {
  switch (value.kind) {
    case "recordedValue":
      return value.value;
    case "computedMean":
      return value.mean;
    case "childrenCount":
      return value.n > 0 ? value.n : null;
  }
}

/**
 * Map a focused-view snapshot (center node + its direct children)
 * to the shell's `FocusedTreeViewModel`. Appends a `plus` slot iff
 * the focused parent has capacity for a new child (§17.90's
 * `shouldRenderPlusTileV4`). Same shape and behaviour as v3's
 * `mapFocusedToViewModel`.
 */
export function mapFocusedToViewModelV4(
  center: Node,
  children: readonly Node[],
  options: MapToViewModelOptionsV4 = {},
): FocusedTreeViewModel {
  const slots: ChildSlotViewModel[] = children.map((c) => ({
    slot: "node",
    weight: c.weight.value,
    vm: mapNodeToViewModelV4(c, options),
  }));
  if (shouldRenderPlusTileV4(center)) {
    slots.push({ slot: "plus", weight: 1, parentId: center.id });
  }
  return {
    center: mapNodeToViewModelV4(center, options),
    children: slots,
  };
}
