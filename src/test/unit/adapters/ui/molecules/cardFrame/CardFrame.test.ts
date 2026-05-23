import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/molecules/cardFrame/CardFrame.js";
import { CardFrame } from "../../../../../../adapters/ui/molecules/cardFrame/CardFrame.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

const NAMED_SLOTS = [
  "icons",
  "unit",
  "title",
  "subtitle",
  "header-actions",
  "body",
  "footer-left",
  "footer-right",
] as const;

const REGIONS = [
  "card-frame-header",
  "card-frame-title-row",
  "card-frame-body",
  "card-frame-footer",
  "card-frame-footer-left",
  "card-frame-footer-right",
] as const;

describe("<card-frame> (\u00a717.136 S0b)", () => {
  it("renders all three regions + declares every operator-pinned named slot", async () => {
    // §17.136 -- the slot set is operator-pinned: icons + unit +
    // title + header-actions on the title row, subtitle below it,
    // body in the middle, footer-left + footer-right at the
    // bottom. Any future renaming MUST roll forward every organism
    // consumer + the showcase entry simultaneously.
    const el = await mountLitElement<CardFrame>("card-frame");
    for (const r of REGIONS) {
      expect(el.shadowRoot?.querySelector(`[data-testid="${r}"]`)).not.toBeNull();
    }
    const got = new Set(
      Array.from(el.shadowRoot?.querySelectorAll("slot") ?? []).map(
        (s) => s.getAttribute("name"),
      ),
    );
    for (const slot of NAMED_SLOTS) expect(got.has(slot)).toBe(true);
  });

  it("routes slotted children into the right named slot", async () => {
    const el = await mountLitElement<CardFrame>("card-frame");
    el.innerHTML = NAMED_SLOTS.map(
      (s) => `<span slot="${s}" data-testid="probe-${s}">${s}</span>`,
    ).join("");
    await el.updateComplete;
    for (const s of NAMED_SLOTS) {
      expect(el.querySelector(`[data-testid="probe-${s}"]`)).not.toBeNull();
    }
  });

  it("locks the operator-pinned CSS contract: panel-relative header + footer heights, body clips overflow, footer anchors at edges", async () => {
    // §17.136 -- one test, multiple regex pins so a refactor that
    // breaks any one of them fails immediately rather than getting
    // masked by the others: (1) header + footer heights are
    // panel-relative via `--card-header-height` /
    // `--card-footer-height` with 22% / 12% defaults + 1fr body;
    // (2) body clips overflow + min-height: 0 so kind-specific
    // shrink-to-fit lives inside a known box; (3) footer is
    // space-between so left + right anchor at the edges even when
    // one side is empty.
    const css = (
      CardFrame.styles as unknown as { cssText?: string }
    )?.cssText ?? String(CardFrame.styles);
    expect(css).toMatch(/var\(\s*--card-header-height\s*,\s*22%\s*\)/);
    expect(css).toMatch(/var\(\s*--card-footer-height\s*,\s*12%\s*\)/);
    expect(css).toMatch(/grid-template-rows[^;]*1fr/);
    expect(css).toMatch(/\.body\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/\.footer\s*\{[^}]*justify-content:\s*space-between/);
  });
});
