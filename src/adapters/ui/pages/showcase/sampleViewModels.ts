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
  ChildSlotViewModel,
  ComputedBusinessScoreNodeViewModel,
  ComputedNodeViewModel,
  FocusedTreeViewModel,
  PictureNodeViewModel,
  TextNodeViewModel,
  URLNodeViewModel,
  WorkflowNodeViewModel,
} from "../../molecules/NodeViewModel.js";
import type { BreadcrumbSegment } from "../../organisms/shell/Breadcrumb.js";

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

/**
 * TextNode demo: a short retrospective note with a recent timestamp.
 * `TextNode.value` mirrors `description` per the §17.15 single-source
 * rule; the showcase therefore only carries `value.text`.
 */
export function sampleTextNodeVM(): TextNodeViewModel {
  return {
    kind: "TextNode",
    id: "ds-text",
    title: "Retro note",
    value: {
      text: "Pager noise from monitor X resolved; remove alarm on green.",
      dateIso: "2026-05-22",
      dateColor: "rgb(120, 180, 120)",
    },
  };
}

/**
 * WorkflowNode demo: a "Postmortem follow-up" item with PDCA status
 * `do` (in progress) and the full PDCA table available for the
 * focused-panel inline picker.
 */
export function sampleWorkflowNodeVM(): WorkflowNodeViewModel {
  return {
    kind: "WorkflowNode",
    id: "ds-workflow",
    title: "Postmortem follow-up",
    value: {
      text: "Draft + circulate by EOW.",
      dateIso: "2026-05-21",
      dateColor: "rgb(150, 200, 150)",
    },
    status: { id: "do", label: "DO", color: "rgb(59, 130, 246)" },
    availableStatuses: [
      { id: "plan", label: "PLAN", color: "rgb(161, 161, 170)" },
      { id: "do", label: "DO", color: "rgb(59, 130, 246)" },
      { id: "check", label: "CHECK", color: "rgb(34, 197, 94)" },
      { id: "act", label: "ACT", color: "rgb(245, 158, 11)" },
    ],
  };
}

/**
 * PictureNode demo: an inline data-URL SVG schematic so the showcase
 * never depends on a remote image host (the `<img>` warning-fallback
 * path is covered separately by `PictureNode` unit tests). The SVG
 * draws a stylised "kiosk wall" — a header strip, three tile
 * rectangles + a focus accent — sized to the typical PictureNode
 * tile aspect ratio (16:10).
 */
const DEMO_PICTURE_DATA_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200'>" +
      "<rect width='320' height='200' fill='#151a22'/>" +
      "<rect x='14' y='14' width='292' height='28' rx='4' fill='#1f2733'/>" +
      "<rect x='14' y='58' width='90' height='128' rx='6' fill='#243042'/>" +
      "<rect x='114' y='58' width='90' height='128' rx='6' fill='#2c3a50'/>" +
      "<rect x='214' y='58' width='92' height='128' rx='6' fill='#5b8cff'/>" +
      "<text x='160' y='34' fill='#e8ecf4' font-family='system-ui' " +
      "font-size='14' text-anchor='middle'>Obeya wall</text>" +
      "</svg>",
  );

export function samplePictureNodeVM(): PictureNodeViewModel {
  return {
    kind: "PictureNode",
    id: "ds-picture",
    title: "Architecture diagram",
    imageUrl: DEMO_PICTURE_DATA_URL,
  };
}

/**
 * URLNode demo: a stable example.org URL so the `<a target="_blank">`
 * affordance has something defensible to open if an operator taps it
 * through the showcase (the showcase is read-only-ish; the bubbled
 * `inline-edit-title` event is already silenced).
 */
export function sampleURLNodeVM(): URLNodeViewModel {
  return {
    kind: "URLNode",
    id: "ds-url",
    title: "Runbook",
    url: "https://example.org/obeya/runbook",
  };
}

/**
 * Children-grid slot list used by the §17.127 A5 Templates tier.
 * Mixes three node slots of different kinds (a child BSC that uses
 * the off-track VM, a Text note, and a Workflow item) plus a trailing
 * `+` slot so the §4 capacity affordance is visible. Weights mirror
 * the rough kiosk-realistic distribution (largest tile carries ~50 %
 * of the area, smallest ~15 %).
 */
export function sampleChildSlots(parentId: string): readonly ChildSlotViewModel[] {
  return [
    { slot: "node", weight: 5, vm: sampleBusinessScoreVMOffTrack() },
    { slot: "node", weight: 3, vm: sampleTextNodeVM() },
    { slot: "node", weight: 2, vm: sampleWorkflowNodeVM() },
    { slot: "plus", weight: 1, parentId },
  ];
}

/**
 * Focused-tree view-model used by the §17.127 A6 Pages tier. Bundles
 * the focused VM (on-track BSC) and the same 4-slot child list as
 * the Templates tier so the Pages screen reads as the "fully wired"
 * version of the same composition (parent strip + grid + shell
 * chrome). The breadcrumb is a 3-segment path so the back-to-root
 * affordance has something to show.
 */
export function sampleFocusedTreeView(): FocusedTreeViewModel {
  const center = sampleBusinessScoreVMOnTrack();
  return {
    center,
    children: sampleChildSlots(center.id),
  };
}

export function sampleBreadcrumbPath(): readonly BreadcrumbSegment[] {
  return [
    { id: "ds-root", title: "Obeya" },
    { id: "ds-reliability", title: "Reliability" },
    { id: "ds-bsc-on-track", title: "Quarterly revenue" },
  ];
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
