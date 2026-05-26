import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/atoms/icon/Icon.js";
import {
  ICON_REGISTRY,
  type DsIcon,
} from "../../../../../../adapters/ui/atoms/icon/Icon.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

describe("<ds-icon> atom (\u00a717.131)", () => {
  it("renders the Lucide SVG when name is registered", async () => {
    const el = await mountLitElement<DsIcon>("ds-icon", (e) => {
      e.name = "weight";
    });
    const svg = el.shadowRoot?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("class")).toContain("lucide-weight");
  });

  it("inherits currentColor via stroke=currentColor on the Lucide SVG", async () => {
    const el = await mountLitElement<DsIcon>("ds-icon", (e) => {
      e.name = "x";
    });
    const svg = el.shadowRoot?.querySelector("svg");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
  });

  it("renders nothing when name is empty or unknown", async () => {
    const empty = await mountLitElement<DsIcon>("ds-icon");
    expect(empty.shadowRoot?.querySelector("svg")).toBeNull();
    const bogus = await mountLitElement<DsIcon>("ds-icon", (e) => {
      e.name = "definitely-not-a-real-icon";
    });
    expect(bogus.shadowRoot?.querySelector("svg")).toBeNull();
    expect(bogus.shadowRoot?.querySelector("[data-testid]")).toBeNull();
  });

  it("is decorative (aria-hidden=true, role=presentation) by default", async () => {
    const el = await mountLitElement<DsIcon>("ds-icon", (e) => {
      e.name = "check";
    });
    const span = el.shadowRoot?.querySelector("span");
    expect(span?.getAttribute("role")).toBe("presentation");
    expect(span?.getAttribute("aria-hidden")).toBe("true");
    expect(span?.hasAttribute("aria-label")).toBe(false);
  });

  it("becomes role=img with aria-label when `label` is set", async () => {
    const el = await mountLitElement<DsIcon>("ds-icon", (e) => {
      e.name = "check";
      e.label = "Confirmed";
    });
    const span = el.shadowRoot?.querySelector("span");
    expect(span?.getAttribute("role")).toBe("img");
    expect(span?.getAttribute("aria-hidden")).toBe("false");
    expect(span?.getAttribute("aria-label")).toBe("Confirmed");
  });

  it("exposes every icon slug currently needed or pre-staged for migration", () => {
    const required = [
      "arrow-up",
      "arrow-up-right",
      "arrow-right",
      "arrow-down-right",
      "arrow-down",
      "ban",
      "check",
      "plus",
      "settings",
      "sigma",
      "target",
      "triangle-alert",
      "weight",
      "x",
    ] as const;
    for (const slug of required) {
      expect(ICON_REGISTRY[slug]).toBeDefined();
      expect(ICON_REGISTRY[slug]).toContain("<svg");
    }
    // §17.136 S0a-followup -- the pre-§17.136 `scale` slug + the
    // §17.136 S0a first-cut `dumbbell` slug are both retired from
    // the registry; the only weight glyph is now `weight` (Lucide
    // cast-iron foundry silhouette). The §17.131 `pencil-line` and
    // the §17.136 S0a-followup `pencil` slugs are both retired in
    // favour of the §17.144 `settings` gear glyph (operator-requested
    // semantic re-pin: the affordance opens the node-edit modal which
    // exposes configuration fields, so a gear reads more truly than
    // a pencil).
    expect((ICON_REGISTRY as Record<string, string>)["scale"]).toBeUndefined();
    expect((ICON_REGISTRY as Record<string, string>)["dumbbell"]).toBeUndefined();
    expect(
      (ICON_REGISTRY as Record<string, string>)["pencil-line"],
    ).toBeUndefined();
    expect(
      (ICON_REGISTRY as Record<string, string>)["pencil"],
    ).toBeUndefined();
  });

  it("ICON_REGISTRY is frozen so callers cannot mutate it at runtime", () => {
    expect(Object.isFrozen(ICON_REGISTRY)).toBe(true);
  });
});
