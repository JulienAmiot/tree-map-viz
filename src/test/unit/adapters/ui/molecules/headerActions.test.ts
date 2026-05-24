import { LitElement, html, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { afterEach, describe, expect, it } from "vitest";

import {
  EDIT_NODE_OPEN_EVENT,
  FOCUS_CLOSE_TO_PARENT_EVENT,
  type EditNodeOpenDetail,
  type FocusCloseToParentDetail,
  headerActionsStyles,
  renderHeaderActions,
} from "../../../../../adapters/ui/molecules/headerActions.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

/**
 * SPEC §17.136 S13a -- the shared header-actions helper owns the
 * close-X + edit-pencil button DOM + event-dispatch contract that
 * `<parent-identity-strip>` used to carry directly. This test file
 * pins that contract; the strip's own test file pins the back-compat
 * re-exports + the absence of the buttons in the strip's shadow root.
 *
 * A tiny `<test-header-actions-host>` LitElement is defined locally
 * so the helper can be exercised against a real reactive host
 * (the helper's `host.dispatchEvent` call needs an EventTarget that
 * supports composed event bubbling).
 */

@customElement("test-header-actions-host")
class TestHeaderActionsHost extends LitElement {
  static styles = headerActionsStyles;

  @property({ attribute: false })
  nodeId = "uuid-node";

  @property({ attribute: false })
  parentId = "uuid-parent";

  render(): TemplateResult {
    return html`${renderHeaderActions(this, {
      nodeId: this.nodeId,
      parentId: this.parentId,
    })}`;
  }
}

afterEach(cleanupLitFixtures);

describe("renderHeaderActions (§17.136 S13a)", () => {
  it("renders both buttons when parentId is non-empty", async () => {
    const el = await mountLitElement<TestHeaderActionsHost>(
      "test-header-actions-host",
    );
    const close = el.shadowRoot?.querySelector('[data-testid="close-to-parent"]');
    const edit = el.shadowRoot?.querySelector('[data-testid="edit-node"]');
    expect(close).not.toBeNull();
    expect(edit).not.toBeNull();
  });

  it("omits the close-X when parentId is the empty string (root focus -- nothing to close back to)", async () => {
    const el = await mountLitElement<TestHeaderActionsHost>(
      "test-header-actions-host",
      (e) => {
        e.parentId = "";
      },
    );
    expect(
      el.shadowRoot?.querySelector('[data-testid="close-to-parent"]'),
    ).toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="edit-node"]'),
    ).not.toBeNull();
  });

  it("clicking the edit-pencil dispatches `edit-node-open` carrying nodeId (bubbles + composed)", async () => {
    const el = await mountLitElement<TestHeaderActionsHost>(
      "test-header-actions-host",
      (e) => {
        e.nodeId = "uuid-target";
      },
    );
    const received: EditNodeOpenDetail[] = [];
    document.addEventListener(
      EDIT_NODE_OPEN_EVENT,
      (e) => received.push((e as CustomEvent<EditNodeOpenDetail>).detail),
      { once: true },
    );
    const btn = el.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-testid="edit-node"]',
    );
    btn?.click();
    expect(received).toEqual([{ nodeId: "uuid-target" }]);
  });

  it("clicking the close-X dispatches `focus-close-to-parent` carrying parentId (bubbles + composed)", async () => {
    const el = await mountLitElement<TestHeaderActionsHost>(
      "test-header-actions-host",
      (e) => {
        e.parentId = "uuid-back";
      },
    );
    const received: FocusCloseToParentDetail[] = [];
    document.addEventListener(
      FOCUS_CLOSE_TO_PARENT_EVENT,
      (e) =>
        received.push((e as CustomEvent<FocusCloseToParentDetail>).detail),
      { once: true },
    );
    const btn = el.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-testid="close-to-parent"]',
    );
    btn?.click();
    expect(received).toEqual([{ parentId: "uuid-back" }]);
  });

  it("mirrors `nodeId` to the edit button's `data-node-id` and `parentId` to the close button's `data-parent-id` (e2e selectors)", async () => {
    const el = await mountLitElement<TestHeaderActionsHost>(
      "test-header-actions-host",
      (e) => {
        e.nodeId = "uuid-a";
        e.parentId = "uuid-b";
      },
    );
    const edit = el.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-testid="edit-node"]',
    );
    const close = el.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-testid="close-to-parent"]',
    );
    expect(edit?.dataset["nodeId"]).toBe("uuid-a");
    expect(close?.dataset["parentId"]).toBe("uuid-b");
  });

  it("exposes the canonical event constants (string values matched in main.ts + TreeMapScreen)", () => {
    expect(EDIT_NODE_OPEN_EVENT).toBe("edit-node-open");
    expect(FOCUS_CLOSE_TO_PARENT_EVENT).toBe("focus-close-to-parent");
  });

  it("the styles payload defines circular `.header-action` buttons (mirrors the pre-strand close-X / edit-pencil clamp + radius)", () => {
    const css = String(
      (headerActionsStyles as { cssText?: string }).cssText ?? "",
    );
    expect(css).toMatch(/\.header-action\s*\{[\s\S]*?border-radius:\s*50%/);
    expect(css).toMatch(
      /\.header-action\s*\{[\s\S]*?width:\s*clamp\(1\.5rem,\s*3vh,\s*2\.25rem\)/,
    );
  });
});

declare global {
  interface HTMLElementTagNameMap {
    "test-header-actions-host": TestHeaderActionsHost;
  }
}
