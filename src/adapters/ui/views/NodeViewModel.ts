/**
 * Plain-data view-model contract for the Lit views (SPEC §5).
 *
 * Discriminated by `kind`, one variant per node kind in §3. Intentionally
 * **plain JSON-shaped** (strings, numbers, ISO-8601 dates as strings) so
 * domain types never enter Lit reactive updates: `<node-view>` and the
 * per-kind elements consume only `NodeViewModel`.
 *
 * Composition root maps `domain/TreeNode → NodeViewModel` via
 * `viewModelMapper.ts`. Views never see `TreeNode`, `BusinessScoreCard`,
 * or `TimestampedValue`.
 */

export type NodeKind =
  | "TextNode"
  | "BusinessScoreCardNode"
  | "ComputedNode"
  | "ComputedBusinessScoreNode";

/** SPEC §17.104 — Lit-friendly mirror of `ComputationKind` names (§17.95 / §17.94 D2). */
export type ComputationKindName =
  | "SUM"
  | "AVERAGE"
  | "MIN"
  | "MAX"
  | "WEIGHTED_AVERAGE"
  | "COUNT";

/**
 * SPEC §17.104 — auto-derived numeric value for Computed* tiles.
 * `numeric` = strategy applied successfully; `empty` = no contributing
 * children (the mapper bakes the human reason).
 */
export type ComputedValueViewModel =
  | { readonly kind: "numeric"; readonly value: number; readonly unit: string }
  | { readonly kind: "empty"; readonly reason: string };

/**
 * Where a node is being rendered:
 *  - `asParent`: large, in the parent identity strip (§5).
 *  - `asChild`:  compact, in a treemap tile.
 *
 * Roles differ in size/typography/density only; field content is uniform
 * across roles per §5 — both roles render the same fields.
 */
export type NodeRole = "asParent" | "asChild";

/**
 * SPEC §17.14 — TextNode now carries a `TimestampedValue<string>` history;
 * the displayed value is `history.at(-1).value`. The VM exposes:
 *
 *   - `text` — the latest recorded string (renders as the tile body, big
 *     enough to fill the available space).
 *   - `dateIso` — the latest entry's `asOf.toISOString()` (renders as the
 *     timestamp in the tile's **bottom-right** corner per §17.18).
 *
 * When the underlying `TextCard` history is empty (e.g. the default-seed
 * root before any user input), both fields are `""` so the view layer
 * gracefully renders an empty tile body and no timestamp.
 *
 * SPEC §17.15 — there is **no** `description` field on the TextNode VM:
 * for text-kind cards the current value IS the description, so exposing
 * a separate field would be redundant (and would tempt the view layer
 * to render the same string twice). The domain `NodeIdentity` still
 * carries a description slot for shape uniformity; it is just always
 * `""` for `TextNode` and never crosses the VM boundary.
 */
export type TextNodeViewModel = {
  readonly kind: "TextNode";
  readonly id: string;
  readonly title: string;
  readonly value: {
    readonly text: string;
    readonly dateIso: string;
    /**
     * SPEC §17.21 — pre-computed `rgb(r, g, b)` (or `currentColor`)
     * string for the bottom-right timestamp's age-gradient. Baked
     * here by the mapper using the focused board's `freshDateColor`
     * so the view layer stays a pure consumer (no JS colour math).
     * Empty when `dateIso` is empty.
     */
    readonly dateColor: string;
  };
};

/**
 * The value slot for a `BusinessScoreCardNode` is itself a discriminated
 * union, mirroring the three branches of `domain/aggregation/computedValue`:
 *  - `computedMean`     — `computed=true` AND ≥1 eligible child → weighted mean (with `Σ` badge).
 *  - `recordedValue`    — `computed=false` → latest `TimestampedValue` + its date (no `Σ`).
 *  - `childrenCount`    — `computed=true` AND zero eligible children → render `n children` plain
 *                         text when `n > 0`, or empty value area when `n === 0` (§13.2 + §12.3).
 *
 * Per SPEC §17.18, the **displayed timestamp** is now a top-level
 * field on `BusinessScoreCardNodeViewModel` (`dateIso`), derived from
 * `domain/aggregation/currentValueDate.currentValueDateIso(node)` — for
 * recorded BSCs it's the latest history entry's date; for computed BSCs
 * it's the most recent date amongst the children's own current-value
 * dates (recurses naturally through nested computed BSCs). This is the
 * single source of truth for the corner timestamp on every BSC tile.
 * `recordedValue` keeps its own `dateIso` for backward-compat — it's
 * the same string as the top-level `dateIso` on a `recordedValue` BSC,
 * and a few unit tests still read it.
 */
export type BusinessScoreCardValueViewModel =
  | {
      readonly kind: "computedMean";
      readonly mean: number;
      readonly unit: string;
    }
  | {
      readonly kind: "recordedValue";
      readonly value: number;
      readonly unit: string;
      readonly dateIso: string;
    }
  | {
      readonly kind: "childrenCount";
      readonly n: number;
    };

/**
 * §17.41 — quantised trend-arrow direction for the BSC tile.
 *
 * Mirrors the domain-level `TrendArrow` enum (no view-layer dependency
 * on the domain type — keep the VM self-contained). `null` means the
 * arrow should NOT be rendered (insufficient history, degenerate
 * objective, non-recordedValue branch — see {@link
 * BusinessScoreCardObjectiveViewModel.trendArrow}).
 */
export type TrendArrowDirection =
  | "up"
  | "up-right"
  | "right"
  | "down-right"
  | "down";

/**
 * SPEC §17.40 + §17.41 + §17.44 — pre-computed objective-progress
 * info for the BSC tile.
 *
 * The mapper bakes everything the view needs to render the §17.40
 * target row, the gradient-coloured value, the §17.44 warning glyph
 * (now living *inside* the target row, to the right of the date,
 * tinted by deviation), and the §17.41 trend arrow so the view layer
 * remains a pure consumer (no JS math, no Date parsing, no domain
 * types). Mirrors the §17.21 dateColor pattern.
 *
 * Fields:
 *   - `targetValue`, `targetDateIso`, `unit` — what the operator is
 *     aiming for; rendered in the small target row under the value.
 *   - `valueColor` — pre-computed `rgb(r, g, b)` string for the
 *     current value (and its unit suffix). Empty `""` when the value
 *     branch has no number to grade (childrenCount n=0, or a
 *     degenerate objective with non-finite endpoints) — view falls
 *     back to the default tile text colour.
 *   - `warningColor` (§17.44 — replaces the pre-§17.44
 *     `mayMissDeadline: boolean`) — pre-computed `rgb(r, g, b)`
 *     string on a three-stop yellow → orange → red ramp keyed to the
 *     deviation magnitude (`deadlineShortfall` = `1 -
 *     gradientPositionFraction(predicted, min, target)`). Empty `""`
 *     when no warning should render (deadline already passed,
 *     insufficient history, computed/childrenCount branches, or the
 *     trend reaches the target). When non-empty the view emits a
 *     warning glyph at the right of the target date with this colour
 *     applied as an inline `color` style — yellow at the lowest
 *     deviation (operator just barely below trajectory), red at the
 *     highest (predicted to fall back to `min` or worse). The
 *     `mayMissDeadline` boolean was retired in §17.44: a single
 *     field encodes both *whether* and *how* the warning renders,
 *     mirroring the §17.40 `valueColor` / §17.21 `dateColor`
 *     conventions. Same data-source restriction as `trendArrow` —
 *     only set for `recordedValue` BSCs.
 *   - `trendArrow` (§17.41) — quantised direction of the
 *     least-squares slope normalised against "the rate required to
 *     land at target by deadline". `null` means the view should NOT
 *     render an arrow (insufficient history, degenerate objective,
 *     or a non-`recordedValue` branch — same data-source restriction
 *     as `warningColor`). When present, the arrow glyph is
 *     monochrome (`currentColor`) — the colour-as-severity signal
 *     stays on the value glyph (§17.40) and on the warning glyph
 *     (§17.44); the arrow's *direction* carries its own at-a-glance
 *     signal without needing a hue scale.
 */
export type BusinessScoreCardObjectiveViewModel = {
  readonly targetValue: number;
  readonly targetDateIso: string;
  readonly unit: string;
  readonly valueColor: string;
  readonly warningColor: string;
  readonly trendArrow: TrendArrowDirection | null;
};

export type BusinessScoreCardNodeViewModel = {
  readonly kind: "BusinessScoreCardNode";
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly value: BusinessScoreCardValueViewModel;
  /**
   * SPEC §17.18 — ISO-8601 date for the corner timestamp; empty string
   * when no date applies (e.g. a computed BSC with no contributing
   * children, or a recorded BSC with an empty history).
   */
  readonly dateIso: string;
  /**
   * SPEC §17.21 — pre-computed `rgb(r, g, b)` (or `currentColor`)
   * string for the bottom-right timestamp's age-gradient. Same
   * contract as `TextNodeViewModel.value.dateColor`. Empty when
   * `dateIso` is empty.
   */
  readonly dateColor: string;
  /**
   * SPEC §17.40 — pre-computed objective-progress info (target row +
   * gradient-coloured value + off-track warning). See
   * `BusinessScoreCardObjectiveViewModel` for field semantics.
   */
  readonly objective: BusinessScoreCardObjectiveViewModel;
};

/**
 * SPEC §17.104 — VM for `ComputedNode<T>` tiles. Renders Σ badge +
 * auto-derived value + a `setComputationKind` dropdown that dispatches
 * `computation-kind-change` from `<computed-card>`. The shell wires
 * the event at §17.110 cutover. `availableKinds` ordering matches the
 * §17.95 `ComputationKind.ALL` array.
 */
export type ComputedNodeViewModel = {
  readonly kind: "ComputedNode";
  readonly id: string;
  readonly title: string;
  readonly value: ComputedValueViewModel;
  readonly computationKind: ComputationKindName;
  readonly availableKinds: readonly ComputationKindName[];
};

/** SPEC §17.104 — `ComputedBusinessScoreNode<T>` tiles: ComputedNode VM + BSC objective row + timestamp. */
export type ComputedBusinessScoreNodeViewModel = {
  readonly kind: "ComputedBusinessScoreNode";
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly value: ComputedValueViewModel;
  readonly computationKind: ComputationKindName;
  readonly availableKinds: readonly ComputationKindName[];
  readonly dateIso: string;
  readonly dateColor: string;
  readonly objective: BusinessScoreCardObjectiveViewModel;
};

export type NodeViewModel =
  | TextNodeViewModel
  | BusinessScoreCardNodeViewModel
  | ComputedNodeViewModel
  | ComputedBusinessScoreNodeViewModel;

/**
 * One slot in the focused view's children grid. Either a regular node tile
 * (drilled into via the standard "+"-less tile) or the `+` affordance, which
 * is **not** a node kind (§5 final sentence) and so lives outside the view
 * registry.
 *
 * `weight` feeds the squarified treemap layout (§4) — for `node` slots it
 * mirrors the domain `TreeNode.weight.value`; for `plus` slots it is fixed
 * at `1` (matches the default new-child weight per §4).
 */
export type ChildSlotViewModel = { readonly weight: number } & (
  | { readonly slot: "node"; readonly vm: NodeViewModel }
  | { readonly slot: "plus"; readonly parentId: string }
);

export type FocusedTreeViewModel = {
  readonly center: NodeViewModel;
  readonly children: readonly ChildSlotViewModel[];
};
