/**
 * `<tree-graph-screen>` — Lit shell custom element (SPEC §4 / §5 / §7 / §17).
 *
 * Phase 7 (DT-6) body:
 *   - **Layout half** (already shipped): a 2-row CSS grid composition of
 *     `<parent-identity-strip>` (≈ 22 % of the viewport, top in both
 *     orientations per §4 + locked option c1) bound to `view.center`, and
 *     `<children-grid>` (≈ 78 %) bound to `view.children`, which itself
 *     drives the squarified treemap layout via its internal
 *     `TreemapController`.
 *   - **Shell-chrome half** (already shipped): an absolutely-positioned
 *     `<app-drawer>` overlays the top of the host. The drawer's body
 *     contains the **board name** + `<focus-breadcrumb>` + `<burger-menu>`
 *     (SPEC §4: drawer holds board name, breadcrumb of focus path, burger
 *     menu — Import / Export / Boards / future admin).
 *
 * Phase 8 (DT-7) addition:
 *   - `<add-child-modal>` is rendered as a sibling overlay (`z-index: 200`)
 *     inside the shell. The shell owns its open state because the trigger
 *     (`plus-tile-activate` from `<plus-tile>`) is a local UI event
 *     captured by the layout wrapper. The composition root listens to
 *     `add-child-confirm` on the screen and calls `AddChildService`; on
 *     success it calls `screen.closeAddChildModal()`, on failure it calls
 *     `screen.setAddChildError(reason)` so the modal renders an inline
 *     error and stays open (SPEC §7 — never persists on failure).
 *
 * Phase 9 (animations) addition:
 *   - `tile-drill` events from `<children-grid>` bubble out unmolested. The
 *     composition root listens for them on the screen, then calls
 *     `screen.runDrillAnimation(commit)` to flip `encap--drill` on the
 *     `.layout` wrapper, and the helper schedules the navigation `commit`
 *     after the CSS transition has settled. `prefers-reduced-motion: reduce`
 *     (or the testBridge `dismissAnimations` sentinel) short-circuits the
 *     class flip and commits synchronously, per SPEC §4 last bullet.
 *
 * §17.23 polish (close-to-parent):
 *   - The shell derives the focused node's `parentId` from `breadcrumbPath`
 *     (the second-to-last segment) and threads it into
 *     `<parent-identity-strip>`. The strip uses that to conditionally
 *     render a top-right "X" button which dispatches
 *     `focus-close-to-parent { parentId }`. The composition root binds
 *     that event to the same triple the breadcrumb uses; the shell stays
 *     a pure pass-through.
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
import { customElement, property, state } from "lit/decorators.js";

import {
  DRILL_CLASS,
  runDrillTransition,
} from "../animations/drillTransitions.js";
import { OrientationController } from "../controllers/OrientationController.js";
import "../modal/AddChildModal.js";
import type { AddChildModal } from "../modal/AddChildModal.js";
import "../modal/EditNodeModal.js";
import type {
  EditNodeModal,
  EditNodeTarget,
} from "../modal/EditNodeModal.js";
import type { PlusTileActivateDetail } from "../views/plus/PlusTile.js";
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

  /** Whether the add-child modal (SPEC §7) is open. The shell owns this so the
   * `<plus-tile>` → `<add-child-modal>` interaction is local; the composition
   * root only sees the resulting `add-child-confirm` event. */
  @state()
  private modalOpen = false;

  /** Parent id propagated to the modal — picked up from `plus-tile-activate`. */
  @state()
  private modalParentId = "";

  /** Latest error from a failed `AddChildService.addChild` call. The composition
   * root sets this back via `setAddChildError(...)` after a failed confirm so the
   * modal can render an inline message (SPEC §7 — never persists on failure). */
  @property({ attribute: false })
  addChildError: string | null = null;

  /**
   * Whether `<edit-node-modal>` is open (SPEC §17.28). The shell owns
   * the open state so the trigger (`edit-node-open` from
   * `<parent-identity-strip>`) is captured locally; the composition
   * root populates `editTarget` via `openEditNodeModal(target)` and
   * sees the `edit-node-confirm` event bubble out of the screen.
   */
  @state()
  private editModalOpen = false;

  /** Pre-edit snapshot supplied by the composition root. */
  @state()
  private editTarget: EditNodeTarget | null = null;

  /** Inline error from a failed `EditNodeService.editFields(...)`. */
  @property({ attribute: false })
  editNodeError: string | null = null;

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
      /* §17.20 — drill-into transition target. transform-origin sits at the
         centre of the tile that was tapped; we don't have access to the
         tap coordinate from CSS, so we use the centre of the layout. The
         visual is a slight scale-up + opacity dip — enough to imply
         "the focus is pulling forward" without being kinetic. JS only
         flips the class (encap--drill) on the .layout wrapper; CSS owns
         the keyframes. */
      transform-origin: 50% 50%;
    }
    .layout.encap--drill {
      animation: encap-drill-in var(--encap-drill-ms, 250ms) ease-in;
      will-change: transform, opacity;
    }
    @keyframes encap-drill-in {
      from {
        transform: scale(1);
        opacity: 1;
      }
      to {
        transform: scale(1.04);
        opacity: 0.85;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .layout.encap--drill {
        animation: none;
      }
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

    const modal = html`
      <add-child-modal
        ?open=${this.modalOpen}
        .parentId=${this.modalParentId}
        .errorMessage=${this.addChildError}
        @add-child-cancel=${this.handleModalClose}
      ></add-child-modal>
      <edit-node-modal
        ?open=${this.editModalOpen}
        .editTarget=${this.editTarget}
        .errorMessage=${this.editNodeError}
        @edit-node-cancel=${this.handleEditModalClose}
      ></edit-node-modal>
    `;

    if (!this.view) {
      return html`
        ${drawer}
        <p class="empty" data-testid="loading">Loading…</p>
        ${modal}
      `;
    }
    const { center, children } = this.view;
    // §17.23 — the parent of the focused node is the second-to-last
    // breadcrumb segment (the last one being the focus itself). When the
    // path has < 2 segments the focus is at root → no parent → empty
    // string → strip omits the close-X button.
    const parentId =
      this.breadcrumbPath.length >= 2
        ? (this.breadcrumbPath[this.breadcrumbPath.length - 2]?.id ?? "")
        : "";
    return html`
      ${drawer}
      <div
        class="layout"
        data-testid="layout"
        data-orientation=${this.orientation.orientation}
        @plus-tile-activate=${this.handlePlusTileActivate}
      >
        <parent-identity-strip
          .vm=${center}
          parent-id=${parentId}
        ></parent-identity-strip>
        <children-grid .slots=${children}></children-grid>
      </div>
      ${modal}
    `;
  }

  private handlePlusTileActivate = (e: Event): void => {
    const detail = (e as CustomEvent<PlusTileActivateDetail>).detail;
    this.modalParentId = detail.parentId;
    this.modalOpen = true;
    this.addChildError = null;
  };

  private handleModalClose = (): void => {
    this.modalOpen = false;
    this.addChildError = null;
  };

  private handleEditModalClose = (): void => {
    this.editModalOpen = false;
    this.editNodeError = null;
  };

  /** Called by the composition root after a successful `addChild` so the
   * modal closes (preserving any other state the shell owns). Public so
   * `main.ts` can drive it without re-querying the modal element. */
  closeAddChildModal(): void {
    this.modalOpen = false;
    this.addChildError = null;
  }

  /** Called by the composition root after a failed `addChild` so the modal
   * stays open and renders the error inline. */
  setAddChildError(message: string): void {
    this.addChildError = message;
  }

  /**
   * SPEC §17.28 — open the edit-node modal with a pre-filled snapshot.
   * Called by the composition root in response to `edit-node-open`
   * (the strip's pencil button); the snapshot is built from the focused
   * domain node so the form opens populated with its current fields.
   */
  openEditNodeModal(target: EditNodeTarget): void {
    this.editTarget = target;
    this.editModalOpen = true;
    this.editNodeError = null;
  }

  /** Called by the composition root after a successful `editFields` to
   * dismiss the modal and clear the snapshot. */
  closeEditNodeModal(): void {
    this.editModalOpen = false;
    this.editNodeError = null;
  }

  /** Called after a failed `editFields` to surface the reason inline
   * while keeping the modal open for retry. */
  setEditNodeError(message: string): void {
    this.editNodeError = message;
  }

  /** Read-only accessor used by tests — keeps the `@state` private. */
  get isAddChildModalOpen(): boolean {
    return this.modalOpen;
  }

  /** Read-only accessor used by tests + composition root for the
   * §17.28 edit-node modal state. */
  get isEditNodeModalOpen(): boolean {
    return this.editModalOpen;
  }

  /** Direct accessor to the modal element, useful for the composition root
   * when it needs to inspect its current state. */
  get addChildModalElement(): AddChildModal | null {
    return (
      this.shadowRoot?.querySelector<AddChildModal>("add-child-modal") ?? null
    );
  }

  /** Direct accessor to the edit-node modal element. */
  get editNodeModalElement(): EditNodeModal | null {
    return (
      this.shadowRoot?.querySelector<EditNodeModal>("edit-node-modal") ?? null
    );
  }

  /**
   * SPEC §4 — drill into a child. The composition root catches `tile-drill`
   * on the screen and calls this method with a commit closure that runs
   * `nav.focusByUuid` + `router.push` + `refresh`.
   *
   * The shell is the only place that knows the `encap--drill` class lives
   * on `.layout`. The actual class-flipping + `prefers-reduced-motion`
   * detection lives in the pure helper `runDrillTransition` so unit tests
   * for both the shell and the helper can stay independent.
   *
   * If the layout wrapper isn't rendered yet (`view === null`), commit
   * fires immediately — there's no pending visual state to animate.
   */
  runDrillAnimation(commit: () => void): void {
    const layout = this.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="layout"]',
    );
    if (!layout) {
      commit();
      return;
    }
    runDrillTransition({ host: layout, commit });
  }

  /** Re-export the drill class so tests can pin the contract symbolically. */
  static readonly DRILL_CLASS = DRILL_CLASS;
}

declare global {
  interface HTMLElementTagNameMap {
    "tree-graph-screen": TreeGraphScreen;
  }
}
