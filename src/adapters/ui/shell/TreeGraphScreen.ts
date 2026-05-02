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
 * Phase 9 (animations) addition, rewritten in §17.32:
 *   - `tile-drill` events from `<children-grid>` bubble out unmolested. The
 *     composition root listens for them on the screen, then calls
 *     `screen.runDrillAnimation(nodeId, commit)`. The shell resolves the
 *     tapped tile (`[data-id="<nodeId>"]` inside the grid's shadow root)
 *     and the destination element (`<parent-identity-strip>`) and hands
 *     them to `runDrillTransition`, which performs a FLIP-style morph:
 *     the tapped tile translates + scales to the strip's bounding rect
 *     while every other child + the old strip fade out, with the title
 *     colour transitioning to `var(--board-fresh)` along the way. After
 *     the morph settles the helper invokes `commit` (the navigation
 *     swap), and the shell follows up with a brief opacity fade-in on
 *     the freshly-rendered children-grid so the new tiles "appear"
 *     rather than blink in. `prefers-reduced-motion: reduce` (or the
 *     testBridge `dismissAnimations` sentinel) short-circuits both the
 *     morph and the post-commit fade-in and commits synchronously, per
 *     SPEC §4 last bullet.
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
import "../modal/BoardSettingsModal.js";
import type {
  BoardSettingsModal,
  BoardSettingsTarget,
} from "../modal/BoardSettingsModal.js";
import "../modal/BoardsPanelModal.js";
import type {
  BoardsPanelModal,
  BoardsPanelTarget,
} from "../modal/BoardsPanelModal.js";
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

  /**
   * SPEC §17.31 — `<board-settings-modal>` open state. Driven by the
   * "Settings…" item on `<burger-menu>`; the composition root catches
   * `burger-menu-action { action: "settings" }` and calls
   * `openBoardSettingsModal(target)` here. Confirm / Delete events
   * bubble out of the screen for the composition root to consume.
   */
  @state()
  private boardSettingsModalOpen = false;

  /** Pre-edit snapshot supplied by the composition root. */
  @state()
  private boardSettingsTarget: BoardSettingsTarget | null = null;

  /** Inline error from a failed `BoardCollectionService.updateSettings` /
   * `deleteBoard`. The composition root sets it via
   * `setBoardSettingsError(reason)` so the modal stays open for retry. */
  @property({ attribute: false })
  boardSettingsError: string | null = null;

  /**
   * SPEC §17.34 — `<boards-panel-modal>` open state. Driven by the
   * "Boards…" item on `<burger-menu>`; the composition root catches
   * `burger-menu-action { action: "boards" }` and calls
   * `openBoardsPanelModal(target)` here. Switch / Create events
   * bubble out of the screen for the composition root to consume.
   */
  @state()
  private boardsPanelModalOpen = false;

  /** Snapshot supplied by the composition root (collection list + current id). */
  @state()
  private boardsPanelTarget: BoardsPanelTarget | null = null;

  /** Inline error from a failed `BoardCollectionService.switchTo` /
   * `createBoard`. The composition root sets it via
   * `setBoardsPanelError(reason)` so the modal stays open for retry. */
  @property({ attribute: false })
  boardsPanelError: string | null = null;

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
      /* SPEC §17.36 — shared panel aesthetic for the parent-identity-strip
         and every child tile. Defined once here so both elements (each in
         its own shadow root) read from the same source of truth, the
         drill-into FLIP morph can write the strip's destination values
         on the tapped tile, and a future tweak is a one-place edit.
           - tile-bg   (~7 %) is the children's background tint;
           - strip-bg  (~12 %) is the focused panel's slightly stronger
             tint — same border, distinct fill so the eye reads the
             parent panel as the focused surface and the drill morph
             has a visible bg delta to bridge as the tile flies up.
           - border-color / border-radius are identical on both surfaces
             so the parent strip's frame matches the child tile's
             frame ("same border look") at every viewport size.
         The values are CSS custom properties — they cascade through
         shadow boundaries, so consumers pick them up via var() with
         a redundant color-mix fallback for standalone rendering
         (e.g. unit tests that mount a strip outside the shell). */
      --panel-tile-bg: color-mix(in srgb, currentColor 7%, transparent);
      --panel-strip-bg: color-mix(in srgb, currentColor 12%, transparent);
      --panel-border-color: color-mix(in srgb, currentColor 28%, transparent);
      --panel-border-radius: 8px;
    }
    .layout {
      display: grid;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      /* §4: parent strip ≈ 22 % (mid of 20–25 %), children grid ≈ 78 %. */
      grid-template-rows: 22fr 78fr;
      /* SPEC §17.36 — small breathing room around and between the strip
         and the grid so the strip's rounded corners (and the grid's
         outer tile gutters) read as a panel rather than two flush
         bands. Matches the 4 px inter-tile gutter (TILE_PADDING_PX
         in ChildrenGrid.ts) for visual rhythm. */
      padding: 4px;
      gap: 4px;
    }
    /* §17.32 — drill-into transition. The previous (§17.20) "zoom the
       whole layout" effect was replaced by a FLIP-style morph driven
       from runDrillTransition: the tapped tile translates + scales
       to the parent-identity-strip's geometry while siblings fade
       out. The grid needs position:relative so the morphed tile's
       z-index 10 actually layers above its siblings; the strip
       above it inherits the same coordinate space (the layout
       wrapper is the FLIP origin). All transforms / opacities are
       written by JS as inline styles; no keyframes live here
       anymore. */
    parent-identity-strip {
      min-height: 0;
      min-width: 0;
    }
    children-grid {
      min-height: 0;
      min-width: 0;
      position: relative;
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
      <board-settings-modal
        ?open=${this.boardSettingsModalOpen}
        .target=${this.boardSettingsTarget}
        .errorMessage=${this.boardSettingsError}
        @board-settings-cancel=${this.handleBoardSettingsModalClose}
      ></board-settings-modal>
      <boards-panel-modal
        ?open=${this.boardsPanelModalOpen}
        .target=${this.boardsPanelTarget}
        .errorMessage=${this.boardsPanelError}
        @boards-panel-cancel=${this.handleBoardsPanelModalClose}
      ></boards-panel-modal>
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

  private handleBoardSettingsModalClose = (): void => {
    this.boardSettingsModalOpen = false;
    this.boardSettingsError = null;
  };

  private handleBoardsPanelModalClose = (): void => {
    this.boardsPanelModalOpen = false;
    this.boardsPanelError = null;
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

  /**
   * SPEC §17.31 — open the board-settings modal with a pre-filled
   * snapshot. Called by the composition root in response to
   * `burger-menu-action { action: "settings" }`; the snapshot is
   * built from `BoardCollectionService.getCurrentBoard()` plus the
   * collection size (`canDelete = list().length > 1`).
   */
  openBoardSettingsModal(target: BoardSettingsTarget): void {
    this.boardSettingsTarget = target;
    this.boardSettingsModalOpen = true;
    this.boardSettingsError = null;
  }

  /** Called after a successful `updateSettings` / `deleteBoard` to
   * dismiss the modal. */
  closeBoardSettingsModal(): void {
    this.boardSettingsModalOpen = false;
    this.boardSettingsError = null;
  }

  /** Called after a failed `updateSettings` / `deleteBoard` to surface
   * the reason inline while keeping the modal open. */
  setBoardSettingsError(message: string): void {
    this.boardSettingsError = message;
  }

  /**
   * SPEC §17.34 — open the boards-panel modal with the collection
   * snapshot pre-filled. Called by the composition root in response
   * to `burger-menu-action { action: "boards" }`; the snapshot is
   * built from `BoardCollectionService.list()` (id + name only) +
   * `getCurrentBoardId()`.
   */
  openBoardsPanelModal(target: BoardsPanelTarget): void {
    this.boardsPanelTarget = target;
    this.boardsPanelModalOpen = true;
    this.boardsPanelError = null;
  }

  /** Called after a successful `switchTo` / `createBoard` to dismiss
   * the modal. */
  closeBoardsPanelModal(): void {
    this.boardsPanelModalOpen = false;
    this.boardsPanelError = null;
  }

  /** Called after a failed `switchTo` / `createBoard` to surface the
   * reason inline while keeping the modal open for retry. */
  setBoardsPanelError(message: string): void {
    this.boardsPanelError = message;
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

  /** Read-only accessor used by tests + composition root for the
   * §17.31 board-settings modal state. */
  get isBoardSettingsModalOpen(): boolean {
    return this.boardSettingsModalOpen;
  }

  /** Read-only accessor used by tests + composition root for the
   * §17.34 boards-panel modal state. */
  get isBoardsPanelModalOpen(): boolean {
    return this.boardsPanelModalOpen;
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

  /** Direct accessor to the §17.31 board-settings modal element. */
  get boardSettingsModalElement(): BoardSettingsModal | null {
    return (
      this.shadowRoot?.querySelector<BoardSettingsModal>(
        "board-settings-modal",
      ) ?? null
    );
  }

  /** Direct accessor to the §17.34 boards-panel modal element. */
  get boardsPanelModalElement(): BoardsPanelModal | null {
    return (
      this.shadowRoot?.querySelector<BoardsPanelModal>(
        "boards-panel-modal",
      ) ?? null
    );
  }

  /**
   * SPEC §4 / §17.32 — drill into a child. The composition root catches
   * `tile-drill` on the screen and calls this method with the tapped
   * `nodeId` plus a commit closure that runs
   * `nav.focusByUuid` + `router.push` + `refresh`.
   *
   * The shell is the only place that knows where the tapped tile, the
   * parent-identity-strip, and the sibling tiles live in the shadow
   * tree. The pure helper `runDrillTransition` does the FLIP geometry +
   * `prefers-reduced-motion` detection so unit tests for both the shell
   * and the helper can stay independent.
   *
   * If the layout wrapper isn't rendered yet (`view === null`) or the
   * tapped tile cannot be located, commit fires immediately — there's
   * no pending visual state to animate.
   */
  runDrillAnimation(nodeId: string, commit: () => void): void {
    const root = this.shadowRoot;
    const layout = root?.querySelector<HTMLElement>('[data-testid="layout"]');
    if (!layout) {
      commit();
      return;
    }

    const grid = root?.querySelector("children-grid");
    const strip = root?.querySelector<HTMLElement>("parent-identity-strip");
    // The tile lives one shadow boundary deeper, inside <children-grid>'s
    // own shadow root. We query through `.shadowRoot` deliberately rather
    // than via a slot/light DOM lookup so the grid can keep encapsulation.
    const tile = grid?.shadowRoot?.querySelector<HTMLElement>(
      `[data-id="${cssEscape(nodeId)}"]`,
    );

    if (!tile || !strip) {
      // Either the tile isn't rendered (race with a refresh) or the
      // strip isn't on screen yet. Commit synchronously — the navigation
      // is more important than the polish.
      commit();
      return;
    }

    // Collect every other tile in the grid (real children + the plus
    // tile) so the helper can fade them out while the tapped tile
    // morphs. Using `[data-testid="child"]` plus the plus-tile slot
    // marker so we don't pick up internals of `<node-view>`.
    const fadeOut: HTMLElement[] = [];
    const otherTiles =
      grid?.shadowRoot?.querySelectorAll<HTMLElement>(
        '[data-testid="child"], [data-slot="plus"]',
      ) ?? [];
    for (const el of Array.from(otherTiles)) {
      if (el !== tile) fadeOut.push(el);
    }
    // Fade the old parent strip out too — the morphed tile is about to
    // overlay it and become the new strip after commit; without fading
    // the old strip the user briefly sees two stacked headers.
    fadeOut.push(strip);

    // §17.32 — `<children-grid>` carries `:host { overflow: hidden }` to
    // keep the squarify layout from spilling out during resize jank.
    // The drill morph translates the tapped tile UP into the parent-
    // strip's territory (often by hundreds of pixels), which would
    // otherwise be clipped at the grid host's top edge — leaving "an
    // empty strip" while the morph is in flight (the user-visible bug
    // §17.32 first shipped with). We open up the grid's overflow for
    // the duration of the drill and restore it on commit. Inline
    // style override keeps the static `:host` rule untouched for
    // every other code path.
    const gridHost = grid as HTMLElement | null;
    const prevGridOverflow = gridHost?.style.overflow ?? "";
    if (gridHost) gridHost.style.overflow = "visible";

    // §17.32 follow-up — Lit doesn't recreate the
    // `<parent-identity-strip>` element on focus change (it just
    // updates its `vm` property), so any inline styles we write to
    // the strip during the drill (opacity: 0 + transition) would
    // leak into the post-commit render and leave the *new* parent
    // pane invisible. Snapshot the strip's inline `opacity` and
    // `transition` here so the commit closure can snap them back to
    // their pre-drill values the moment Lit has re-rendered the
    // strip with the new vm. Same idea for the grid host's
    // `overflow` above; the two restorations are sibling concerns.
    const prevStripOpacity = strip.style.opacity;
    const prevStripTransition = strip.style.transition;

    runDrillTransition({
      tile,
      target: strip,
      fadeOut,
      commit: () => {
        try {
          commit();
        } finally {
          // Restore the grid's overflow before the post-commit fade-
          // in runs. The grid HOST element survives the post-commit
          // re-render (Lit doesn't recreate custom-element children
          // when their template position is stable), so the inline
          // style would otherwise leak into the next render.
          if (gridHost) gridHost.style.overflow = prevGridOverflow;
          // Snap the strip back to its pre-drill inline state so the
          // freshly-rendered parent pane is visible immediately. We
          // restore `transition` first so the `opacity` write that
          // follows snaps instead of animating from 0 → 1; the
          // post-commit experience is intentionally instant on the
          // strip side, with the children grid owning the only
          // post-commit fade.
          strip.style.transition = prevStripTransition;
          strip.style.opacity = prevStripOpacity;
          this.fadeInChildrenGridAfterCommit();
        }
      },
    });
  }

  /**
   * SPEC §17.32 — after the post-commit re-render the children grid
   * holds an entirely new set of tiles (the children of the just-
   * focused node). Fading the host's opacity from 0 → 1 over a short
   * window makes the new tiles "appear" gracefully instead of
   * blinking in at full opacity. The fade is intentionally shorter
   * than the morph (≈ half the settle window) so the perceived
   * sequence is "tile flies up → new children appear" rather than
   * one continuous slow transition.
   *
   * The opacity transition is set as an inline style and cleaned up
   * after the animation completes; we cannot hang it on the host's
   * `static styles` because the pre-commit grid (still rendered
   * during the morph) must keep its full opacity.
   */
  private fadeInChildrenGridAfterCommit(): void {
    // Schedule on a microtask so Lit has a chance to flush the post-
    // commit render before we read back the new grid.
    void this.updateComplete.then(() => {
      const grid = this.shadowRoot?.querySelector<HTMLElement>(
        "children-grid",
      );
      if (!grid) return;
      grid.style.opacity = "0";
      grid.style.transition = `opacity ${DRILL_FADEIN_MS}ms ease`;
      // Force a reflow so the 0 → 1 transition actually runs (without
      // this both writes are coalesced and the grid jumps straight
      // to opacity 1).
      void grid.offsetWidth;
      grid.style.opacity = "1";
      window.setTimeout(() => {
        grid.style.opacity = "";
        grid.style.transition = "";
      }, DRILL_FADEIN_MS + 20);
    });
  }

  /** Re-export the drill class so tests can pin the contract symbolically. */
  static readonly DRILL_CLASS = DRILL_CLASS;
}

/**
 * Post-commit fade-in window for the new children-grid. Kept small
 * (half the morph) so the staircase "fly → appear" reads as two
 * distinct steps; tuning lives here rather than in the helper because
 * only the shell knows about the post-commit render.
 */
const DRILL_FADEIN_MS = 160;

/**
 * CSS.escape polyfill / identity wrapper. Node IDs are already UUIDs
 * (no special CSS chars), but escaping defensively keeps the selector
 * safe if a future fixture ships an id with a `:` or a `.` and avoids
 * silent zero-result `querySelector` calls.
 */
function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}

declare global {
  interface HTMLElementTagNameMap {
    "tree-graph-screen": TreeGraphScreen;
  }
}
