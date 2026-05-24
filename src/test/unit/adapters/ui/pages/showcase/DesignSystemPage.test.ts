import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../../adapters/ui/pages/showcase/DesignSystemPage.js";
import {
  DESIGN_SYSTEM_CLOSE_EVENT,
  type DesignSystemPage,
} from "../../../../../../adapters/ui/pages/showcase/DesignSystemPage.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

function $(el: DesignSystemPage, testid: string): HTMLElement {
  const f = el.shadowRoot?.querySelector<HTMLElement>(
    `[data-testid="${testid}"]`,
  );
  if (!f) throw new Error(`expected element [${testid}]`);
  return f;
}

describe("<design-system-page> (\u00a717.127 A1 \u2014 foundation)", () => {
  it("renders nothing when closed", async () => {
    const el = await mountLitElement<DesignSystemPage>("design-system-page");
    expect(el.shadowRoot?.querySelector("[data-testid='ds-main']")).toBeNull();
  });

  it("renders all five tier buttons and defaults to atoms (active)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    for (const id of ["atoms", "molecules", "organisms", "templates", "pages"]) {
      expect($(el, `ds-tier-${id}`)).toBeTruthy();
    }
    expect($(el, "ds-tier-atoms").classList.contains("active")).toBe(true);
  });

  it("every tier has a real body — no `ds-placeholder` ever renders (\u00a717.127 A6)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    for (const id of ["atoms", "molecules", "organisms", "templates", "pages"]) {
      ($(el, `ds-tier-${id}`) as HTMLButtonElement).click();
      await el.updateComplete;
      expect($(el, `ds-tier-${id}`).classList.contains("active")).toBe(true);
      expect(
        el.shadowRoot?.querySelector("[data-testid='ds-placeholder']"),
      ).toBeNull();
    }
  });

  it("Atoms tier renders four section headers + the 5 colour tokens (\u00a717.135)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    expect($(el, "ds-atoms-colors")).toBeTruthy();
    expect($(el, "ds-atoms-arrows")).toBeTruthy();
    expect($(el, "ds-atoms-icons")).toBeTruthy();
    expect($(el, "ds-atoms-pdca")).toBeTruthy();
    for (const t of ["bg", "panel", "text", "muted", "accent"]) {
      expect($(el, `ds-token-${t}`)).toBeTruthy();
    }
    // \u00a717.135 -- the \u00a717.133 retired-Unicode-glyphs tombstone
    // block (the `atoms-glyphs` section + its
    // `ds-glyphs-retired-*` list + the five
    // `ds-glyph-retired-u+...` entries) is gone. The Lucide
    // migration is complete and every retired codepoint already
    // has a first-class entry in the Lucide library section
    // below, so the tombstone became redundant. The pre-\u00a717.133
    // `ds-glyph-<codepoint>` cells from the original \u00a717.127 A2
    // glyph grid stay absent too -- they have been gone since L3a.
    expect(
      el.shadowRoot?.querySelector('[data-testid="ds-atoms-glyphs"]'),
    ).toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="ds-glyphs-retired-note"]'),
    ).toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="ds-glyphs-retired-list"]'),
    ).toBeNull();
    for (const codepoint of [
      "u+25ce",
      "u+26a0",
      "u+29b8",
      "u+00d7",
      "u+2713",
      "u+2696",
      "u+1f58d",
    ]) {
      expect(
        el.shadowRoot?.querySelector(`[data-testid="ds-glyph-${codepoint}"]`),
      ).toBeNull();
      expect(
        el.shadowRoot?.querySelector(
          `[data-testid="ds-glyph-retired-${codepoint}"]`,
        ),
      ).toBeNull();
    }
  });

  it("Atoms tier renders the Lucide icon-library section with every registered slug + a license attribution (\u00a717.131)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    expect($(el, "ds-atoms-icons")).toBeTruthy();
    const required = [
      "arrow-up",
      "arrow-up-right",
      "arrow-right",
      "arrow-down-right",
      "arrow-down",
      "ban",
      "check",
      "pencil",
      "plus",
      "sigma",
      "target",
      "triangle-alert",
      "weight",
      "x",
    ];
    for (const slug of required) {
      const cell = $(el, `ds-icon-cell-${slug}`);
      expect(cell.querySelector("ds-icon")).toBeTruthy();
      expect(cell.querySelector(".slug")?.textContent?.trim()).toBe(slug);
    }
    const section = $(el, "ds-section-atoms-icons");
    const license = section.querySelector<HTMLAnchorElement>(
      "a[href='https://lucide.dev']",
    );
    expect(license).toBeTruthy();
    expect(license?.getAttribute("rel")).toMatch(/\bnoopener\b/);
  });

  it("Atoms tier renders all 5 trend arrows + the 4 PDCA badges (\u00a717.127 A2)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    const arrowCells = el.shadowRoot!.querySelectorAll(
      "[data-testid^='ds-arrow-']",
    );
    expect(arrowCells.length).toBe(5);
    // §17.132 -- the showcase arrows are now `<ds-icon>` Lucide SVGs
    // keyed by slug; the cell `data-testid` carries the slug rather
    // than the Unicode code-point it used pre-§17.132.
    const arrowSlugs = Array.from(arrowCells).map(
      (c) => c.querySelector(".big")?.getAttribute("name"),
    );
    expect(arrowSlugs).toEqual([
      "arrow-up",
      "arrow-up-right",
      "arrow-right",
      "arrow-down-right",
      "arrow-down",
    ]);
    for (const id of ["plan", "do", "check", "act"]) {
      expect($(el, `ds-pdca-${id}`)).toBeTruthy();
    }
  });

  it("\u00a717.137 A4 \u2014 atoms-typography section surfaces every kiosk text role with sample + label + meaning + family/weight; every tile inlines the role's own font-size + font-weight so the showcase matches the kiosk's real rendering", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    const sr = el.shadowRoot!;
    expect($(el, "ds-atoms-typography")).toBeTruthy();
    const requiredRoles = [
      "title",
      "value",
      "subtitle",
      "target",
      "timestamp",
      "description",
      "code",
    ];
    for (const role of requiredRoles) {
      const tile = sr.querySelector<HTMLElement>(
        `[data-testid='ds-typography-${role}']`,
      );
      expect(tile).not.toBeNull();
      expect(tile?.classList.contains("atom-tile--typography")).toBe(true);
      const sample = tile?.querySelector<HTMLElement>(".typography-sample");
      expect(sample).not.toBeNull();
      const style = sample!.getAttribute("style") ?? "";
      expect(style).toMatch(/font-size:/);
      expect(style).toMatch(/font-weight:/);
      expect(tile?.querySelector(".name")?.textContent?.trim()).toBeTruthy();
      expect(tile?.querySelector(".usage")?.textContent?.trim()).toBeTruthy();
      expect(tile?.querySelector(".code")?.textContent?.trim()).toBeTruthy();
    }
  });

  it("\u00a717.137 A3 \u2014 every atom-tier item lives inside the unified .atom-tile shape (swatch / glyph / icon / pdca all use .atom-tile + a per-content modifier class, so the showcase reads as one tile family)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    const sr = el.shadowRoot!;
    const atomTestidPrefixes = [
      "ds-typography-",
      "ds-token-",
      "ds-arrow-",
      "ds-icon-cell-",
      "ds-pdca-",
    ];
    for (const prefix of atomTestidPrefixes) {
      const tiles = sr.querySelectorAll<HTMLElement>(
        `[data-testid^='${prefix}']`,
      );
      expect(tiles.length).toBeGreaterThan(0);
      for (const tile of Array.from(tiles)) {
        expect(tile.classList.contains("atom-tile")).toBe(true);
      }
    }
    // \u00a717.137 A4 -- typography section adds a 5th .atom-grid.
    expect(sr.querySelectorAll(".atom-grid").length).toBe(5);
    expect(sr.querySelector(".swatch-grid")).toBeNull();
    expect(sr.querySelector(".glyph-grid")).toBeNull();
    expect(sr.querySelector(".icon-grid")).toBeNull();
    expect(sr.querySelector(".pdca-row")).toBeNull();
  });

  it("Molecules tier renders unit chips, status badges, and disabled affordances (\u00a717.127 A3)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-molecules") as HTMLButtonElement).click();
    await el.updateComplete;
    expect($(el, "ds-mol-units")).toBeTruthy();
    expect($(el, "ds-mol-badges")).toBeTruthy();
    expect($(el, "ds-mol-disabled")).toBeTruthy();
    expect($(el, "ds-mol-weight")).toBeTruthy();
    expect($(el, "ds-mol-card-frame")).toBeTruthy();
    // \u00a717.136 -- the Molecules tier surfaces the new
    // <card-frame> primitive with every slot filled by a probe
    // span (\u03A3 / (USD) / title / subtitle / close-X / body /
    // weight / age) so the structural-only nature of the
    // template is visible at a glance.
    const cardFrameCell = $(el, "ds-mol-card-frame-cell");
    const cardFrame = cardFrameCell.querySelector("card-frame");
    expect(cardFrame).not.toBeNull();
    for (const t of [
      "ds-mol-card-frame-icons",
      "ds-mol-card-frame-unit",
      "ds-mol-card-frame-title",
      "ds-mol-card-frame-subtitle",
      "ds-mol-card-frame-actions",
      "ds-mol-card-frame-body",
      "ds-mol-card-frame-left",
      "ds-mol-card-frame-right",
    ]) {
      expect(cardFrame?.querySelector(`[data-testid="${t}"]`)).not.toBeNull();
    }
    const weightCell = $(el, "ds-mol-weight-cell");
    expect(weightCell.querySelector("weight-edit-button")).toBeTruthy();
    const popover = weightCell.querySelector("weight-edit-popover");
    expect(popover).toBeTruthy();
    expect(popover?.hasAttribute("open")).toBe(true);
    expect(
      $(el, "ds-mol-unit-usd").querySelector("[data-testid='unit-chip']"),
    ).toBeTruthy();
    expect(
      $(el, "ds-mol-unit-empty").querySelector("[data-testid='unit-chip']"),
    ).toBeNull();
    for (const id of ["plan", "do", "check", "act"]) {
      const cell = $(el, `ds-mol-badge-${id}`);
      const badge = cell.querySelector("[data-testid='status-badge']");
      expect(badge?.getAttribute("data-status-id")).toBe(id);
    }
    expect(
      $(el, "ds-mol-disabled-switch-off").querySelector(
        "[data-testid='disabled-switch']",
      ),
    ).toBeTruthy();
  });

  it("Organisms tier mounts the real burger / breadcrumb / plus elements (\u00a717.127 A4a)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-organisms") as HTMLButtonElement).click();
    await el.updateComplete;
    expect($(el, "ds-org-burger-cell").querySelector("burger-menu")).toBeTruthy();
    const crumb = $(el, "ds-org-breadcrumb-cell").querySelector(
      "focus-breadcrumb",
    ) as { path?: ReadonlyArray<{ id: string; title: string }> } | null;
    expect(crumb?.path?.length).toBe(3);
    expect(crumb?.path?.[2].title).toBe("Pager fatigue");
    const plus = $(el, "ds-org-plus-cell").querySelector(
      "plus-tile",
    ) as HTMLElement | null;
    expect(plus?.getAttribute("parent-id")).toBe("ds-demo-parent");
  });

  it("Organisms tier silences burger / breadcrumb / plus events at the host (\u00a717.127 A4a)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-organisms") as HTMLButtonElement).click();
    await el.updateComplete;
    const escaped: string[] = [];
    const listener = (ev: Event) => escaped.push(ev.type);
    for (const t of [
      "burger-menu-action",
      "breadcrumb-navigate",
      "plus-tile-activate",
    ]) {
      document.addEventListener(t, listener);
    }
    el.shadowRoot
      ?.querySelector("burger-menu")
      ?.dispatchEvent(
        new CustomEvent("burger-menu-action", {
          bubbles: true,
          composed: true,
          detail: { action: "about" },
        }),
      );
    el.shadowRoot
      ?.querySelector("focus-breadcrumb")
      ?.dispatchEvent(
        new CustomEvent("breadcrumb-navigate", {
          bubbles: true,
          composed: true,
          detail: { nodeId: "ds-root" },
        }),
      );
    el.shadowRoot
      ?.querySelector("plus-tile")
      ?.dispatchEvent(
        new CustomEvent("plus-tile-activate", {
          bubbles: true,
          composed: true,
          detail: { parentId: "ds-demo-parent" },
        }),
      );
    expect(escaped).toEqual([]);
    for (const t of [
      "burger-menu-action",
      "breadcrumb-navigate",
      "plus-tile-activate",
    ]) {
      document.removeEventListener(t, listener);
    }
  });

  it("Organisms tier mounts BSC AsParent + AsChild with sample VMs (\u00a717.127 A4b-1)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-organisms") as HTMLButtonElement).click();
    await el.updateComplete;
    const asParent = $(el, "ds-org-bsc-asparent-cell").querySelector(
      "business-score-card-as-parent",
    ) as { vm?: { id: string; title: string } | null } | null;
    expect(asParent?.vm?.id).toBe("ds-bsc-on-track");
    expect(asParent?.vm?.title).toBe("Quarterly revenue");
    const asChild = $(el, "ds-org-bsc-aschild-cell").querySelector(
      "business-score-card-as-child",
    ) as { vm?: { id: string; value: { kind: string } } | null } | null;
    expect(asChild?.vm?.id).toBe("ds-bsc-off-track");
    expect(asChild?.vm?.value.kind).toBe("computedMean");
  });

  it("Organisms tier renders BSC in all four positions (child/parent x portrait/landscape) (\u00a717.137 A5a)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-organisms") as HTMLButtonElement).click();
    await el.updateComplete;
    const fourup = $(el, "ds-org-bsc-fourup");
    expect(fourup).toBeTruthy();
    const expectedCells = [
      "ds-org-bsc-aschild-portrait-cell",
      "ds-org-bsc-aschild-cell",
      "ds-org-bsc-asparent-portrait-cell",
      "ds-org-bsc-asparent-cell",
    ];
    for (const tid of expectedCells) {
      const cell = $(el, tid);
      expect(cell).toBeTruthy();
      const stage = cell.querySelector(".stage");
      expect(stage).toBeTruthy();
      const stageClass = stage?.className ?? "";
      expect(stageClass).toMatch(
        /stage--(child|parent)-(portrait|landscape)/,
      );
    }
    const portraitChild = $(
      el,
      "ds-org-bsc-aschild-portrait-cell",
    ).querySelector("business-score-card-as-child");
    expect(portraitChild).toBeTruthy();
    const portraitParent = $(
      el,
      "ds-org-bsc-asparent-portrait-cell",
    ).querySelector("business-score-card-as-parent");
    expect(portraitParent).toBeTruthy();
  });

  it("Organisms tier mounts ComputedNode + CBSN with WEIGHTED_AVERAGE pickers (\u00a717.127 A4b-2)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-organisms") as HTMLButtonElement).click();
    await el.updateComplete;
    const computed = $(el, "ds-org-computed-asparent-cell").querySelector(
      "computed-card",
    ) as { vm?: { id: string; computationKind: string } | null } | null;
    expect(computed?.vm?.id).toBe("ds-computed");
    expect(computed?.vm?.computationKind).toBe("SUM");
    const cbsn = $(el, "ds-org-computed-bsc-asparent-cell").querySelector(
      "computed-business-score-card",
    ) as { vm?: { id: string; computationKind: string } | null } | null;
    expect(cbsn?.vm?.id).toBe("ds-computed-bsc");
    expect(cbsn?.vm?.computationKind).toBe("WEIGHTED_AVERAGE");
  });

  it("Organisms tier renders Computed + CBSN in all four positions (\u00a717.137 A5b)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-organisms") as HTMLButtonElement).click();
    await el.updateComplete;
    expect($(el, "ds-org-computed-fourup")).toBeTruthy();
    expect($(el, "ds-org-computed-bsc-fourup")).toBeTruthy();
    const computedPortrait = $(
      el,
      "ds-org-computed-aschild-portrait-cell",
    ).querySelector("computed-card");
    expect(computedPortrait).toBeTruthy();
    expect((computedPortrait as Element).getAttribute("view-role")).toBe(
      "asChild",
    );
    const cbsnPortraitParent = $(
      el,
      "ds-org-computed-bsc-asparent-portrait-cell",
    ).querySelector("computed-business-score-card");
    expect(cbsnPortraitParent).toBeTruthy();
    expect((cbsnPortraitParent as Element).getAttribute("view-role")).toBe(
      "asParent",
    );
  });

  it("Organisms tier mounts Text + Workflow tiles with sample VMs (\u00a717.127 A4b-3)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-organisms") as HTMLButtonElement).click();
    await el.updateComplete;
    const textP = $(el, "ds-org-text-asparent-cell").querySelector(
      "text-node-as-parent",
    ) as { vm?: { id: string; title: string } | null } | null;
    expect(textP?.vm?.id).toBe("ds-text");
    const textC = $(el, "ds-org-text-aschild-cell").querySelector(
      "text-node-as-child",
    );
    expect(textC).toBeTruthy();
    const wfP = $(el, "ds-org-workflow-asparent-cell").querySelector(
      "workflow-node-as-parent",
    ) as { vm?: { id: string; status: { id: string } } | null } | null;
    expect(wfP?.vm?.id).toBe("ds-workflow");
    expect(wfP?.vm?.status.id).toBe("do");
    const wfC = $(el, "ds-org-workflow-aschild-cell").querySelector(
      "workflow-node-as-child",
    );
    expect(wfC).toBeTruthy();
  });

  it("Organisms tier mounts Picture + URL tiles with sample VMs (\u00a717.127 A4b-4)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-organisms") as HTMLButtonElement).click();
    await el.updateComplete;
    const picP = $(el, "ds-org-picture-asparent-cell").querySelector(
      "picture-node-as-parent",
    ) as { vm?: { id: string; imageUrl: string } | null } | null;
    expect(picP?.vm?.id).toBe("ds-picture");
    expect(picP?.vm?.imageUrl.startsWith("data:image/svg+xml")).toBe(true);
    const picC = $(el, "ds-org-picture-aschild-cell").querySelector(
      "picture-node-as-child",
    );
    expect(picC).toBeTruthy();
    const urlP = $(el, "ds-org-url-asparent-cell").querySelector(
      "url-node-as-parent",
    ) as { vm?: { id: string; url: string } | null } | null;
    expect(urlP?.vm?.id).toBe("ds-url");
    expect(urlP?.vm?.url).toBe("https://example.org/obeya/runbook");
    const urlC = $(el, "ds-org-url-aschild-cell").querySelector(
      "url-node-as-child",
    );
    expect(urlC).toBeTruthy();
  });

  it("Organisms tier silences `inline-edit-title` dispatched from Picture / URL parents (\u00a717.127 A4b-4)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-organisms") as HTMLButtonElement).click();
    await el.updateComplete;
    const escaped = vi.fn();
    document.addEventListener("inline-edit-title", escaped);
    for (const tag of ["picture-node-as-parent", "url-node-as-parent"]) {
      el.shadowRoot
        ?.querySelector(tag)
        ?.dispatchEvent(
          new CustomEvent("inline-edit-title", {
            bubbles: true,
            composed: true,
            detail: { nodeId: tag, trimmed: "demo" },
          }),
        );
    }
    expect(escaped).not.toHaveBeenCalled();
    document.removeEventListener("inline-edit-title", escaped);
  });

  it("Organisms tier silences `workflow-status-change` at the host (\u00a717.127 A4b-3)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-organisms") as HTMLButtonElement).click();
    await el.updateComplete;
    const escaped = vi.fn();
    document.addEventListener("workflow-status-change", escaped);
    el.shadowRoot
      ?.querySelector("workflow-node-as-parent")
      ?.dispatchEvent(
        new CustomEvent("workflow-status-change", {
          bubbles: true,
          composed: true,
          detail: { nodeId: "ds-workflow", newStatusId: "check" },
        }),
      );
    expect(escaped).not.toHaveBeenCalled();
    document.removeEventListener("workflow-status-change", escaped);
  });

  it("Organisms tier silences `computation-kind-change` at the host (\u00a717.127 A4b-2)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-organisms") as HTMLButtonElement).click();
    await el.updateComplete;
    const escaped = vi.fn();
    document.addEventListener("computation-kind-change", escaped);
    el.shadowRoot
      ?.querySelector("computed-card")
      ?.dispatchEvent(
        new CustomEvent("computation-kind-change", {
          bubbles: true,
          composed: true,
          detail: { nodeId: "ds-computed", newKind: "AVERAGE" },
        }),
      );
    expect(escaped).not.toHaveBeenCalled();
    document.removeEventListener("computation-kind-change", escaped);
  });

  it("Organisms tier silences inline-edit-* bubbles dispatched from BSC tiles (\u00a717.127 A4b-1)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-organisms") as HTMLButtonElement).click();
    await el.updateComplete;
    const escaped: string[] = [];
    const listener = (ev: Event) => escaped.push(ev.type);
    for (const t of [
      "inline-edit-title",
      "inline-edit-value",
      "inline-edit-unit",
    ]) {
      document.addEventListener(t, listener);
    }
    const tile = el.shadowRoot?.querySelector("business-score-card-as-parent");
    for (const t of [
      "inline-edit-title",
      "inline-edit-value",
      "inline-edit-unit",
    ]) {
      tile?.dispatchEvent(
        new CustomEvent(t, {
          bubbles: true,
          composed: true,
          detail: { nodeId: "ds-bsc-on-track", trimmed: "demo" },
        }),
      );
    }
    expect(escaped).toEqual([]);
    for (const t of [
      "inline-edit-title",
      "inline-edit-value",
      "inline-edit-unit",
    ]) {
      document.removeEventListener(t, listener);
    }
  });

  it("Templates tier composes parent-strip + children-grid with sample slots (\u00a717.127 A5)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-templates") as HTMLButtonElement).click();
    await el.updateComplete;
    const cell = $(el, "ds-tpl-focused-cell");
    const strip = cell.querySelector("parent-identity-strip") as {
      vm?: { id: string } | null;
      parentId?: string;
    } | null;
    expect(strip?.vm?.id).toBe("ds-bsc-on-track");
    expect(strip?.parentId).toBe("ds-demo-grandparent");
    const grid = cell.querySelector("children-grid") as {
      slots?: ReadonlyArray<{ slot: string; weight: number }>;
    } | null;
    expect(grid?.slots?.length).toBe(4);
    expect(grid?.slots?.[3].slot).toBe("plus");
    expect(
      el.shadowRoot?.querySelector("[data-testid='ds-placeholder']"),
    ).toBeNull();
  });

  it("Templates tier silences the four shell-composition events at the host (\u00a717.127 A5)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-templates") as HTMLButtonElement).click();
    await el.updateComplete;
    const escaped: string[] = [];
    const listener = (ev: Event) => escaped.push(ev.type);
    const events = [
      "focus-close-to-parent",
      "edit-node-open",
      "tile-drill",
      "weight-edit-open",
    ] as const;
    for (const t of events) document.addEventListener(t, listener);
    const strip = el.shadowRoot?.querySelector("parent-identity-strip");
    const grid = el.shadowRoot?.querySelector("children-grid");
    strip?.dispatchEvent(
      new CustomEvent("focus-close-to-parent", {
        bubbles: true,
        composed: true,
        detail: { parentId: "ds-demo-grandparent" },
      }),
    );
    strip?.dispatchEvent(
      new CustomEvent("edit-node-open", {
        bubbles: true,
        composed: true,
        detail: { nodeId: "ds-bsc-on-track" },
      }),
    );
    grid?.dispatchEvent(
      new CustomEvent("tile-drill", {
        bubbles: true,
        composed: true,
        detail: { nodeId: "ds-text" },
      }),
    );
    grid?.dispatchEvent(
      new CustomEvent("weight-edit-open", {
        bubbles: true,
        composed: true,
        detail: { nodeId: "ds-text", weight: 3 },
      }),
    );
    expect(escaped).toEqual([]);
    for (const t of events) document.removeEventListener(t, listener);
  });

  it("Pages tier mounts the real <tree-map-screen> with a focused-tree VM (\u00a717.127 A6)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-pages") as HTMLButtonElement).click();
    await el.updateComplete;
    const screen = $(el, "ds-pg-screen-mount") as unknown as {
      view?: { center: { id: string } } | null;
      boardName?: string;
      breadcrumbPath?: ReadonlyArray<{ id: string; title: string }>;
    };
    expect(screen.view?.center.id).toBe("ds-bsc-on-track");
    expect(screen.boardName).toBe("Design system demo");
    expect(screen.breadcrumbPath?.length).toBe(3);
    expect(screen.breadcrumbPath?.[0].title).toBe("Obeya");
  });

  it("Pages tier silences `tile-drill` + `burger-menu-action` from the embedded screen (\u00a717.127 A6)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-pages") as HTMLButtonElement).click();
    await el.updateComplete;
    const escaped: string[] = [];
    const listener = (ev: Event) => escaped.push(ev.type);
    for (const t of ["tile-drill", "burger-menu-action"]) {
      document.addEventListener(t, listener);
    }
    const screen = el.shadowRoot?.querySelector("tree-map-screen");
    screen?.dispatchEvent(
      new CustomEvent("tile-drill", {
        bubbles: true,
        composed: true,
        detail: { nodeId: "ds-text" },
      }),
    );
    screen?.dispatchEvent(
      new CustomEvent("burger-menu-action", {
        bubbles: true,
        composed: true,
        detail: { action: "about" },
      }),
    );
    expect(escaped).toEqual([]);
    for (const t of ["tile-drill", "burger-menu-action"]) {
      document.removeEventListener(t, listener);
    }
  });

  it("top-bar search input hides sections that don't match (\u00a717.127 P2)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    const input = $(el, "ds-search") as HTMLInputElement;
    input.value = "trend";
    input.dispatchEvent(new Event("input"));
    await el.updateComplete;
    const arrowsSection = $(el, "ds-section-atoms-arrows") as HTMLElement;
    const colorsSection = $(el, "ds-section-atoms-colors") as HTMLElement;
    expect(arrowsSection.hidden).toBe(false);
    expect(colorsSection.hidden).toBe(true);
    expect(
      el.shadowRoot?.querySelector<HTMLElement>(
        "[data-testid='ds-empty-state']",
      )?.hidden,
    ).toBe(true);
  });

  it("empty-state appears when no section matches the query (\u00a717.127 P2)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    const input = $(el, "ds-search") as HTMLInputElement;
    input.value = "zzz-nothing-matches";
    input.dispatchEvent(new Event("input"));
    await el.updateComplete;
    const empty = $(el, "ds-empty-state") as HTMLElement;
    expect(empty.hidden).toBe(false);
    expect(empty.textContent ?? "").toContain("zzz-nothing-matches");
    const sections = el.shadowRoot!.querySelectorAll<HTMLElement>(
      "section[data-search-text]",
    );
    for (const s of sections) expect(s.hidden).toBe(true);
  });

  it("clear button resets the query and shows every section (\u00a717.127 P2)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    const input = $(el, "ds-search") as HTMLInputElement;
    input.value = "trend";
    input.dispatchEvent(new Event("input"));
    await el.updateComplete;
    ($(el, "ds-search-clear") as HTMLButtonElement).click();
    await el.updateComplete;
    expect((el.shadowRoot?.querySelector("[data-testid='ds-search']") as
      HTMLInputElement | null)?.value).toBe("");
    const sections = el.shadowRoot!.querySelectorAll<HTMLElement>(
      "section[data-search-text]",
    );
    for (const s of sections) expect(s.hidden).toBe(false);
  });

  it("query persists across tier switches and shows tier-specific empty-state (\u00a717.127 P2)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    const input = $(el, "ds-search") as HTMLInputElement;
    input.value = "trend";
    input.dispatchEvent(new Event("input"));
    await el.updateComplete;
    expect(($(el, "ds-section-atoms-arrows") as HTMLElement).hidden).toBe(false);
    ($(el, "ds-tier-templates") as HTMLButtonElement).click();
    await el.updateComplete;
    const empty = $(el, "ds-empty-state") as HTMLElement;
    expect(empty.hidden).toBe(false);
    expect(empty.querySelector("strong")?.textContent).toBe("Templates");
  });

  it("every showcase section has a view-source button after P3b fill (\u00a717.127 P3b)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    const tiersWithSections: ReadonlyArray<readonly [string, readonly string[]]> = [
      [
        "atoms",
        ["atoms-colors", "atoms-arrows", "atoms-icons", "atoms-pdca"],
      ],
      ["molecules", ["mol-units", "mol-badges", "mol-disabled", "mol-weight", "mol-card-frame"]],
      [
        "organisms",
        [
          "org-burger",
          "org-breadcrumb",
          "org-plus",
          "org-bsc",
          "org-computed",
          "org-text",
          "org-picture",
        ],
      ],
      ["templates", ["tpl-focused"]],
      ["pages", ["pg-screen"]],
    ];
    for (const [tier, ids] of tiersWithSections) {
      ($(el, `ds-tier-${tier}`) as HTMLButtonElement).click();
      await el.updateComplete;
      for (const id of ids) {
        expect(
          el.shadowRoot?.querySelector(`[data-testid='ds-view-source-${id}']`),
          `expected view-source button for ${id}`,
        ).toBeTruthy();
      }
    }
  });

  it("opening a snippet from each tier surfaces tier-appropriate code (\u00a717.127 P3b)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    const cases: ReadonlyArray<{
      tier: string;
      id: string;
      mustContain: string;
    }> = [
      { tier: "atoms", id: "atoms-arrows", mustContain: "TREND_ARROW_SLUGS" },
      { tier: "molecules", id: "mol-badges", mustContain: "renderStatusBadge" },
      { tier: "molecules", id: "mol-weight", mustContain: "weight-edit-button" },
      { tier: "organisms", id: "org-bsc", mustContain: "business-score-card-as-parent" },
      { tier: "templates", id: "tpl-focused", mustContain: "parent-identity-strip" },
      { tier: "pages", id: "pg-screen", mustContain: "tree-map-screen" },
    ];
    for (const { tier, id, mustContain } of cases) {
      ($(el, `ds-tier-${tier}`) as HTMLButtonElement).click();
      await el.updateComplete;
      ($(el, `ds-view-source-${id}`) as HTMLButtonElement).click();
      await el.updateComplete;
      const code = $(el, "ds-snippet-code").textContent ?? "";
      expect(code, `snippet for ${id} should contain "${mustContain}"`).toContain(
        mustContain,
      );
      ($(el, "ds-snippet-close") as HTMLButtonElement).click();
      await el.updateComplete;
    }
  });

  it("the wired demo section (mol-units) renders the view-source button (\u00a717.127 P3a)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-molecules") as HTMLButtonElement).click();
    await el.updateComplete;
    expect($(el, "ds-view-source-mol-units")).toBeTruthy();
  });

  it("clicking the view-source button opens the snippet popover with the section's code (\u00a717.127 P3a)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-molecules") as HTMLButtonElement).click();
    await el.updateComplete;
    ($(el, "ds-view-source-mol-units") as HTMLButtonElement).click();
    await el.updateComplete;
    expect($(el, "ds-snippet-overlay")).toBeTruthy();
    expect($(el, "ds-snippet-panel")).toBeTruthy();
    const code = $(el, "ds-snippet-code").textContent ?? "";
    expect(code).toContain("renderUnitChip(\"USD\")");
    expect(code).toContain("renderUnitChip(\"%\")");
    expect($(el, "ds-snippet-copy")).toBeTruthy();
  });

  it("the snippet popover's close button + ESC both dismiss it (\u00a717.127 P3a)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-molecules") as HTMLButtonElement).click();
    await el.updateComplete;
    ($(el, "ds-view-source-mol-units") as HTMLButtonElement).click();
    await el.updateComplete;
    ($(el, "ds-snippet-close") as HTMLButtonElement).click();
    await el.updateComplete;
    expect(
      el.shadowRoot?.querySelector("[data-testid='ds-snippet-overlay']"),
    ).toBeNull();
    ($(el, "ds-view-source-mol-units") as HTMLButtonElement).click();
    await el.updateComplete;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await el.updateComplete;
    expect(
      el.shadowRoot?.querySelector("[data-testid='ds-snippet-overlay']"),
    ).toBeNull();
  });

  it("ESC closes the snippet popover BEFORE falling through to closing the page (\u00a717.127 P3a)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    const closeHandler = vi.fn();
    el.addEventListener(DESIGN_SYSTEM_CLOSE_EVENT, closeHandler);
    ($(el, "ds-tier-molecules") as HTMLButtonElement).click();
    await el.updateComplete;
    ($(el, "ds-view-source-mol-units") as HTMLButtonElement).click();
    await el.updateComplete;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await el.updateComplete;
    expect(closeHandler).not.toHaveBeenCalled();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(closeHandler).toHaveBeenCalledTimes(1);
  });

  it("Molecules tier silences bubbled `value-node-disabled-change` at the host (\u00a717.127 A3)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-molecules") as HTMLButtonElement).click();
    await el.updateComplete;
    const escaped = vi.fn();
    document.addEventListener("value-node-disabled-change", escaped);
    const switchBtn = $(el, "ds-mol-disabled-switch-off").querySelector(
      "[data-testid='disabled-switch']",
    ) as HTMLButtonElement;
    switchBtn.click();
    expect(escaped).not.toHaveBeenCalled();
    document.removeEventListener("value-node-disabled-change", escaped);
  });

  it('"Back to kiosk" dispatches `design-system-close` (bubbles+composed)', async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(DESIGN_SYSTEM_CLOSE_EVENT, handler);
    ($(el, "design-system-close") as HTMLButtonElement).click();
    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0]?.[0] as CustomEvent | undefined;
    expect(evt?.bubbles).toBe(true);
    expect(evt?.composed).toBe(true);
  });

  it("Escape dispatches when open, no-op when closed", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(DESIGN_SYSTEM_CLOSE_EVENT, handler);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler).toHaveBeenCalledTimes(1);
    el.open = false;
    await el.updateComplete;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
