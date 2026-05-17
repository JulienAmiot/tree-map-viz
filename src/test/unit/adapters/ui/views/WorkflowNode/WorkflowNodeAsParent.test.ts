import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/views/WorkflowNode/WorkflowNodeAsParent.js";
import { WorkflowNodeAsParent } from "../../../../../../adapters/ui/views/WorkflowNode/WorkflowNodeAsParent.js";
import {
  INLINE_EDIT_TITLE_EVENT,
  INLINE_EDIT_VALUE_EVENT,
  type InlineEditTitleDetail,
  type InlineEditValueDetail,
} from "../../../../../../adapters/ui/views/inlineEditEvents.js";
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

describe("<workflow-node-as-parent> (§17.117)", () => {
  it("renders Title + markdown value + status badge with the parent-role data-view-kind hook", async () => {
    const el = await mountLitElement<WorkflowNodeAsParent>(
      "workflow-node-as-parent",
      (e) => { e.vm = vmWith(); },
    );
    const title = el.shadowRoot?.querySelector('[data-testid="title"]');
    expect(title?.getAttribute("data-view-kind")).toBe("WorkflowNode");
    expect(title?.textContent?.trim()).toBe("Sprint task");
    expect(
      el.shadowRoot?.querySelector('[data-testid="value"]')?.textContent?.trim(),
    ).toBe("design review pending");
    const badge = el.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="status-badge"]',
    );
    expect(badge?.textContent?.trim()).toBe("DO");
    expect(badge?.getAttribute("data-status-id")).toBe("do");
  });

  it(":host { position: static } so the bottom-left badge + bottom-right timestamp escape one layer outward to <parent-identity-strip> (§17.30 playbook)", () => {
    const cssText = (
      WorkflowNodeAsParent.styles as readonly { cssText?: string }[]
    )
      .map((s) => String(s.cssText ?? s))
      .join("\n");
    // First :host rule from tileLayoutStyles sets position: relative;
    // the per-view override flips it back to static. We assert the
    // string contains both rules (the cascade resolves to `static`
    // because the per-view rule is later in the concatenated styles
    // list) — defensive against a future refactor that drops the
    // override.
    expect(cssText).toMatch(/:host\s*\{[\s\S]*?position:\s*static/);
    // §17.117 — the parent-strip badge size must match the child
    // role's; pin the 1.15vh literal so a future tweak that scales
    // one role asymmetrically fails fast at test-time.
    expect(cssText).toMatch(/\.status-badge\s*\{[\s\S]*?font-size:\s*1\.15vh/);
  });

  it("dispatches INLINE_EDIT_TITLE_EVENT when the operator commits an edited title (Enter / blur with a trimmed non-empty change)", async () => {
    const el = await mountLitElement<WorkflowNodeAsParent>(
      "workflow-node-as-parent",
      (e) => { e.vm = vmWith(); },
    );
    const titleEl = el.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="title"]',
    );
    titleEl?.click();
    await el.updateComplete;
    const input = el.shadowRoot?.querySelector<HTMLInputElement>(
      'input[data-testid="title-edit"]',
    );
    expect(input).not.toBeNull();
    input!.value = "Renamed task";
    let received: InlineEditTitleDetail | null = null;
    el.addEventListener(INLINE_EDIT_TITLE_EVENT, (e) => {
      received = (e as CustomEvent<InlineEditTitleDetail>).detail;
    });
    input!.dispatchEvent(new FocusEvent("blur"));
    expect(received).toEqual({ nodeId: "wf1", title: "Renamed task" });
  });

  it("dispatches INLINE_EDIT_VALUE_EVENT when the operator commits an edited markdown body (mirror of TextNode's inline-edit-value path)", async () => {
    const el = await mountLitElement<WorkflowNodeAsParent>(
      "workflow-node-as-parent",
      (e) => { e.vm = vmWith(); },
    );
    const valueEl = el.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="value"]',
    );
    valueEl?.click();
    await el.updateComplete;
    const ta = el.shadowRoot?.querySelector<HTMLTextAreaElement>(
      'textarea[data-testid="value-edit"]',
    );
    expect(ta).not.toBeNull();
    ta!.value = "ready for review";
    let received: InlineEditValueDetail | null = null;
    el.addEventListener(INLINE_EDIT_VALUE_EVENT, (e) => {
      received = (e as CustomEvent<InlineEditValueDetail>).detail;
    });
    ta!.dispatchEvent(new FocusEvent("blur"));
    expect(received).toEqual({ nodeId: "wf1", value: "ready for review" });
  });
});
