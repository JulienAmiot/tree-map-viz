/**
 * Per-VM helper shared by `<business-score-card-as-parent>` and
 * `<business-score-card-as-child>`.
 *
 * Pre-§17.142a this module owned the full `.value-area` value-rendering
 * pipeline (`renderValueTemplate` for the value glyph + unit, plus the
 * §17.40 / §17.44 `renderTargetRow` and §17.41 `renderTrendArrow`
 * helpers). The §17.142a/b BSC migration moved every BSC view onto the
 * shared `<card-body>` molecule with SVG-mono value rendering + CSS-
 * background trend arrows + inline objective / target-date cells, so
 * those helpers became dead code; the §17.142f follow-up retired them.
 *
 * Only the `timestampForValue(vm)` selector remains in this module —
 * it's still consumed by both BSC views to drive the §17.18 corner
 * timestamp (the per-branch policy that picks `vm.dateIso` for every
 * branch, returning `null` when no timestamp can be derived).
 */

import type { BusinessScoreCardNodeViewModel } from "../../molecules/NodeViewModel.js";

/**
 * Returns the ISO date string to render in the tile's bottom-right
 * corner (SPEC §17.18 — moved from top-right; every BSC tile shows a
 * timestamp when one can be derived) for a given BSC view model, or
 * `null` when no timestamp is meaningful.
 *
 * Per-branch policy (uniform — read from `vm.dateIso`):
 *   - `recordedValue`   — own latest history entry's date.
 *   - `computedMean`    — most recent date amongst the (eligible)
 *                         children's current-value dates (recurses
 *                         through nested computed BSCs); set by
 *                         `viewModelMapper`.
 *   - `childrenCount`   — same rule (most recent child date), or
 *                         `null` if no child has a date / no children.
 */
export function timestampForValue(
  vm: BusinessScoreCardNodeViewModel,
): string | null {
  return vm.dateIso ? vm.dateIso : null;
}
