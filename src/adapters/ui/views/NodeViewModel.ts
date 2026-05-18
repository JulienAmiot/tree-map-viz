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
  | "WorkflowNode"
  | "BusinessScoreCardNode"
  | "ComputedNode"
  | "ComputedBusinessScoreNode"
  | "PictureNode"
  | "URLNode";

/** SPEC §17.104 — Lit-friendly mirror of `ComputationKind` names (§17.95 / §17.94 D2). */
export type ComputationKindName = "SUM" | "AVERAGE" | "MIN" | "MAX" | "WEIGHTED_AVERAGE" | "COUNT";

/**
 * SPEC §17.104 — auto-derived value for Computed* tiles. Mirrors the
 * v3 BSC `BusinessScoreCardValueViewModel` 3-branch shape so the
 * §17.104 Computed* path renders the same operator-visible variants
 * the BSC view layer commits to (SPEC §13.2 / §17.40):
 *
 *   - `numeric` — strategy produced a finite number (the typical
 *     aggregator outcome — renders as `<value> <unit>` with the
 *     §17.104b `decimals` formatting on `<computed-business-score-card>`).
 *   - `childrenCount` — strategy could not produce a number because
 *     none of the children contributed (all disabled / all text /
 *     `EmptyChildrenError` at the strategy layer). `n` is the total
 *     children count: `n > 0` renders as `<n> children` plain text
 *     (parity with the v3 BSC `childrenCount` branch); `n = 0`
 *     renders as an empty value area (parent has literally nothing
 *     to aggregate — the `+` tile is the only operator affordance).
 *   - `empty` — non-finite numeric result (e.g. NaN / ±Infinity from
 *     a `SumComputation` overflow). Kept distinct from `childrenCount`
 *     because the operator-facing message is computation-specific
 *     ("WEIGHTED_AVERAGE produced a non-finite result"), not a
 *     children-count statement.
 */
export type ComputedValueViewModel =
  | { readonly kind: "numeric"; readonly value: number; readonly unit: string }
  | { readonly kind: "childrenCount"; readonly n: number }
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
 * SPEC §17.117 — `WorkflowNode` tiles.
 *
 * Mirrors {@link TextNodeViewModel} (markdown body + bottom-right
 * timestamp) and adds a single new field — `status` — carrying the
 * pre-resolved label + colour of the focused board's
 * `WorkflowStatus[]` entry the node's `statusId` references. The
 * mapper bakes the colour in (rather than handing the view a raw
 * id) so the view layer remains a pure consumer: no lookup table,
 * no JS colour math.
 *
 * Fallback semantics — when the node's `statusId` references a
 * status that no longer exists on the board (e.g. operator deleted
 * the entry before migrating downstream nodes — the future settings
 * strand will surface a board-level GC pass), `status.id` retains
 * the orphan id verbatim AND `status.color` falls back to a muted
 * grey so the badge still renders, just neutrally. `status.label`
 * surfaces the uppercased orphan id so the operator can identify
 * which status to add back. Same defensive pattern the mapper uses
 * for empty-history TextNodes (§17.15) — never throw, always paint.
 */
export type WorkflowNodeViewModel = {
  readonly kind: "WorkflowNode";
  readonly id: string;
  readonly title: string;
  readonly value: {
    readonly text: string;
    readonly dateIso: string;
    readonly dateColor: string;
  };
  readonly status: {
    readonly id: string;
    readonly label: string;
    readonly color: string;
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

/** SPEC §17.104 — `ComputedNode<T>` tiles. `availableKinds` ordering matches `ComputationKind.ALL`. */
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

/**
 * SPEC §17.119 — `PictureNode` view-model. Carries the operator-visible
 * title plus the image URL the view layer feeds to its `<img>` element.
 * No timestamp / no objective row — pictures are snapshot leaves; the
 * tile body IS the image.
 *
 * `imageUrl` is the baked URL the mapper already normalised against
 * the domain (non-empty, trimmed). The view layer is responsible for
 * loading it via an `<img>` tag and rendering the §17.44 warning-fill
 * glyph when the load fails (the operator's "display the same warning
 * sign as the computed card" requirement). No further validation
 * happens in the view; the browser is the authoritative source of
 * "can I display this?".
 */
export type PictureNodeViewModel = {
  readonly kind: "PictureNode";
  readonly id: string;
  readonly title: string;
  readonly imageUrl: string;
};

/**
 * SPEC §17.120 — `URLNode` view-model. Carries the operator-visible
 * title plus the URL the view layer encodes as a QR code. No
 * timestamp / no objective row — URL nodes are snapshot leaves; the
 * tile body IS the QR code.
 *
 * `url` is the baked URL the mapper already normalised against the
 * domain (non-empty, trimmed). The view layer is responsible for
 * generating a QR-code image from it (via the `qrcode` npm package)
 * and rendering the §17.44 warning-fill glyph when the QR generation
 * fails — the operator's "display the same warning sign as the
 * computed card on failure" requirement, mirroring §17.119 PictureNode
 * load-failure behaviour. No further validation happens in the view;
 * the QR-encoder is the authoritative source of "can I render this?".
 *
 * Note — there is no separate `description` field on this VM despite
 * the domain storing the URL in the description slot: surfacing both
 * `url` and `description` on the VM would tempt the view to render
 * the URL twice. The mapper exposes a single `url` field per the
 * §17.15 TextNode precedent ("the value IS the description; never
 * leak both onto the VM").
 */
export type URLNodeViewModel = {
  readonly kind: "URLNode";
  readonly id: string;
  readonly title: string;
  readonly url: string;
};

export type NodeViewModel =
  | TextNodeViewModel
  | WorkflowNodeViewModel
  | BusinessScoreCardNodeViewModel
  | ComputedNodeViewModel
  | ComputedBusinessScoreNodeViewModel
  | PictureNodeViewModel
  | URLNodeViewModel;

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
