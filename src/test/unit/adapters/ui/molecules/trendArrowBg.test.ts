import { describe, expect, it } from "vitest";

import {
  TARGET_ICON_BG,
  TREND_ARROW_BG,
} from "../../../../../adapters/ui/molecules/trendArrowBg.js";

describe("trendArrowBg (SPEC §17.139)", () => {
  it("exposes a `url(...)` CSS background-image value for each of the 5 trend-arrow buckets (up / up-right / right / down-right / down)", () => {
    const expectedKeys = ["up", "up-right", "right", "down-right", "down"];
    expect(Object.keys(TREND_ARROW_BG).sort()).toEqual(expectedKeys.sort());
    for (const key of expectedKeys) {
      const bg = TREND_ARROW_BG[key as keyof typeof TREND_ARROW_BG];
      expect(bg).toMatch(/^url\("data:image\/svg\+xml,/);
      expect(bg).toMatch(/"\)$/);
    }
  });

  it("bakes the muted `#9aa3b4` stroke colour into every trend-arrow data URI (CSS backgrounds cannot inherit currentColor)", () => {
    for (const bg of Object.values(TREND_ARROW_BG)) {
      // The hash character is URL-encoded as %23 inside the data URI.
      expect(bg).toContain("%239aa3b4");
      // The pre-bake `stroke="currentColor"` must NOT survive: the
      // recoloured stroke is the whole point.
      expect(bg.toLowerCase()).not.toContain("currentcolor");
    }
  });

  it("exposes a `url(...)` CSS background-image value for the bullseye target icon, baked with the same muted stroke colour", () => {
    expect(TARGET_ICON_BG).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(TARGET_ICON_BG).toContain("%239aa3b4");
    expect(TARGET_ICON_BG.toLowerCase()).not.toContain("currentcolor");
  });

  it("\u00a717.140 \u2014 bakes a thicker `stroke-width=\"3.5\"` into every data URI (Lucide's default 2 reads thin on the muted `#9aa3b4` tint when used as a CSS background; the operator wanted the arrow stroke far bigger)", () => {
    const STROKE_3_5_ENCODED = encodeURIComponent('stroke-width="3.5"');
    const STROKE_2_ENCODED = encodeURIComponent('stroke-width="2"');
    for (const bg of Object.values(TREND_ARROW_BG)) {
      expect(bg).toContain(STROKE_3_5_ENCODED);
      expect(bg).not.toContain(STROKE_2_ENCODED);
    }
    expect(TARGET_ICON_BG).toContain(STROKE_3_5_ENCODED);
    expect(TARGET_ICON_BG).not.toContain(STROKE_2_ENCODED);
  });
});
