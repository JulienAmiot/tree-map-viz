import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/views/WorkflowNode/WorkflowNodeAsChild.js";
import { WorkflowNodeAsChild } from "../../../../../../adapters/ui/views/WorkflowNode/WorkflowNodeAsChild.js";
import type { WorkflowNodeViewModel } from "../../../../../../adapters/ui/views/NodeViewModel.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

const DATE_ISO = "2026-04-23T18:25:43.511Z";

function vmWith(opts: Partial<WorkflowNodeViewModel> = {}): WorkflowNodeViewModel {
  return {
    kind: "WorkflowNode",
    id: "wf1",
    title: "Sprint task",
    value: {
      text: "design review pending",
      dateIso: DATE_ISO,
      dateColor: "rgb(255, 145, 50)",
    },
    status: {
      id: "do",
      label: "DO",
      color: "rgb(59, 130, 246)",
    },
    ...opts,
  } as WorkflowNodeViewModel;
}

describe("<workflow-node-as-child> (§17.117)", () => {
  it("renders Title + the latest markdown value + the WorkflowNode data-view-kind hook (mirrors the TextNode child contract)", async () => {
    const el = await mountLitElement<WorkflowNodeAsChild>(
      "workflow-node-as-child",
      (e) => { e.vm = vmWith(); },
    );
    const title = el.shadowRoot?.querySelector('[data-testid="title"]');
    expect(title?.textContent?.trim()).toBe("Sprint task");
    expect(title?.getAttribute("data-view-kind")).toBe("WorkflowNode");
    expect(
      el.shadowRoot?.querySelector('[data-testid="value"]')?.textContent?.trim(),
    ).toBe("design review pending");
  });

  it("renders the bottom-right age-coloured timestamp like a TextNode tile", async () => {
    const el = await mountLitElement<WorkflowNodeAsChild>(
      "workflow-node-as-child",
      (e) => { e.vm = vmWith(); },
    );
    const ts = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="value-date"]');
    expect(ts).not.toBeNull();
    expect(ts?.getAttribute("datetime")).toBe(DATE_ISO);
    expect(ts?.getAttribute("style") ?? "").toMatch(/--age-color:\s*rgb\(/);
  });

  it("renders the §17.117 status badge with the baked label + colour driven by --status-color (border + text only; transparent background)", async () => {
    const el = await mountLitElement<WorkflowNodeAsChild>(
      "workflow-node-as-child",
      (e) => { e.vm = vmWith(); },
    );
    const badge = el.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="status-badge"]',
    );
    expect(badge).not.toBeNull();
    expect(badge?.textContent?.trim()).toBe("DO");
    expect(badge?.getAttribute("data-status-id")).toBe("do");
    expect(badge?.getAttribute("style") ?? "").toMatch(
      /--status-color:\s*rgb\(59,\s*130,\s*246\)/,
    );

    // §17.117 + §17.121e — the badge CSS pins the visual contract:
    // transparent background, coloured border + text driven by
    // --status-color, pointer-events disabled. The §17.121e refresh
    // dropped the pre-§17.121e bottom-left absolute-positioning pins
    // (bottom: 0.2rem / left: 0.35rem) — the badge now lives inside
    // the shared `.subtitle` slot, so positioning is delegated to
    // the slot's centered flex layout rather than pinned per badge.
    // Pinning the surviving literals catches a future tweak that
    // breaks any of the colour / interactivity invariants.
    const cssText = (
      WorkflowNodeAsChild.styles as readonly { cssText?: string }[]
    )
      .map((s) => String(s.cssText ?? s))
      .join("\n");
    expect(cssText).toMatch(/\.status-badge\s*\{[\s\S]*?background:\s*transparent/);
    expect(cssText).toMatch(
      /\.status-badge\s*\{[\s\S]*?border:\s*1\.5px\s+solid\s+var\(--status-color/,
    );
    expect(cssText).toMatch(
      /\.status-badge\s*\{[\s\S]*?color:\s*var\(--status-color/,
    );
    expect(cssText).toMatch(/\.status-badge\s*\{[\s\S]*?pointer-events:\s*none/);
    // §17.121e — the badge sits inside the shared `.subtitle` row
    // directly under the title. Asserting the DOM nesting catches a
    // future refactor that drops the subtitle wrapper.
    const subtitle = el.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="subtitle"]',
    );
    expect(subtitle).not.toBeNull();
    expect(subtitle?.contains(badge!)).toBe(true);
  });

  it("omits the status badge when the mapper produced an empty label (defensive fallback; never throws)", async () => {
    const el = await mountLitElement<WorkflowNodeAsChild>(
      "workflow-node-as-child",
      (e) => {
        e.vm = vmWith({
          status: { id: "", label: "", color: "rgb(0,0,0)" },
        });
      },
    );
    expect(
      el.shadowRoot?.querySelector('[data-testid="status-badge"]'),
    ).toBeNull();
  });

  it("\u00a717.121i \u2014 a disabled VM prepends a `.disabled-indicator` pill at the LEFT of the title; an enabled VM emits nothing (no strike, no value-area dim)", async () => {
    const enabled = await mountLitElement<WorkflowNodeAsChild>(
      "workflow-node-as-child",
      (e) => { e.vm = vmWith(); },
    );
    expect(
      enabled.shadowRoot?.querySelector('[data-testid="disabled-indicator"]'),
    ).toBeNull();
    expect(
      enabled.shadowRoot?.querySelector('[data-testid="value-row"]')?.hasAttribute("data-disabled"),
    ).toBe(false);
    const disabled = await mountLitElement<WorkflowNodeAsChild>(
      "workflow-node-as-child",
      (e) => { e.vm = vmWith({ disabled: true }); },
    );
    const title = disabled.shadowRoot?.querySelector('[data-testid="title"]');
    expect(title?.firstElementChild?.getAttribute("data-testid")).toBe("disabled-indicator");
    expect(
      disabled.shadowRoot?.querySelector('[data-testid="value-row"]')?.hasAttribute("data-disabled"),
    ).toBe(false);
  });

  it("renders the orphan-id muted-grey fallback when the mapper could not resolve the statusId (§17.117 — surfaces the uppercased id so the operator can repair it)", async () => {
    const el = await mountLitElement<WorkflowNodeAsChild>(
      "workflow-node-as-child",
      (e) => {
        e.vm = vmWith({
          status: { id: "ghost", label: "GHOST", color: "rgb(150, 150, 150)" },
        });
      },
    );
    const badge = el.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="status-badge"]',
    );
    expect(badge?.textContent?.trim()).toBe("GHOST");
    expect(badge?.getAttribute("style") ?? "").toMatch(
      /--status-color:\s*rgb\(150,\s*150,\s*150\)/,
    );
  });
});
