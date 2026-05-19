import { computedValue } from "../../../domain/aggregation/computedValue.js";
import { currentValueDateIso } from "../../../domain/aggregation/currentValueDate.js";
import {
  deadlineShortfall,
  gradientColorAt,
  gradientPositionFraction,
  progressRate,
  trendArrowFromRate,
  warningGradientColorAt,
} from "../../../domain/aggregation/objectiveProgress.js";
import { shouldRenderPlusTile } from "../../../domain/capacity/childrenCapacity.js";
import { ComputationKind } from "../../../domain/computation/ComputationKind.js";
import { EmptyChildrenError } from "../../../domain/computation/EmptyChildrenError.js";
import { BusinessScoreNode } from "../../../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../../../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../../../domain/nodes/ComputedNode.js";
import type { Node } from "../../../domain/nodes/Node.js";
import { PictureNode } from "../../../domain/nodes/PictureNode.js";
import { RangedValueNode } from "../../../domain/nodes/RangedValueNode.js";
import { TextNode } from "../../../domain/nodes/TextNode.js";
import { WorkflowNode } from "../../../domain/nodes/WorkflowNode.js";
import { URLNode } from "../../../domain/nodes/URLNode.js";
import type { CardRegistry } from "../../../domain/Tree.js";
import { Tree } from "../../../domain/Tree.js";
import type { WorkflowStatus } from "../../../domain/values/WorkflowStatus.js";

import { dateAgeColor } from "./dateAgeColor.js";
import type {
  BusinessScoreCardObjectiveViewModel,
  BusinessScoreCardValueViewModel,
  ChildSlotViewModel,
  ComputationKindName,
  ComputedBusinessScoreNodeViewModel,
  ComputedNodeViewModel,
  ComputedValueViewModel,
  FocusedTreeViewModel,
  NodeViewModel,
  PictureNodeViewModel,
  WorkflowNodeViewModel,
  URLNodeViewModel,
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
 *   - Type-switches on v4 leaves (`TextNode`, `RangedValueNode`)
 *     instead of v3 (`TextNode`, `BusinessScoreCardNode`). Both
 *     `BusinessScoreNode` and `StrictRangeNode` extend
 *     `RangedValueNode`, so the BSC branch fires for both. The
 *     `BusinessScoreNode`-specific objective row is gated by
 *     `instanceof BusinessScoreNode` (StrictRangeNode has no
 *     objective per §17.77, so it falls back to a synthetic
 *     "no-objective" objective VM with empty colours / null arrow).
 *   - Reads aggregation via §17.89's `computedValue` + §17.89's
 *     `currentValueDateIso` instead of v3's same-name helpers (retired §17.112) +
 *     `currentValueDateIso`. Shape is 1:1 modulo the
 *     `recordedValue` payload (§17.89 splits v3's
 *     `TimestampedValue<T>` into `value: T` + `asOf: Timestamp`).
 *   - Reads capacity via §17.90's `shouldRenderPlusTile` instead
 *     of v3's `shouldRenderPlusTile`. Same boolean answer.
 *
 * **Unit handling**: reads `node.unit` from v4 BusinessScoreNode
 * (added in §17.91 as the partial resolution of §17.80 D1; see
 * BusinessScoreNode.ts JSDoc). StrictRangeNode has no unit per
 * the v4 diagram — its tiles render with empty unit string.
 *
 * **Defensive fallbacks** mirror v3:
 *   - TextNode with empty history → empty value/date strings.
 *   - RangedValueNode with no usable value → childrenCount or
 *     empty string fields.
 *   - Unsupported v4 Node subclass → throws ViewModelMappingError.
 */
export class ViewModelMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViewModelMappingError";
  }
}

/** Same shape as v3's `MapToViewModelOptions` plus the §17.100.5 cards sidecar. */
export interface MapToViewModelOptions {
  /** Defaults to `new Date()`. Pass for deterministic tests. */
  readonly now?: Date;
  /**
   * §17.100.5 — sidecar card registry produced by `v4TreeFromV3Root`.
   * When a card is present for a BSN id, its `getUnit()` value wins over
   * the §17.91 legacy `BusinessScoreNode.unit` getter. Absent entries
   * fall back to the legacy getter. Defaults to an empty registry.
   */
  readonly cards?: CardRegistry;
  /**
   * §17.117 — board-level workflow-status lookup table. Used by the
   * `WorkflowNode` branch to resolve `statusId` → `{ label, color }`
   * baked into the VM. Missing / empty falls back to a single neutral
   * grey entry — the mapper never throws on an unknown id, it paints
   * a `{ label: id.toUpperCase(), color: <muted-grey> }` placeholder.
   */
  readonly workflowStatuses?: readonly WorkflowStatus[];
}

export function mapNodeToViewModel(
  node: Node,
  options: MapToViewModelOptions = {},
): NodeViewModel {
  // §17.117 — `WorkflowNode extends TextNode` (sibling-by-extension),
  // so the more-specific kind MUST be checked first. Identical
  // discipline to the §17.106 codec's `encodeNode` instanceof order.
  if (node instanceof WorkflowNode) {
    return mapWorkflowNode(node, options);
  }
  if (node instanceof TextNode) {
    return mapTextNode(node, options);
  }
  // §17.104b — ComputedBusinessScoreNode MUST be checked before
  // RangedValueNode (its grandparent) so the §17.104 CBSC VM wins
  // over the legacy BSC VM. ComputedNode does NOT extend
  // RangedValueNode, so its branch order is free — placed near CBSN
  // for grouped readability.
  if (node instanceof ComputedBusinessScoreNode) {
    return mapComputedBusinessScoreNode(node as ComputedBusinessScoreNode<number>, options);
  }
  if (node instanceof ComputedNode) {
    return mapComputedNode(node as ComputedNode<number>);
  }
  if (node instanceof RangedValueNode) {
    return mapBSCNode(node as RangedValueNode<number>, options);
  }
  // §17.119 — PictureNode is a `ValueNode<string>` snapshot leaf (no
  // history, no range), so it falls outside the RangedValueNode branch
  // above. It's checked last because the branches above are the
  // hot-path read shapes; a fresh-cut picture board sees Picture late
  // but still in O(1) instanceof time.
  if (node instanceof PictureNode) {
    return mapPictureNode(node);
  }
  // §17.120 — URLNode is also a `ValueNode<string>` snapshot leaf,
  // structurally identical to PictureNode but rendered as a QR code
  // instead of an `<img>`. Same precedence reasoning as PictureNode:
  // late in the ladder, O(1) instanceof, no interference with the
  // hot-path TextNode / RangedValueNode branches.
  if (node instanceof URLNode) {
    return mapURLNode(node);
  }
  throw new ViewModelMappingError(
    `viewModelMapperV4: unsupported v4 Node subclass "${node.constructor.name}"`,
  );
}

function mapTextNode(
  node: TextNode,
  options: MapToViewModelOptions,
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

/**
 * §17.117 — WorkflowNode VM. Same value / date / dateColor shape as
 * the §17.27 TextNode branch (`WorkflowNode extends TextNode`) +
 * a baked `{ id, label, color }` status object resolved against
 * `options.workflowStatuses`. Missing-id fallback paints a muted-grey
 * placeholder badge with the orphan id uppercased — never throws.
 */
const ORPHAN_STATUS_COLOR = "rgb(150, 150, 150)";

function mapWorkflowNode(
  node: WorkflowNode,
  options: MapToViewModelOptions,
): WorkflowNodeViewModel {
  const latest = node.entries().at(-1);
  const dateIso = latest?.asOf.moment.toISOString() ?? "";
  const statuses = options.workflowStatuses ?? [];
  const resolved = statuses.find((s) => s.id === node.statusId);
  const status = resolved
    ? { id: resolved.id, label: resolved.label, color: resolved.color }
    : {
        id: node.statusId,
        label: node.statusId.toUpperCase(),
        color: ORPHAN_STATUS_COLOR,
      };
  // SPEC §17.121f — flatten the board's status table for the
  // AsParent inline picker (`<option>` per entry); empty when the
  // caller did not pass `options.workflowStatuses`.
  const availableStatuses = statuses.map((s) => ({
    id: s.id,
    label: s.label,
    color: s.color,
  }));
  return {
    kind: "WorkflowNode",
    id: node.id,
    title: node.title,
    value: {
      text: latest?.value ?? "",
      dateIso,
      dateColor: dateIso ? colorFor(dateIso, options) : "",
    },
    status,
    availableStatuses,
  };
}

function mapBSCNode(
  node: RangedValueNode<number>,
  options: MapToViewModelOptions,
): NodeViewModel {
  const dateIso = currentValueDateIso(node) ?? "";
  const unit = resolveUnit(node, options);
  const value = mapBusinessScoreValueV4(node, unit);
  return {
    kind: "BusinessScoreCardNode",
    id: node.id,
    title: node.title,
    description: node.getDescription(),
    value,
    dateIso,
    dateColor: dateIso ? colorFor(dateIso, options) : "",
    objective: mapBusinessScoreObjective(
      node, numericValueOf(value), value.kind === "recordedValue", unit, options,
    ),
  };
}

/**
 * §17.100.5 — single resolution point for the BSC's display unit:
 * sidecar card wins (Unit VO → .value), else legacy `BusinessScoreNode.unit`
 * getter (the §17.91 band-aid), else "" for StrictRangeNode etc.
 */
function resolveUnit(
  node: RangedValueNode<number>,
  options: MapToViewModelOptions,
): string {
  const card = (options.cards ?? Tree.EMPTY_CARDS).get(node.id);
  if (card !== undefined) return card.getUnit().value;
  return node instanceof BusinessScoreNode ? node.unit : "";
}

function colorFor(dateIso: string, options: MapToViewModelOptions): string {
  return dateAgeColor(dateIso, options.now ? { now: options.now } : {});
}

function mapBusinessScoreValueV4(
  node: RangedValueNode<number>,
  unit: string,
): BusinessScoreCardValueViewModel {
  const result = computedValue(node);
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
/**
 * §17.104b — signature refactored to take `currentNumber: number | null`
 * + `isRecordedValue: boolean` directly rather than a v3-shape
 * `BusinessScoreCardValueViewModel`. Same caller-observable behaviour,
 * but now polymorphic across the §17.40 BSC value VM AND the §17.104
 * `ComputedValueViewModel` (the CBSN mapper passes its strategy-applied
 * number + `false` because computed values never qualify as
 * recorded — same data-source restriction the §17.41 trend arrow + §17.44
 * warning glyph carry).
 */
function mapBusinessScoreObjective(
  node: RangedValueNode<number>,
  currentNumber: number | null,
  isRecordedValue: boolean,
  unit: string,
  options: MapToViewModelOptions,
): BusinessScoreCardObjectiveViewModel {
  if (!(node instanceof BusinessScoreNode)) {
    return emptyObjectiveVM(unit);
  }

  const objective = node.objective;
  const targetValue = Number(objective.value);
  const targetDateIso = objective.at.moment.toISOString();

  // §17.91 — v4 Objective is 2-tuple (value, at) vs v3's 3-tuple
  // (initialValue, targetValue, targetDate). v3's gradient ramp went
  // from `initialValue` (red) to `targetValue` (green); v4 has no
  // separate initialValue slot per §17.80 D5. Use the BSC's first
  // history entry as the v4-equivalent baseline; if no history,
  // fall back to `0` (matches v3 behaviour for objectives starting
  // at zero, the most common kiosk shape).
  const entries = node.entries();
  const initialValue = entries.length > 0 ? Number(entries[0].value) : 0;

  const valueColor =
    currentNumber === null
      ? ""
      : gradientColorAt(
          gradientPositionFraction(currentNumber, initialValue, targetValue),
        );

  let warningColor = "";
  let trendArrow: BusinessScoreCardObjectiveViewModel["trendArrow"] = null;
  if (isRecordedValue) {
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
 * §17.104b — `ComputationKind.ALL` ordering frozen into the
 * `ComputationKindName` string array the view layer expects on every
 * Computed* VM. Single source of truth shared by both Computed* mappers.
 * The cast is safe because `ComputationKind.name` is one of the six
 * `ComputationKindName` inhabitants by construction (§17.95 singletons).
 */
const AVAILABLE_KIND_NAMES: readonly ComputationKindName[] = Object.freeze(
  ComputationKind.ALL.map((k) => k.name as ComputationKindName),
);

/**
 * §17.104b — resolve a Computed* node's auto-derived value VM by
 * dispatching through its cached strategy (`node.getValue()`). The
 * §17.95 numeric strategies throw `EmptyChildrenError` when no
 * eligible child survives; the catch surfaces a structured "empty"
 * VM with the error's human reason. Non-finite numeric results
 * (NaN / ±Infinity, e.g. from `AverageComputation` on a list whose
 * sum overflows) ALSO surface as empty so the view never paints a
 * meaningless glyph.
 */
function computedValueVM(
  node: ComputedNode<number> | ComputedBusinessScoreNode<number>,
  unit: string,
): ComputedValueViewModel {
  try {
    const raw = Number(node.getValue());
    if (!Number.isFinite(raw)) {
      return { kind: "empty", reason: `${node.computationKind.name} produced a non-finite result` };
    }
    return { kind: "numeric", value: raw, unit };
  } catch (err) {
    if (err instanceof EmptyChildrenError) {
      // SPEC §13.2 / §17.40 — parity with the v3 BSC `childrenCount`
      // branch: a Computed* parent with at least one (ineligible)
      // child surfaces a `<n> children` VM rather than a strategy-
      // error reason, so the value area stays uniform across
      // recordedValue / computedMean / childrenCount BSC variants
      // and their CBSN counterparts. With literally zero children
      // the strategy error is the only operator-readable signal —
      // pass it through as `empty` (matches the v3 BSC
      // `childrenCount n=0` rendering "empty value area").
      if (node.children.length === 0) {
        return { kind: "empty", reason: err.message };
      }
      return { kind: "childrenCount", n: node.children.length };
    }
    throw err;
  }
}

function mapComputedNode(node: ComputedNode<number>): ComputedNodeViewModel {
  return {
    kind: "ComputedNode",
    id: node.id,
    title: node.title,
    value: computedValueVM(node, ""),
    computationKind: node.computationKind.name as ComputationKindName,
    availableKinds: AVAILABLE_KIND_NAMES,
  };
}

function mapComputedBusinessScoreNode(
  node: ComputedBusinessScoreNode<number>,
  options: MapToViewModelOptions,
): ComputedBusinessScoreNodeViewModel {
  const dateIso = currentValueDateIso(node) ?? "";
  const unit = resolveUnit(node, options);
  const value = computedValueVM(node, unit);
  const currentNumber = value.kind === "numeric" ? value.value : null;
  return {
    kind: "ComputedBusinessScoreNode",
    id: node.id,
    title: node.title,
    description: node.getDescription(),
    value,
    computationKind: node.computationKind.name as ComputationKindName,
    availableKinds: AVAILABLE_KIND_NAMES,
    dateIso,
    dateColor: dateIso ? colorFor(dateIso, options) : "",
    // CBSN values are strategy-applied — never "recorded" per §17.94 D5
    // (their addValue throws ComputationOverrideError), so the §17.41
    // trend arrow + §17.44 warning glyph stay suppressed by passing
    // `isRecordedValue = false`. The §17.40 valueColor gradient still
    // paints because it only needs a finite numeric value.
    objective: mapBusinessScoreObjective(node, currentNumber, false, unit, options),
  };
}

/**
 * SPEC §17.119 — `PictureNode` mapper. Trivial 1:1 projection: the
 * domain already validated the URL at the node-construction seam, the
 * view layer renders an `<img>` and falls back to the §17.44 warning
 * glyph on `onerror`, and there's no timestamp / objective / colour
 * computation to bake in. No `options` reads — `now` and `cards`
 * don't affect a picture's projection.
 */
function mapPictureNode(node: PictureNode): PictureNodeViewModel {
  return {
    kind: "PictureNode",
    id: node.id,
    title: node.title,
    imageUrl: node.imageUrl,
  };
}

/**
 * SPEC §17.120 — `URLNode` mapper. Trivial 1:1 projection mirroring
 * the §17.119 PictureNode mapper: the domain already validated the
 * URL at the node-construction seam, the view layer encodes the URL
 * as a QR code (via the `qrcode` npm package) and falls back to the
 * §17.44 warning glyph on QR-generation failure, and there's no
 * timestamp / objective / colour computation to bake in. No `options`
 * reads — `now` and `cards` don't affect a URL's projection.
 *
 * Note — the URL is read via `node.url` (the URLNode getter that
 * surfaces the inherited description slot per §17.120), not
 * `node.getDescription()`, even though the two return the same string
 * today. Going through the typed getter keeps the mapper resilient
 * to a future field-promotion refactor (if URLNode ever grows a
 * dedicated `_url` slot, the mapper picks up the change automatically).
 */
function mapURLNode(node: URLNode): URLNodeViewModel {
  return {
    kind: "URLNode",
    id: node.id,
    title: node.title,
    url: node.url,
  };
}

/**
 * Map a focused-view snapshot (center node + its direct children)
 * to the shell's `FocusedTreeViewModel`. Appends a `plus` slot iff
 * the focused parent has capacity for a new child (§17.90's
 * `shouldRenderPlusTile`). Same shape and behaviour as v3's
 * `mapFocusedToViewModel`.
 */
export function mapFocusedToViewModel(
  center: Node,
  children: readonly Node[],
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
