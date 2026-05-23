import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/views/WorkflowNode/WorkflowNodeAsParent.js";
import { WorkflowNodeAsParent } from "../../../../../../adapters/ui/views/WorkflowNode/WorkflowNodeAsParent.js";
import {
  INLINE_EDIT_TITLE_EVENT,
  INLINE_EDIT_VALUE_EVENT,
  type InlineEditTitleDetail,
  type InlineEditValueDetail,
} from "../../../../../../adapters/ui/molecules/inlineEditEvents.js";
import type { WorkflowNodeViewModel } from "../../../../../../adapters/ui/views/NodeViewModel.js";
import { VALUE_NODE_DISABLED_CHANGE_EVENT, type ValueNodeDisabledChangeDetail } from "../../../../../../adapters/ui/molecules/disabledToggle.js";
import {
  WORKFLOW_STATUS_CHANGE_EVENT,
  type WorkflowStatusChangeDetail,
} from "../../../../../../adapters/ui/molecules/statusBadge.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

const DATE_ISO = "2026-04-23T18:25:43.511Z";

const STATUSES = [
  { id: "plan", label: "PLAN", color: "rgb(161, 161, 170)" },
  { id: "do", label: "DO", color: "rgb(59, 130, 246)" },
  { id: "check", label: "CHECK", color: "rgb(34, 197, 94)" },
  { id: "act", label: "ACT", color: "rgb(245, 158, 11)" },
] as const;

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
    availableStatuses: STATUSES,
    ...opts,
  } as WorkflowNodeViewModel;
}

describe("<workflow-node-as-parent> (§17.117 / §17.121f)", () => {
  it("\u00a717.121i \u2014 the disabled-switch lives at the LEFT of the title (not in the subtitle); subtitle keeps the status picker; click dispatches VALUE_NODE_DISABLED_CHANGE_EVENT", async () => {
    const el = await mountLitElement<WorkflowNodeAsParent>(
      "workflow-node-as-parent",
      (e) => { e.vm = vmWith({ id: "wf-7" }); },
    );
    const titleSwitch = el.shadowRoot
      ?.querySelector('[data-testid="title"]')
      ?.firstElementChild as HTMLButtonElement | null;
    expect(titleSwitch?.getAttribute("data-testid")).toBe("disabled-switch");
    expect(titleSwitch?.getAttribute("role")).toBe("switch");
    const subtitle = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="subtitle"]');
    expect(subtitle?.querySelector('[data-testid="status-badge-picker"]')).not.toBeNull();
    expect(subtitle?.querySelector('[data-testid="disabled-switch"]')).toBeNull();
    const received: ValueNodeDisabledChangeDetail[] = [];
    el.addEventListener(VALUE_NODE_DISABLED_CHANGE_EVENT, (ev) => {
      received.push((ev as CustomEvent<ValueNodeDisabledChangeDetail>).detail);
    });
    titleSwitch?.click();
    expect(received).toEqual([{ nodeId: "wf-7", disabled: true }]);
  });

  it("renders Title + markdown value + inline status picker with the parent-role data-view-kind hook (§17.121f swaps the static badge for an editable <select>)", async () => {
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
    // §17.121f — the AsParent role renders the editable picker, not
    // the static .status-badge <span>. The picker carries the
    // active status's id as data-status-id (mirror of the badge's
    // selector contract) so existing assertions can still read the
    // currently-pinned status without knowing about the picker shape.
    const picker = el.shadowRoot?.querySelector<HTMLSelectElement>(
      '[data-testid="status-badge-picker"]',
    );
    expect(picker).not.toBeNull();
    expect(picker?.getAttribute("data-status-id")).toBe("do");
    expect(picker?.value).toBe("do");
    expect(
      el.shadowRoot?.querySelector('[data-testid="status-badge"]'),
    ).toBeNull();
  });

  it("\u00a717.121f \u2014 the picker lists every available status from vm.availableStatuses (one <option> per entry) so the operator can swap to any board-defined status", async () => {
    const el = await mountLitElement<WorkflowNodeAsParent>(
      "workflow-node-as-parent",
      (e) => { e.vm = vmWith(); },
    );
    const picker = el.shadowRoot!.querySelector<HTMLSelectElement>(
      '[data-testid="status-badge-picker"]',
    );
    if (!picker) throw new Error("expected status-badge-picker");
    const ids = Array.from(picker.options).map((o) => o.value);
    expect(ids).toEqual(["plan", "do", "check", "act"]);
    const labels = Array.from(picker.options).map((o) => o.textContent?.trim());
    expect(labels).toEqual(["PLAN", "DO", "CHECK", "ACT"]);
  });

  it("\u00a717.121f \u2014 a change on the picker dispatches a bubbling, composed WORKFLOW_STATUS_CHANGE_EVENT with { nodeId, newStatusId }", async () => {
    const el = await mountLitElement<WorkflowNodeAsParent>(
      "workflow-node-as-parent",
      (e) => { e.vm = vmWith(); },
    );
    const received: WorkflowStatusChangeDetail[] = [];
    el.addEventListener(WORKFLOW_STATUS_CHANGE_EVENT, (ev) => {
      received.push((ev as CustomEvent<WorkflowStatusChangeDetail>).detail);
    });
    const picker = el.shadowRoot!.querySelector<HTMLSelectElement>(
      '[data-testid="status-badge-picker"]',
    );
    if (!picker) throw new Error("expected status-badge-picker");
    picker.value = "check";
    picker.dispatchEvent(new Event("change", { bubbles: true }));
    await el.updateComplete;
    expect(received).toEqual([{ nodeId: "wf1", newStatusId: "check" }]);
  });

  it("\u00a717.121f \u2014 missing availableStatuses (e.g. a board-less stub) collapses the picker to the read-only status badge \u2014 graceful degrade, never throws", async () => {
    const el = await mountLitElement<WorkflowNodeAsParent>(
      "workflow-node-as-parent",
      (e) => { e.vm = vmWith({ availableStatuses: [] }); },
    );
    expect(
      el.shadowRoot?.querySelector('[data-testid="status-badge-picker"]'),
    ).toBeNull();
    const badge = el.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="status-badge"]',
    );
    expect(badge?.textContent?.trim()).toBe("DO");
    expect(badge?.getAttribute("data-status-id")).toBe("do");
  });

  it(":host { position: static } so the bottom-right timestamp escapes one layer outward to <parent-identity-strip> (§17.30 playbook); badge font-size matches the AsChild role (§17.121e)", () => {
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
    // override. SPEC §17.121e — the override stays in place for the
    // timestamp's outer-corner escape but the badge no longer
    // depends on it (the badge now lives inside the in-flow
    // `.subtitle` slot directly under the title).
    expect(cssText).toMatch(/:host\s*\{[\s\S]*?position:\s*static/);
    // §17.117 — the parent-strip badge size must match the child
    // role's; pin the 1.15vh literal so a future tweak that scales
    // one role asymmetrically fails fast at test-time.
    expect(cssText).toMatch(/\.status-badge\s*\{[\s\S]*?font-size:\s*1\.15vh/);
    // §17.121e — both roles opt into the same `2vh` subtitle slot
    // so the badge sits at the same vertical position relative to
    // the title across AsChild + AsParent.
    expect(cssText).toMatch(/--subtitle-row-height:\s*2vh/);
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
