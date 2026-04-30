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

export type NodeKind = "TextNode" | "BusinessScoreCardNode";

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
};

export type NodeViewModel = TextNodeViewModel | BusinessScoreCardNodeViewModel;

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
