/**
 * `<tree-graph-screen>` — Lit shell custom element (SPEC §5, §17).
 *
 * Phase 6 body: parent identity strip (large `<node-view>` rendering the
 * focused node) on top + flat children grid below, where each child is a
 * `<node-view view-role="asChild">` and a trailing `<plus-tile>` is
 * appended iff the focused parent has capacity (§4). The squarified
 * treemap layout, breadcrumb, and drawer arrive in Phase 7+.
 *
 * The element is purely view: it accepts a plain `FocusedTreeViewModel`
 * through the `view` property and never reaches into domain types.
 * `main.ts` is the only caller that knows about `TreeNode`,
 * `TreeNavigationService`, etc.
 *
 * Importing `../views/index.js` is a side-effect import that registers
 * each per-kind view + freezes `nodeViewRegistry`. Rendering relies on
 * the registry being populated; the shell does not register entries
 * itself (kept decoupled from concrete kinds).
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../views/index.js";
import type { FocusedTreeViewModel } from "../views/NodeViewModel.js";

@customElement("tree-graph-screen")
export class TreeGraphScreen extends LitElement {
  @property({ attribute: false })
  view: FocusedTreeViewModel | null = null;

  static styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      height: 100%;
      padding: clamp(0.75rem, 2vw, 1.5rem);
      color: var(--text, #e8ecf4);
      font: 1rem/1.4 system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .parent-strip {
      margin: 0 0 1rem 0;
      padding: 0 0 0.75rem 0;
      border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    }
    .children {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .child-tile {
      flex: 1 1 12rem;
      min-width: 8rem;
      padding: 0.25rem;
      border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
      border-radius: 6px;
      background: color-mix(in srgb, currentColor 6%, transparent);
      cursor: pointer;
    }
    .child-tile:hover,
    .child-tile:focus-within {
      background: color-mix(in srgb, currentColor 10%, transparent);
    }
    .plus-slot {
      flex: 0 1 8rem;
      min-width: 6rem;
    }
    .empty {
      color: color-mix(in srgb, currentColor 60%, transparent);
      font-style: italic;
    }
  `;

  render() {
    if (!this.view) {
      return html`<p class="empty" data-testid="loading">Loading…</p>`;
    }
    const { center, children } = this.view;
    return html`
      <header
        class="parent-strip"
        data-testid="parent-strip"
        data-focused-id=${center.id}
      >
        <node-view view-role="asParent" .vm=${center}></node-view>
      </header>
      <section class="children" data-testid="children">
        ${children.map((slot) => {
          if (slot.slot === "plus") {
            return html`<div class="plus-slot">
              <plus-tile parent-id=${slot.parentId} .parentId=${slot.parentId}></plus-tile>
            </div>`;
          }
          return html`<div
            class="child-tile"
            data-testid="child"
            data-id=${slot.vm.id}
            data-view-kind=${slot.vm.kind}
          >
            <node-view view-role="asChild" .vm=${slot.vm}></node-view>
          </div>`;
        })}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tree-graph-screen": TreeGraphScreen;
  }
}
