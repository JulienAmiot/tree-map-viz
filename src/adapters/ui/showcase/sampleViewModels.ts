/**
 * Realistic per-kind view-model builders used by the §17.127 design-
 * system showcase's Organisms tier. The kiosk's real custom elements
 * (BSC AsParent / AsChild, Computed*, Text, Workflow, Picture, URL)
 * each consume a typed `NodeViewModel`; this module supplies one
 * sample VM per kind so the showcase can mount the live elements
 * without depending on a focused board.
 *
 * Each builder lives behind a small factory so the showcase can
 * later parameterise the values (e.g. on-track vs off-track BSCs,
 * different PDCA statuses, etc.) without rewriting the import sites.
 *
 * NOTE — these VMs are READ-ONLY demos. Any bubbled UI event from
 * the mounted elements (`inline-edit-*`, `value-node-disabled-change`,
 * `weight-edit-open`, etc.) is silenced at the `<design-system-page>`
 * host before it can reach `main.ts`'s screen listener (see
 * `SILENCED_BUBBLES` on `DesignSystemPage`).
 *
 * §17.127 A4b-1 — BSC variants only. Subsequent strands (A4b-2 →
 * A4b-4) extend this module with Computed* / Text / Workflow /
 * Picture / URL builders one kind at a time.
 */

import type { BusinessScoreCardNodeViewModel } from "../views/NodeViewModel.js";

/**
 * BSC AsParent demo: a "Revenue (USD)" metric with a recorded value
 * comfortably above its objective, an "on-track" trend arrow, and
 * a timestamp anchored a couple of days ago.
 */
export function sampleBusinessScoreVMOnTrack(): BusinessScoreCardNodeViewModel {
  return {
    kind: "BusinessScoreCardNode",
    id: "ds-bsc-on-track",
    title: "Quarterly revenue",
    description: "Sum of net invoiced revenue this quarter",
    value: {
      kind: "recordedValue",
      value: 1_485_000,
      unit: "USD",
      dateIso: "2026-05-22",
    },
    dateIso: "2026-05-22",
    dateColor: "rgb(120, 180, 120)",
    objective: {
      targetValue: 1_400_000,
      targetDateIso: "2026-06-30",
      unit: "USD",
      valueColor: "rgb(120, 180, 120)",
      warningColor: "",
      trendArrow: "up-right",
    },
  };
}

/**
 * BSC AsChild demo: a "Reliability score" derived from children
 * (computedMean branch) sitting below its objective with the
 * warning glyph + a regression-trend arrow.
 */
export function sampleBusinessScoreVMOffTrack(): BusinessScoreCardNodeViewModel {
  return {
    kind: "BusinessScoreCardNode",
    id: "ds-bsc-off-track",
    title: "Reliability score",
    description: "Mean of contributing child metrics",
    value: {
      kind: "computedMean",
      mean: 71.4,
      unit: "%",
    },
    dateIso: "2026-04-30",
    dateColor: "rgb(220, 140, 60)",
    objective: {
      targetValue: 99,
      targetDateIso: "2026-12-31",
      unit: "%",
      valueColor: "rgb(220, 90, 90)",
      warningColor: "rgb(220, 140, 60)",
      trendArrow: "down-right",
    },
  };
}
