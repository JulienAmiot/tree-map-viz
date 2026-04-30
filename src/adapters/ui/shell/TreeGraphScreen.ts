/**
 * `<tree-graph-screen>` — Lit shell custom element (SPEC §4 / §5 / §17).
 *
 * Phase 7 (DT-6) body:
 *   - **Layout half** (already shipped): a 2-row CSS grid composition of
 *     `<parent-identity-strip>` (≈ 22 % of the viewport, top in both
 *     orientations per §4 + locked option c1) bound to `view.center`, and
 *     `<children-grid>` (≈ 78 %) bound to `view.children`, which itself
 *     drives the squarified treemap layout via its internal
 *     `TreemapController`.
 *   - **Shell-chrome half** (this slice): an absolutely-positioned
 *     `<app-drawer>` overlays the top of the host. The drawer's body
 *     contains the **board name** + `<focus-breadcrumb>` + `<burger-menu>`
 *     (SPEC §4: drawer holds board name, breadcrumb of focus path, burger
 *     menu — Import / Export / Boards / future admin).
 *
 * The shell is purely view: it accepts plain view models through the
 * `view`, `boardName`, and `breadcrumbPath` properties and never reaches
 * into domain types. `main.ts` is the only caller that knows about
 * `TreeNode`, `TreeNavigationService`, `BoardCollectionService`, etc.
 *
 * Events bubble up unchanged:
 *   - `breadcrumb-navigate` `{ nodeId }` — composition root pushes the
 *     hash route + flips focus (SPEC §11.3).
 *   - `burger-menu-action` `{ action }` — composition root dispatches to
 *     the relevant service (Import / Export / Boards) — wiring lands in
 *     Phase 10 (Persistence + Routing) per SPEC §15.4 + §17.3.
 *   - `drawer-toggle` `{ open }` — currently informational; future
 *     persistence can opt in.
 *
 * Orientation:
 *   - An `OrientationController` observes the host's content rect and
 *     reports `'landscape' | 'portrait'`. The shell reflects the current
 *     orientation onto the layout wrapper as `data-orientation` so CSS /
 *     e2e can branch on it (SPEC §4 — aspect 16/9 ↔ 9/16 reflows on
 *     rotation).
 *
 * Side-effect imports for the inner custom elements are mandatory (SPEC
 * §17.9 pitfall): without them, esbuild tree-shakes the modules and the
 * `@customElement` decorators never register the tags, so
 * `document.createElement(...)` returns a plain `HTMLElement` without
 * `updateComplete`.
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { OrientationController } from "../controllers/OrientationController.js";
import "../views/index.js";
import type { FocusedTreeViewModel } from "../views/NodeViewModel.js";
import type { BreadcrumbSegment } from "./Breadcrumb.js";
import "./Breadcrumb.js";
import "./BurgerMenu.js";
import "./ChildrenGrid.js";
import "./Drawer.js";
import "./ParentIdentityStrip.js";

@customElement("tree-graph-screen")
export class TreeGraphScreen extends LitElement {
  @property({ attribute: false })
  view: FocusedTreeViewModel | null = null;

  /** Board name shown at the leading edge of the drawer (SPEC §4). */
  @property({ type: String })
  boardName = "";

  /** Path from root to the focused node, used by `<focus-breadcrumb>`. */
  @property({ attribute: false })
  breadcrumbPath: readonly BreadcrumbSegment[] = [];

  readonly orientation = new OrientationController(this);

  static styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      position: relative;
      color: var(--text, #e8ecf4);
      font: 1rem/1.4 system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial,
        sans-serif;
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
    .drawer-content {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.6rem 1rem;
      box-sizing: border-box;
    }
    .board-name {
      flex: 0 0 auto;
      font-weight: 600;
      max-width: 14rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    focus-breadcrumb {
      flex: 1 1 auto;
      min-width: 0;
    }
    burger-menu {
      flex: 0 0 auto;
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
    const drawer = html`
      <app-drawer data-testid="drawer">
        <div class="drawer-content">
          <span class="board-name" data-testid="board-name">${this.boardName}</span>
          <focus-breadcrumb .path=${this.breadcrumbPath}></focus-breadcrumb>
          <burger-menu></burger-menu>
        </div>
      </app-drawer>
    `;

    if (!this.view) {
      return html`
        ${drawer}
        <p class="empty" data-testid="loading">Loading…</p>
      `;
    }
    const { center, children } = this.view;
    return html`
      ${drawer}
      <div
        class="layout"
        data-testid="layout"
        data-orientation=${this.orientation.orientation}
      >
        <parent-identity-strip .vm=${center}></parent-identity-strip>
        <children-grid .slots=${children}></children-grid>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tree-graph-screen": TreeGraphScreen;
  }
}
