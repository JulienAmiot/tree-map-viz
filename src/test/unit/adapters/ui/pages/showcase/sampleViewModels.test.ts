import { describe, expect, it } from "vitest";

import { dateAgeColor } from "../../../../../../adapters/ui/atoms/dateAgeColor.js";
import {
  sampleBusinessScoreVMOffTrack,
  sampleBusinessScoreVMOnTrack,
  sampleComputedBSCVM,
  sampleTextNodeVM,
  sampleWorkflowNodeVM,
} from "../../../../../../adapters/ui/pages/showcase/sampleViewModels.js";

/**
 * SPEC §17.142 — every showcase fixture that carries a `dateColor`
 * must derive it from `dateAgeColor()` at the frozen `SHOWCASE_NOW`
 * (matches `sampleViewModels.ts`) instead of hand-baking a gradient
 * rgb literal. Pre-§17.142 the on-track BSC carried the value's green,
 * the off-track BSC carried the warning's orange, etc. — operator-
 * visible mismatch with the §17.42 rule (date colour is age, not
 * gradient). These tests pin the lerp output so a future fixture
 * refresh can't silently re-introduce gradient colors on the date.
 */
const SHOWCASE_NOW = new Date("2026-05-25T12:00:00Z");

interface DatedFixture { readonly label: string; readonly dateColor: string; readonly dateIso: string }

const datedFixtures = (): readonly DatedFixture[] => {
  const onTrack = sampleBusinessScoreVMOnTrack();
  const offTrack = sampleBusinessScoreVMOffTrack();
  const computedBsc = sampleComputedBSCVM();
  const text = sampleTextNodeVM();
  const workflow = sampleWorkflowNodeVM();
  return [
    { label: "on-track BSC", dateColor: onTrack.dateColor, dateIso: onTrack.dateIso },
    { label: "off-track BSC", dateColor: offTrack.dateColor, dateIso: offTrack.dateIso },
    { label: "ComputedBusinessScoreNode", dateColor: computedBsc.dateColor, dateIso: computedBsc.dateIso! },
    { label: "TextNode", dateColor: text.value.dateColor, dateIso: text.value.dateIso },
    { label: "WorkflowNode", dateColor: workflow.value.dateColor, dateIso: workflow.value.dateIso },
  ];
};

describe("showcase fixtures (\u00a717.142) — dateColor follows the kiosk's age-based lerp", () => {
  it.each(datedFixtures())(
    "$label: `dateColor` is the off-white-to-dark-grey age lerp, NOT the value's gradient",
    ({ dateColor, dateIso }) => {
      expect(dateColor).toBe(dateAgeColor(dateIso, { now: SHOWCASE_NOW }));
    },
  );

  it("every fixture's dateColor is achromatic grey (r == g == b) \u2014 sanity check the lerp never returns a coloured rgb", () => {
    // §17.142 -- the §17.42 lerp endpoints are both achromatic grey
    // (off-white 245/245/245 -> dark-grey 64/64/64), so every
    // intermediate value is also achromatic. A future change that
    // re-introduces a coloured endpoint would fail this invariant.
    for (const { label, dateColor } of datedFixtures()) {
      const match = dateColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
      expect(match, `${label}: expected achromatic rgb, got ${dateColor}`).not.toBeNull();
      if (!match) continue;
      const [, r, g, b] = match;
      expect(r, `${label} red==green`).toBe(g);
      expect(g, `${label} green==blue`).toBe(b);
    }
  });
});
