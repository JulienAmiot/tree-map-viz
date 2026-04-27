/**
 * `<tree-graph-screen>` — Lit shell custom element.
 *
 * Phase 5 stub: renders the focused node's title and its direct children's
 * titles so Playwright has something stable to assert. The real squarified
 * treemap, the parent identity strip, the drawer/breadcrumb, and the modal
 * land in Phases 6–10.
 *
 * The element is purely view: it accepts a plain VM through the `view`
 * property and never reaches into domain types. `main.ts` is the only
 * caller that knows about `TreeNode`, `TreeNavigationService`, etc.
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * Plain-data view model for the shell. Domain types stay in `main.ts`; this
 * element only sees strings and ids so nothing in the UI layer leaks
 * `TreeNode` into a Lit reactive update.
 */
export type FocusedTreeViewModel = {
  readonly focusedId: string;
  readonly focusedTitle: string;
  readonly children: readonly { readonly id: string; readonly title: string }[];
};

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
    .focused-title {
      margin: 0 0 0.75rem 0;
      font-weight: 700;
      font-size: clamp(1.4rem, 2.4vw, 2.1rem);
    }
    .children {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .child {
      padding: 0.5rem 0.9rem;
      border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
      border-radius: 6px;
      background: color-mix(in srgb, currentColor 6%, transparent);
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
    return html`
      <h1 class="focused-title" data-testid="focused-title" data-focused-id=${this.view.focusedId}>
        ${this.view.focusedTitle}
      </h1>
      <div class="children" data-testid="children">
        ${this.view.children.map(
          (c) => html`<div class="child" data-testid="child" data-id=${c.id}>${c.title}</div>`,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tree-graph-screen": TreeGraphScreen;
  }
}
