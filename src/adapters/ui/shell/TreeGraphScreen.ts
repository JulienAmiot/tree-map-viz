/**
 * `<tree-graph-screen>` — Lit shell custom element (SPEC §4 / §5 / §17).
 *
 * Phase 7 (DT-6 — layout half) body: a 2-row CSS grid composition of
 *   - `<parent-identity-strip>` (20–25 % of the viewport, top in both
 *     orientations per §4 + locked option c1) bound to `view.center`,
 *   - `<children-grid>` (the remaining 75–80 %) bound to `view.children`,
 *     which itself drives the squarified treemap layout via its internal
 *     `TreemapController`.
 *
 * The shell is purely view: it accepts a plain `FocusedTreeViewModel`
 * through the `view` property and never reaches into domain types.
 * `main.ts` is the only caller that knows about `TreeNode`,
 * `TreeNavigationService`, etc.
 *
 * Orientation:
 *   - An `OrientationController` observes the host's content rect and
 *     reports `'landscape' | 'portrait'`. The shell reflects the current
 *     orientation onto the wrapper as `data-orientation` so CSS / e2e
 *     can branch on it (SPEC §4 — aspect 16/9 ↔ 9/16 reflows on rotation).
 *   - Per §4, the parent strip stays at the top in both orientations; the
 *     `data-orientation` attribute is exposed for future style tweaks
 *     (typography, breadcrumb truncation, etc.) and as the e2e seam for
 *     `layout/orientation_reflow.feature`.
 *
 * Side-effect imports for `<parent-identity-strip>` and `<children-grid>`
 * are mandatory (SPEC §17.9 pitfall): without them, esbuild tree-shakes
 * the modules and the `@customElement` decorators never register the
 * tags, so `document.createElement(...)` returns a plain `HTMLElement`
 * without `updateComplete`.
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { OrientationController } from "../controllers/OrientationController.js";
import "../views/index.js";
import type { FocusedTreeViewModel } from "../views/NodeViewModel.js";
import "./ChildrenGrid.js";
import "./ParentIdentityStrip.js";

@customElement("tree-graph-screen")
export class TreeGraphScreen extends LitElement {
  @property({ attribute: false })
  view: FocusedTreeViewModel | null = null;

  readonly orientation = new OrientationController(this);

  static styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      color: var(--text, #e8ecf4);
      font: 1rem/1.4 system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .layout {
      display: grid;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      /* §4: parent strip ≈ 22 % (mid of 20–25 %), children grid ≈ 78 %. */
      grid-template-rows: 22fr 78fr;
    }
    parent-identity-strip {
      min-height: 0;
      min-width: 0;
    }
    children-grid {
      min-height: 0;
      min-width: 0;
    }
    .empty {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      color: color-mix(in srgb, currentColor 60%, transparent);
      font-style: italic;
    }
  `;

  render() {
    if (!this.view) {
      return html`<p class="empty" data-testid="loading">Loading…</p>`;
    }
    const { center, children } = this.view;
    return html`<div
      class="layout"
      data-testid="layout"
      data-orientation=${this.orientation.orientation}
    >
      <parent-identity-strip .vm=${center}></parent-identity-strip>
      <children-grid .slots=${children}></children-grid>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tree-graph-screen": TreeGraphScreen;
  }
}
