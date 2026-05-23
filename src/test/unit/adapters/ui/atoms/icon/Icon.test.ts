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
      e.name = "scale";
    });
    const svg = el.shadowRoot?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("class")).toContain("lucide-scale");
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
      "pencil-line",
      "plus",
      "scale",
      "sigma",
      "target",
      "triangle-alert",
      "x",
    ] as const;
    for (const slug of required) {
      expect(ICON_REGISTRY[slug]).toBeDefined();
      expect(ICON_REGISTRY[slug]).toContain("<svg");
    }
  });

  it("ICON_REGISTRY is frozen so callers cannot mutate it at runtime", () => {
    expect(Object.isFrozen(ICON_REGISTRY)).toBe(true);
  });
});
