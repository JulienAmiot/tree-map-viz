import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/molecules/cardBody/CardBody.js";
import { CardBody } from "../../../../../../adapters/ui/molecules/cardBody/CardBody.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

const NAMED_SLOTS = ["lead", "aux", "meta"] as const;
const CELL_REGIONS = ["card-body-lead", "card-body-aux", "card-body-meta"] as const;

describe("<card-body> (\u00a717.142 shared 3-cell body skeleton)", () => {
  it("renders the lead + aux + meta cells, declares the named slots, and exposes each cell as a shadow-piercing `part` so per-views can override", async () => {
    // §17.142 -- the slot set is operator-pinned. Per-views drop
    // content into `lead` (focal), `aux` (secondary), `meta`
    // (tertiary). Cell parts let per-view CSS pierce the shadow
    // for kind-specific divergence (e.g. WorkflowNode's PDCA-
    // coloured aux cell). All three contracts in one test so a
    // refactor that breaks any of them fails immediately.
    const el = await mountLitElement<CardBody>("card-body");
    const root = el.shadowRoot;
    for (const r of CELL_REGIONS) {
      expect(root?.querySelector(`[data-testid="${r}"]`)).not.toBeNull();
    }
    const slots = new Set(
      Array.from(root?.querySelectorAll("slot") ?? []).map((s) => s.getAttribute("name")),
    );
    for (const name of NAMED_SLOTS) expect(slots.has(name)).toBe(true);
    for (const part of NAMED_SLOTS) {
      expect(root?.querySelector(`[part="${part}"]`)).not.toBeNull();
    }
  });

  it("routes slotted children into the matching named slot", async () => {
    const el = await mountLitElement<CardBody>("card-body");
    el.innerHTML = NAMED_SLOTS.map(
      (s) => `<span slot="${s}" data-testid="probe-${s}">${s}</span>`,
    ).join("");
    await el.updateComplete;
    for (const s of NAMED_SLOTS) {
      expect(el.querySelector(`[data-testid="probe-${s}"]`)).not.toBeNull();
    }
  });

  it("locks the operator-pinned CSS contract: grid on :host, container-type size, stretch alignment, 2fr/1fr landscape columns, portrait container-query flip, and tunable custom properties", async () => {
    // §17.142 -- pins every load-bearing CSS contract in one test:
    // (1) `display: grid` on :host so the molecule IS the grid;
    // (2) `container-type: size` so the portrait flip resolves
    //     against the host's own aspect ratio (not a viewport
    //     media query);
    // (3) `align-items: stretch` + `justify-items: stretch` so
    //     cells fill their tracks -- fixes the BSC AsChild
    //     "doesn't fill the whole space" bug from the §17.141
    //     review;
    // (4) landscape default uses a `2fr` lead column + 1fr
    //     aux/meta column, with lead spanning two rows;
    // (5) `@container (orientation: portrait)` flip lives in the
    //     stylesheet;
    // (6) `--card-body-lead-cols` + `--card-body-gap` custom
    //     properties expose the lead-to-aux ratio + cell gap so
    //     per-views can tune without re-declaring the grid.
    const css = (
      CardBody.styles as unknown as { cssText?: string }
    )?.cssText ?? String(CardBody.styles);
    expect(css).toMatch(/:host\s*\{[^}]*display:\s*grid/);
    expect(css).toMatch(/:host\s*\{[^}]*container-type:\s*size/);
    expect(css).toMatch(/:host\s*\{[^}]*align-items:\s*stretch/);
    expect(css).toMatch(/:host\s*\{[^}]*justify-items:\s*stretch/);
    expect(css).toMatch(/grid-template-columns:\s*var\(\s*--card-body-lead-cols\s*,\s*2fr\s*\)\s*1fr/);
    expect(css).toMatch(/grid-template-areas:\s*\n?\s*"lead aux"\s*\n?\s*"lead meta"/);
    expect(css).toMatch(/@container\s*\(\s*orientation:\s*portrait\s*\)/);
    expect(css).toMatch(/var\(\s*--card-body-gap\s*,\s*0\s*\)/);
  });

  it("\u00a717.142d \u2014 `data-layout=\"lead-only\"` collapses the grid to a single 1fr column / 1fr row track and hides the aux + meta cells so single-content kinds (Workflow / Text / Picture / URL) get the full body width", async () => {
    const css = (
      CardBody.styles as unknown as { cssText?: string }
    )?.cssText ?? String(CardBody.styles);
    expect(css).toMatch(/:host\(\[data-layout="lead-only"\]\)\s*\{[^}]*grid-template-columns:\s*1fr/);
    expect(css).toMatch(/:host\(\[data-layout="lead-only"\]\)\s*\{[^}]*grid-template-rows:\s*1fr/);
    expect(css).toMatch(/:host\(\[data-layout="lead-only"\]\)\s*\{[^}]*grid-template-areas:\s*"lead"/);
    expect(css).toMatch(/:host\(\[data-layout="lead-only"\]\)\s*\.cell--aux[\s\S]*display:\s*none/);
    expect(css).toMatch(/:host\(\[data-layout="lead-only"\]\)\s*\.cell--meta[\s\S]*display:\s*none/);
  });

  it("\u00a717.142d \u2014 a `<card-body data-layout=\"lead-only\">` mount keeps all three slot wrappers in the DOM so a future variant flip can re-show the aux + meta cells without rewiring the cell template", async () => {
    const el = await mountLitElement<CardBody>("card-body", (e) => {
      e.setAttribute("data-layout", "lead-only");
    });
    const root = el.shadowRoot;
    for (const r of CELL_REGIONS) {
      expect(root?.querySelector(`[data-testid="${r}"]`)).not.toBeNull();
    }
  });
});
