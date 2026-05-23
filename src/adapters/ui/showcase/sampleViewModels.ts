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

import type {
  BusinessScoreCardNodeViewModel,
  ComputedBusinessScoreNodeViewModel,
  ComputedNodeViewModel,
} from "../views/NodeViewModel.js";

const ALL_COMPUTATION_KINDS = [
  "SUM",
  "AVERAGE",
  "MIN",
  "MAX",
  "WEIGHTED_AVERAGE",
  "COUNT",
] as const;

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
/**
 * ComputedNode demo: a SUM of children pager-fatigue minutes, with
 * the full ComputationKind list available for the AsParent picker.
 */
export function sampleComputedNodeVM(): ComputedNodeViewModel {
  return {
    kind: "ComputedNode",
    id: "ds-computed",
    title: "Pager hours saved",
    value: { kind: "numeric", value: 38.5, unit: "h" },
    computationKind: "SUM",
    availableKinds: ALL_COMPUTATION_KINDS,
  };
}

/**
 * ComputedBusinessScoreNode demo: a WEIGHTED_AVERAGE of contributing
 * children with an objective row and a "near schedule" trend arrow.
 */
export function sampleComputedBSCVM(): ComputedBusinessScoreNodeViewModel {
  return {
    kind: "ComputedBusinessScoreNode",
    id: "ds-computed-bsc",
    title: "Customer-impact score",
    description: "Weighted by per-customer ARR; lower is better",
    value: { kind: "numeric", value: 8.4, unit: "" },
    computationKind: "WEIGHTED_AVERAGE",
    availableKinds: ALL_COMPUTATION_KINDS,
    dateIso: "2026-05-20",
    dateColor: "rgb(150, 180, 130)",
    objective: {
      targetValue: 7,
      targetDateIso: "2026-09-30",
      unit: "",
      valueColor: "rgb(200, 180, 110)",
      warningColor: "",
      trendArrow: "right",
    },
  };
}

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
