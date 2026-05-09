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
 * SPEC §17.21 — the mapper bakes the per-tile **dateColor** into each
 * VM. §17.42 retired the per-board fresh-end colour, leaving
 * `dateAgeColor` a pure function of the ISO + an optional `now`;
 * keeping the colour math here (instead of in the view templates)
 * means views stay pure consumers and unit-test the colour wiring at
 * a single seam.
 */

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
import { BusinessScoreCardNode } from "../../../domain/nodes/BusinessScoreCardNode.js";
import { TextNode } from "../../../domain/nodes/TextNode.js";
import type { TreeNode } from "../../../domain/nodes/TreeNode.js";

import { dateAgeColor } from "./dateAgeColor.js";
import type {
  BusinessScoreCardObjectiveViewModel,
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
 * Optional context passed alongside a domain node. §17.42 retired the
 * board-level `freshDateColor` field that §17.21 added; the only
 * remaining option is `now`, kept for deterministic age-gradient
 * tests. The interface is preserved (rather than collapsing to a
 * bare `Date`) so future board-level concerns can attach without
 * churning every caller again.
 */
export interface MapToViewModelOptions {
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
    const dateIso = latest?.asOf.moment.toISOString() ?? "";
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
    const value = mapBusinessScoreValue(node);
    return {
      kind: "BusinessScoreCardNode",
      id: node.id,
      title: node.identity.title.value,
      description: node.identity.description.value,
      value,
      dateIso,
      dateColor: dateIso ? colorFor(dateIso, options) : "",
      objective: mapBusinessScoreObjective(node, value, options),
    };
  }
  throw new ViewModelMappingError(
    `viewModelMapper: unsupported TreeNode subclass "${node.constructor.name}"`,
  );
}

function colorFor(dateIso: string, options: MapToViewModelOptions): string {
  return dateAgeColor(dateIso, options.now ? { now: options.now } : {});
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
        dateIso: result.value.asOf.moment.toISOString(),
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
 * SPEC §17.40 + §17.41 + §17.44 — build the objective-progress info
 * baked into every BSC view model.
 *
 * Three derived pieces:
 *
 *   - `valueColor` (§17.40): a four-stop red → orange → yellow → green
 *     ramp applied to the value's gradient position between
 *     `objective.initialValue` (red) and `objective.targetValue`
 *     (green), via `gradientPositionFraction` + `gradientColorAt`.
 *     Empty `""` when the current value branch has no number to grade
 *     (childrenCount n=0). Both ascending and descending objectives
 *     are handled uniformly.
 *
 *   - `warningColor` (§17.44 — replaces the pre-§17.44
 *     `mayMissDeadline: boolean`): a three-stop yellow → orange → red
 *     ramp keyed to the *deviation magnitude* of the BSC's recorded
 *     trajectory (least-squares fit through the historized entries),
 *     extrapolated to `targetDate`. Computed via `deadlineShortfall`
 *     (returns `1 - gradientPositionFraction(predicted, min, target)`,
 *     clamped to `[0, 1]`) + `warningGradientColorAt`. Empty `""`
 *     means no warning should render — either the trend reaches the
 *     target, the deadline has already passed, the history has fewer
 *     than 2 distinct timestamps (no defined trend; deliberately
 *     silent rather than false-alarm on noisy first-week data), the
 *     input is malformed (NaN endpoints), or the value branch is not
 *     `recordedValue` (same data-source restriction as `trendArrow`
 *     below). When non-empty the colour reflects the deviation
 *     magnitude: yellow at the lowest (operator just barely below
 *     trajectory), red at the highest (predicted to fall back to
 *     `min` or worse). Direction-agnostic for ascending and
 *     descending objectives, and catches the
 *     "overachiever-but-trending-back-down" case the §17.40 amendment
 *     opted into.
 *
 *   - `trendArrow` (§17.41): quantised direction of the regression
 *     slope normalised against the rate required to land at target by
 *     the deadline. `null` when no arrow should be shown:
 *       (a) the value branch is not `recordedValue` (same data-source
 *           restriction as `warningColor`);
 *       (b) `progressRate` returned `null` (insufficient history,
 *           degenerate objective / timeline, non-finite endpoints);
 *           the operator gets silence rather than a misleading flat
 *           default arrow on a noisy single-entry BSC.
 *     Five buckets: `up | up-right | right | down-right | down` —
 *     direction-agnostic for ascending and descending objectives.
 *
 * All numeric inputs are coerced through `Number(...)` because
 * `Objective<T>` is generic in the value type; in practice the kiosk's
 * BSC editor always saves numbers (see SPEC §3 — value type matches
 * the unit's scale). A non-numeric objective produces `NaN`s which
 * the helper functions handle gracefully (return red / `""` / `null`).
 */
function mapBusinessScoreObjective(
  node: BusinessScoreCardNode<unknown>,
  value: BusinessScoreCardValueViewModel,
  options: MapToViewModelOptions,
): BusinessScoreCardObjectiveViewModel {
  const objective = node.card.objective;
  const initialValue = Number(objective.initialValue);
  const targetValue = Number(objective.targetValue);
  const targetDateIso = objective.targetDate.moment.toISOString();
  const unit = node.card.unit.value;

  const currentNumber = numericValueOf(value);
  const valueColor =
    currentNumber === null
      ? ""
      : gradientColorAt(
          gradientPositionFraction(currentNumber, initialValue, targetValue),
        );

  // §17.40 / §17.41 / §17.44 — both the deadline-risk warning and the
  // trend arrow run only on the `recordedValue` branch (where the
  // BSC's own card history matches the displayed value's data
  // source). For computed/aggregate branches the displayed value is
  // sourced from children, so a regression on the parent's own
  // history would mix data sources in an operator-confusing way; we
  // skip both signals there. Computed/aggregate branches still get
  // the gradient colour on the value glyph itself — only the
  // trend-derived overlays (warning + arrow) are suppressed.
  let warningColor = "";
  let trendArrow: BusinessScoreCardObjectiveViewModel["trendArrow"] = null;
  if (value.kind === "recordedValue") {
    const history = node.card.history();
    const points = history.map((tv) => ({
      dateMs: tv.asOf.moment.getTime(),
      value: Number(tv.value),
    }));
    const targetDateMs = objective.targetDate.moment.getTime();
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

  return {
    targetValue,
    targetDateIso,
    unit,
    valueColor,
    warningColor,
    trendArrow,
  };
}

/**
 * Pull the numeric "current value" out of a BSC value VM, or `null`
 * if the branch has no number to grade against the objective.
 *
 *   - `recordedValue`     → the recorded number.
 *   - `computedMean`      → the weighted mean.
 *   - `childrenCount` n>0 → the count itself (operator can target
 *                            "X children" as a sub-goal).
 *   - `childrenCount` n=0 → `null` (no value to colour).
 */
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
 * Map a focused-view snapshot (center node + its direct children) to the
 * shell's `FocusedTreeViewModel`. Appends a `plus` slot to the children
 * list iff the focused parent has capacity for a new child (§4 +
 * `shouldRenderPlusTile`).
 *
 * The optional `options.now` is propagated to every node's VM (centre
 * + children) so the date-age gradient is computed against the same
 * "now" across the whole focused view.
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
