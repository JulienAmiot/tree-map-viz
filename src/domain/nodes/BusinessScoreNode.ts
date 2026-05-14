import type { Clock } from "../capabilities/Clock.js";
import type { ObjectiveV4 } from "../values/ObjectiveV4.js";
import type { LenientRange } from "../values/Range.js";
import type { Weight } from "../values/Weight.js";

import { RangedValueNode } from "./RangedValueNode.js";

/**
 * `BusinessScoreNode<T>` — v4 concrete range-bounded historicised node
 * with a single goal-point Objective (SPEC §17.76; mirrors
 * `class BusinessScoreNode~T~ { +LenientRange~T~ range;
 * +Objective~T~ objective }` in the v4 class diagram, with
 * `RangedValueNode~T~ <|-- BusinessScoreNode~T~` inheritance and
 * composition edges to LenientRange<T> + ObjectiveV4<T>).
 *
 * v4 successor to v3's `BusinessScoreCardNode` — different name (note
 * `Card` infix in v3), so NO `V4` suffix; ships under its v4-final name.
 * Inherits the full 5-layer abstract chain (Node → ValueNode →
 * HistorizableValueNode → RangedValueNode → BusinessScoreNode); pure
 * "binding leaf" with NO method overrides — picks the range type,
 * exposes objective, behaviour comes entirely from the chain.
 *
 *   - **`range` narrowed to `LenientRange<T>`** via TS `declare` — type
 *     only, storage stays on the parent slot. Lenient because business
 *     scores legitimately fall outside their display corridor (stretch
 *     above max, dip below min); record-keeping accepts verbatim,
 *     `requireValue` is a no-op per §17.71. `range.contains(v)` still
 *     answers truthfully — the gate is opt-in, not silent rejection.
 *
 *   - **`objective: ObjectiveV4<T>`** as public `readonly` per the
 *     `*-- "1" Objective<T>` composition edge. Mandatory (a score node
 *     without a goal is a category error). v3 stored it on a separate
 *     `BusinessScoreCard` companion (`BusinessScoreCardNode.card`); v4
 *     hoists it onto the node directly, dissolving the v3 Card layer.
 *
 * Concrete (not abstract per the diagram): public constructor, clients
 * `new BusinessScoreNode<T>(...)` directly.
 */
export class BusinessScoreNode<T> extends RangedValueNode<T> {
  declare readonly range: LenientRange<T>;

  /**
   * Display unit for the BSC's value (e.g. `"%"`, `"ms"`, `"$"`).
   * **§17.91 — partial resolution of §17.80 D1**. The §17.80 plan
   * decided unit lives on the future BSCv4 visual wrapper (Phase C),
   * not on the node itself. But the v4 view-model mapper landing at
   * §17.91 needs unit to render BSC tiles without regressing
   * (kiosk shows "75%", "200ms" — losing the suffix is a visible
   * UX regression). BSCv4 wrapper is many strands away. §17.91
   * lifts unit onto BusinessScoreNode as an optional field
   * (default `""`) so the mapper has a place to read it from. When
   * the BSCv4 wrapper ships in Phase C, unit moves there and this
   * field becomes deletable. Optional + defaulted so existing call
   * sites don't break.
   */
  readonly unit: string;

  /**
   * V4 surface for v3's `computed` flag — when `true`, this BSC
   * aggregates from children (ignoring its own history); when
   * `false` (default), the §17.89 structural rule applies (leaf
   * uses own history, parent aggregates).
   *
   * **§17.93 — partial reversal of the §17.89 design call** ("v4
   * structural rule, not flag-based"). The §17.89 docblock said
   * v4 dropped the v3 `computed` flag and replaced it with a
   * structural rule equivalent to v3's default behaviour on the
   * typical kiosk data shape. The §17.93 main.ts read-cutover
   * surfaced an existing kiosk pattern the structural rule
   * doesn't preserve: a BSC marked `computed=true` with a
   * placeholder history entry AND zero children. v3 honours the
   * flag intent (renders `childrenCount n=0` → empty value area,
   * "this will be a future aggregator"); v4's pure structural
   * rule renders the placeholder ("0 %"). 5 e2e tests broke at
   * cutover via the `mixedComputed` fixture's `EmptyLeaf` node.
   * §17.93 reverses the call: lift `computed` onto v4 BSN as an
   * optional field (default `false`, parallel to how §17.91 added
   * `unit`), thread through §17.81 adapter, gate the §17.89
   * leaf-with-history branch on it. Same Phase C migration story
   * as `unit` — when BSCv4 wrapper ships the flag moves there
   * and this field becomes deletable.
   *
   * The §17.80 D5 narrative ("v4 doesn't model contributions on
   * the Node directly") still holds — `eligibleForParentComputation`
   * remains dropped (v4 eligibility is structural: any
   * RangedValueNode descendant with a finite numeric value
   * contributes). Only `computed` returns, and only because of
   * the cutover-time discovery.
   */
  readonly computed: boolean;

  readonly objective: ObjectiveV4<T>;

  /**
   * Constructor uses an options object for the `objective` + the two
   * remaining §17.91/§17.93 band-aid extras (`unit` / `computed`) to keep
   * the positional parameter count at 7 (Sonar S107 limit). The options
   * object is mandatory because `objective` itself is mandatory.
   *
   * **§17.99b retirement** — the `eligibleForParentComputation` option key
   * (added by §17.93 as the second band-aid sister of `computed`) is dropped
   * here. The v5 round-7 D4 successor `ValueNode<T>.disabled` (landed at
   * §17.99a) replaces it with broader semantics; the §17.81 v3-bridge
   * adapter now translates v3 `eligibleForParentComputation: false` to a
   * post-construction `setDisabled(true)` call on the produced v4 node.
   * `unit` and `computed` band-aids stay (retire at §17.99c with the BSCv4
   * wrapper).
   */
  constructor(
    id: string,
    title: string,
    weight: Weight,
    description: string,
    clock: Clock,
    range: LenientRange<T>,
    options: {
      objective: ObjectiveV4<T>;
      unit?: string;
      computed?: boolean;
    },
  ) {
    super(id, title, weight, description, clock, range);
    this.objective = options.objective;
    this.unit = options.unit ?? "";
    this.computed = options.computed ?? false;
  }
}
