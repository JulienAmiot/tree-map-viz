/**
 * `<edit-node-modal>` — the focused-panel **edit form** counterpart of
 * `<add-child-modal>` (SPEC §17.28).
 *
 * Reached from the focused-node strip's pencil button (left of the
 * close-X). Captures the payload for `EditNodeService.editFields(...)`,
 * which applies a partial update to the node in place and persists.
 *
 * Why a dedicated modal instead of a `mode: "add" | "edit"` flag on
 * `<add-child-modal>`:
 *   - The two flows have **different** payload shapes
 *     (`AddChildModalPayload` vs `EditNodeModalPayload`), different
 *     mandatory fields (a fresh BSC
 *     needs a current-value seed, an edited BSC keeps its history
 *     untouched), and different "what's locked" rules (the kind is
 *     mutable on add, locked on edit). Conditionalising one component
 *     to handle both would mean a forest of `mode === "edit"` branches
 *     and a payload union the modal would have to discriminate at
 *     dispatch time.
 *   - The form **fields themselves** still share the same field-by-field
 *     visual contract (placeholders, slider+number weight pair, layout)
 *     because the form-pane styles in `<add-child-modal>` are mirrored
 *     here verbatim. A future refactor could extract a shared
 *     `<node-form-fields>` element; today the duplication is local and
 *     contained, and lets each modal stay readable in isolation.
 *
 * Differences vs `<add-child-modal>`:
 *   1. **No left-rail kind list.** The kind is locked to whatever the
 *      composition root populates the modal with (read off the focused
 *      node). The header still shows the kind so the operator knows
 *      which form they're looking at.
 *   2. **No current-value / as-of fields.** The latest history value
 *      is edited inline on the focused panel; the modal stays scoped
 *      to "fields" — *minus* anything already editable inline. Keeping
 *      the two flows orthogonal prevents a modal-confirm from racing an
 *      inline-edit on the same node.
 *   3. **No title field** (SPEC §17.50). The title is editable inline
 *      from the focused-panel strip (tap the title → swap to input);
 *      the modal must NOT also expose it. Two reasons: (a) the modal
 *      duplicates an affordance the operator already has one tap away,
 *      adding no value; (b) two editors on the same field race each
 *      other if both are open (the modal would need to either disable
 *      its title field while the inline editor is active or arbitrate
 *      between the two on confirm — neither is worth the surface). The
 *      modal therefore covers ONLY fields with no inline equivalent:
 *      weight, description, unit, objective, the Picture / URL /
 *      Workflow per-kind fields. Title comes through this flow as
 *      `payload.title === undefined` and `EditNodeService.editFields`
 *      skips the field per its existing `payload.title !== undefined`
 *      guard.
 *   4. **All fields default to the current node's values.** Editing
 *      means "tweak what's there", so the form opens already filled
 *      in. The Confirm button is enabled iff the operator hasn't
 *      blanked a required field (BSC unit + BSC objective). For a
 *      `TextNode` only weight is editable through the modal, and the
 *      slider always has a value, so Confirm is always enabled.
 *
 * Surface contract:
 *   - `open` (boolean attribute, reflected) — modal visible.
 *   - `editTarget` (property) — the full pre-edit payload + the node id.
 *     Required when `open=true`; the modal initialises its form state
 *     from this on every open.
 *   - dispatches `edit-node-confirm`
 *     `CustomEvent<{ nodeId, payload: EditNodeModalPayload }>` on confirm.
 *   - dispatches `edit-node-cancel` `CustomEvent<void>` on Cancel /
 *     Escape / backdrop tap / close-X (SPEC §17.29 — every modal in
 *     the app carries a top-right close-X via `modalFrameStyles`).
 *
 * The composition root listens for `edit-node-confirm`, calls
 * `EditNodeService.editFields(...)`, and on success calls
 * `screen.closeEditNodeModal()` to re-paint the focused view with the
 * mutated node.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { ComputationKind } from "../../../../domain/computation/ComputationKind.js";
import type { WorkflowStatus } from "../../../../domain/values/WorkflowStatus.js";
import { DEFAULT_WORKFLOW_STATUSES } from "../../../../domain/values/WorkflowStatus.js";

import { COMPUTATION_KIND_LABELS } from "./AddChildModal.js";
import {
  modalFrameStyles,
  renderModalCloseX,
} from "../../atoms/modalFrameStyles.js";

export const EDIT_NODE_CONFIRM_EVENT = "edit-node-confirm";
export const EDIT_NODE_CANCEL_EVENT = "edit-node-cancel";

/**
 * Partial-edit payload the modal dispatches on confirm. v3 used to host
 * this type on `EditNodeService`; §17.112 v3 sweep moved it here so the
 * modal owns its own outbound contract and main.ts's translation shim
 * `toAppEditPayload` consumes it from the adapter side without crossing
 * back into a (now-deleted) v3 application service. Shape is the v3
 * 2-kind union verbatim (`TextNode` / `BusinessScoreCardNode`); main.ts
 * rewrites to the application's 5-kind `EditNodePayload` before handing
 * off to `EditNodeService`. Renamed `EditNodePayload` →
 * `EditNodeModalPayload` at §17.114-followup-payloads to free the
 * unsuffixed canonical name for the application-layer payload (mirrors
 * the parallel `AddChildModalPayload` rename in `AddChildModal.ts`).
 * The §17.28 contract still applies on the modal side: kind is required
 * and must match the target's existing kind; history is appended via
 * the inline value-edit seam, not through this payload.
 */
export type EditNodeModalPayload =
  | {
      readonly kind: "TextNode";
      readonly title?: string;
      readonly weight?: number;
      readonly disabled?: boolean;
    }
  | {
      readonly kind: "Workflow";
      readonly title?: string;
      readonly weight?: number;
      readonly disabled?: boolean;
      readonly statusId?: string;
    }
  | {
      readonly kind: "BusinessScoreCardNode";
      readonly title?: string;
      readonly description?: string;
      readonly weight?: number;
      readonly disabled?: boolean;
      readonly unit?: string;
      readonly objective?: {
        readonly initialValue: number;
        readonly targetValue: number;
        readonly targetDate: Date;
      };
    }
  /**
   * SPEC §17.119 — `PictureNode` variant. Only weight + image URL are
   * editable through this modal; title rides the inline-edit seam
   * (the focused-panel `<picture-node-as-parent>`'s click-to-edit
   * title) per the §17.50 contract that applies to every kind. The
   * `imageUrl` field is the picture-strand-specific edit — swapping
   * the image source is a structural change that doesn't belong on
   * an inline editor (the URL is typically pasted, not typed in
   * place). main.ts's `toAppEditPayload` rewrites the modal-side
   * `"PictureNode"` kind tag to the application-layer `"Picture"`.
   */
  | {
      readonly kind: "PictureNode";
      readonly title?: string;
      readonly weight?: number;
      readonly disabled?: boolean;
      readonly imageUrl?: string;
    }
  /**
   * SPEC §17.120 — `URLNode` variant. Only weight + URL are editable
   * through this modal; title rides the inline-edit seam (the
   * focused-panel `<url-node-as-parent>`'s click-to-edit title) per
   * the §17.50 contract that applies to every kind. The `url` field
   * is the URL-strand-specific edit — swapping the URL is a
   * structural change that re-runs QR generation on the next render
   * and doesn't belong on an inline editor (the URL is typically
   * pasted, not typed in place). main.ts's `toAppEditPayload`
   * rewrites the modal-side `"URLNode"` kind tag to the
   * application-layer `"URL"`. Mirrors the §17.119 PictureNode kind-
   * tag rewrite contract.
   */
  | {
      readonly kind: "URLNode";
      readonly title?: string;
      readonly weight?: number;
      readonly disabled?: boolean;
      readonly url?: string;
    }
  /**
   * SPEC §17.77 / §17.94 — `StrictRangeNode` variant. Range bounds
   * (`min` / `max`) are **structural**: the application service's
   * `StrictRange` edit shape is `CommonEdit` only (title + weight
   * + disabled + description), so the modal collects only
   * description + weight here. Title still rides the inline-edit
   * seam per §17.50; range bounds can only change by deleting the
   * node and re-adding it through `<add-child-modal>`. main.ts's
   * `toAppEditPayload` rewrites the modal-side `"StrictRangeNode"`
   * kind tag to the application-layer `"StrictRange"` (parity
   * with the BSC / Picture / URL kind-tag rewrites).
   */
  | {
      readonly kind: "StrictRangeNode";
      readonly title?: string;
      readonly description?: string;
      readonly weight?: number;
      readonly disabled?: boolean;
    }
  /**
   * SPEC §17.94 / §17.95 — `ComputedNode` variant. Description +
   * weight ride `CommonEdit`; the strategy dropdown emits the
   * canonical `ComputationKind.name` (resolved back to the
   * singleton in `main.ts#toAppEditPayload` via
   * `ComputationKind.fromName`). main.ts rewrites the modal-side
   * `"ComputedNode"` kind tag to the application-layer `"Computed"`.
   */
  | {
      readonly kind: "ComputedNode";
      readonly title?: string;
      readonly description?: string;
      readonly weight?: number;
      readonly disabled?: boolean;
      readonly computationKindName?: string;
    }
  /**
   * SPEC §17.94 / §17.95 — `ComputedBusinessScoreNode` variant.
   * Combines the BSC slots (`unit` + `objective`) with the Computed
   * strategy dropdown. The application service's edit shape is
   * `CommonEdit & BSEdit & ComputedEdit`, mirrored field-by-field
   * here. main.ts rewrites the modal-side `"ComputedBusinessScore
   * Node"` kind tag to the application-layer `"ComputedBusiness
   * Score"`.
   */
  | {
      readonly kind: "ComputedBusinessScoreNode";
      readonly title?: string;
      readonly description?: string;
      readonly weight?: number;
      readonly disabled?: boolean;
      readonly unit?: string;
      readonly objective?: {
        readonly initialValue: number;
        readonly targetValue: number;
        readonly targetDate: Date;
      };
      readonly computationKindName?: string;
    };

/** Pre-edit snapshot supplied by the composition root when opening the modal. */
export type EditNodeTarget =
  | {
      readonly nodeId: string;
      readonly kind: "TextNode";
      readonly title: string;
      readonly weight: number;
      readonly disabled?: boolean;
    }
  | {
      readonly nodeId: string;
      readonly kind: "Workflow";
      readonly title: string;
      readonly weight: number;
      readonly disabled?: boolean;
      readonly statusId: string;
    }
  | {
      readonly nodeId: string;
      readonly kind: "BusinessScoreCardNode";
      readonly title: string;
      readonly description: string;
      readonly weight: number;
      readonly disabled?: boolean;
      readonly unit: string;
      readonly objective: {
        readonly initialValue: number;
        readonly targetValue: number;
        /** ISO `YYYY-MM-DD` (UTC) — the form's date input wants this format. */
        readonly targetDateIso: string;
      };
    }
  | {
      readonly nodeId: string;
      readonly kind: "PictureNode";
      readonly title: string;
      readonly weight: number;
      readonly disabled?: boolean;
      readonly imageUrl: string;
    }
  | {
      readonly nodeId: string;
      readonly kind: "URLNode";
      readonly title: string;
      readonly weight: number;
      readonly disabled?: boolean;
      readonly url: string;
    }
  | {
      readonly nodeId: string;
      readonly kind: "StrictRangeNode";
      readonly title: string;
      readonly description: string;
      readonly weight: number;
      readonly disabled?: boolean;
      /**
       * Read-only `[min, max]` bounds rendered for context. Editable
       * via this modal is **not** supported (the application service's
       * `StrictRange` edit shape is `CommonEdit` only); the bounds
       * are surfaced so the operator sees the current contract while
       * editing description / weight.
       */
      readonly bounds: { readonly min: number; readonly max: number };
    }
  | {
      readonly nodeId: string;
      readonly kind: "ComputedNode";
      readonly title: string;
      readonly description: string;
      readonly weight: number;
      readonly disabled?: boolean;
      /** Canonical `ComputationKind.name` (e.g. `"SUM"`); pre-fills the dropdown. */
      readonly computationKindName: string;
    }
  | {
      readonly nodeId: string;
      readonly kind: "ComputedBusinessScoreNode";
      readonly title: string;
      readonly description: string;
      readonly weight: number;
      readonly disabled?: boolean;
      readonly unit: string;
      readonly objective: {
        readonly initialValue: number;
        readonly targetValue: number;
        readonly targetDateIso: string;
      };
      readonly computationKindName: string;
    };

export type EditNodeConfirmDetail = {
  readonly nodeId: string;
  readonly payload: EditNodeModalPayload;
};

const KIND_LABELS: Record<EditNodeTarget["kind"], string> = {
  TextNode: "Text",
  Workflow: "Workflow",
  BusinessScoreCardNode: "Business Score Card",
  PictureNode: "Picture",
  URLNode: "URL",
  StrictRangeNode: "Strict Range",
  ComputedNode: "Computed",
  ComputedBusinessScoreNode: "Computed Business Score Card",
};

@customElement("edit-node-modal")
export class EditNodeModal extends LitElement {
  /** Whether the modal is visible. Reflected so `:host([open])` works. */
  @property({ type: Boolean, reflect: true })
  open = false;

  /** Pre-edit snapshot. Required when `open=true`. */
  @property({ attribute: false })
  editTarget: EditNodeTarget | null = null;

  /** Free-form error rendered inline as `data-error` on the form. */
  @property({ attribute: false })
  errorMessage: string | null = null;

  /**
   * Catalogue of workflow statuses offered by the `Workflow` form
   * (SPEC §17.118), sourced from `Board.workflowStatuses`. The
   * composition root sets this whenever the active board changes so
   * the status dropdown always reflects the current board's table.
   *
   * Defaulted to {@link DEFAULT_WORKFLOW_STATUSES} so unit tests that
   * mount the modal in isolation still render a usable Workflow form
   * without the caller having to mirror the seed. If the active board's
   * table doesn't include the target node's current `statusId`, the
   * dropdown still displays the orphan id verbatim (selected) so the
   * operator can swap it for a known status — they can't accidentally
   * lose the orphan reference by opening the modal.
   */
  @property({ attribute: false })
  workflowStatuses: readonly WorkflowStatus[] = DEFAULT_WORKFLOW_STATUSES;

  // SPEC §17.50 -- the modal no longer carries a title field. Title is
  // edited inline from the focused-panel strip (the §17.28 click-to-edit
  // affordance on `<h1 class="title">`). The state slot is gone too;
  // `seedFromTarget` does not seed it; `buildPayload` produces a
  // payload without `title`, which `EditNodeService.editFields` treats
  // as "do not touch the title".

  @state()
  private description = "";

  @state()
  private weight = "";

  /** SPEC §17.141 -- `ValueNode.disabled` flag, surfaced as a
   * checkbox at the top of the form (replaces the §17.122 /
   * §17.133 inline parent-card toggle button). The state is a
   * `boolean` because the underlying control is a native
   * `<input type="checkbox">` whose `.checked` is the only
   * canonical truth — no `String(...)` round-trip needed. */
  @state()
  private disabled = false;

  @state()
  private unit = "";

  @state()
  private initialValue = "";

  @state()
  private targetValue = "";

  @state()
  private targetDate = "";

  /** SPEC §17.119 — image URL for the Picture kind. Seeded from `target.imageUrl`. */
  @state()
  private imageUrl = "";

  /** Currently selected `WorkflowStatus.id` for the Workflow form (SPEC §17.118). */
  @state()
  private statusId = "";

  /**
   * SPEC §17.120 — URL for the URL kind. Seeded from `target.url`
   * (the URLNode getter that surfaces the inherited description
   * slot per the §17.120 "URL is in the description" contract).
   * Gating predicate is identical to the Picture kind's `imageUrl`:
   * "non-empty after trim".
   */
  @state()
  private url = "";

  /**
   * SPEC §17.77 / §17.94 — read-only `[min, max]` snapshot for the
   * StrictRange kind. Surfaces the structural range so the operator
   * sees the active contract while editing description / weight;
   * not editable through this modal (the application service's
   * `StrictRange` edit shape is `CommonEdit` only). Reset to a
   * neutral `[0, 0]` placeholder between opens; seeded from
   * `target.bounds` on the open=false→true edge for a StrictRange
   * target.
   */
  @state()
  private bounds = { min: 0, max: 0 };

  /**
   * SPEC §17.94 / §17.95 — canonical `ComputationKind.name` driving
   * the strategy dropdown for the Computed kind. Seeded from
   * `target.computationKindName` on open; defaulted to `"AVERAGE"`
   * between opens (matches the add-child modal's default so the
   * pickers feel consistent). The wire is the canonical name; the
   * service-side resolution to the singleton happens in
   * `main.ts`'s `toAppEditPayload`.
   */
  @state()
  private computationKindName = "AVERAGE";

  /**
   * Layout-specific styles layered on top of the shared `modalFrameStyles`
   * (SPEC §17.29). The shared module owns the host overlay, backdrop,
   * panel sizing contract (max-width / max-height: viewport - 4rem,
   * width / height: max-content) and the close-X corner button. This
   * stylesheet only contributes the per-modal layout (single-column
   * form, weight slider pair, action row) so the §17.29 contract
   * stays enforceable: a future third modal that re-imports this
   * module gets the same frame for free.
   *
   * Visually mirrors `<add-child-modal>` (SPEC §17.25 + §17.26) — the
   * field-by-field styling is duplicated so the two modals can evolve
   * independently if their styling diverges (e.g. a future "diff
   * highlight" on edited fields). Pure-form styling is a bigger
   * surface than the modal frame and isn't part of §17.29's scope.
   */
  static styles = [
    modalFrameStyles,
    css`
    /* §17.29 -- extend (not replace) the shared .panel rule. We only
       add the single-column grid + the panel intrinsic minimum
       width. The shared rule supplies the sizing cap (max-width /
       max-height: viewport - 4rem) and the visual frame. */
    .panel {
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 1rem 1.25rem;
      /* Reserve top-padding for the §17.29 close-X corner button so
         a long header title can't run under its hit zone. */
      padding: 1.5rem 2rem;
      padding-right: clamp(3.5rem, 5vw, 4.25rem);
      /* §17.29 — keep the form wide enough to read on a kiosk while
         still respecting the shared viewport cap. min(28rem,
         100vw - 4rem) so a narrow viewport falls back gracefully. */
      min-width: min(28rem, calc(100vw - 4rem));
      min-height: 0;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .title-row {
      font-size: 1.25rem;
      font-weight: 600;
    }
    .kind-label {
      font-size: 0.95rem;
      color: color-mix(in srgb, currentColor 65%, transparent);
    }
    .form-pane {
      min-height: 0;
      overflow-y: auto;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .field-row {
      display: flex;
      gap: 0.85rem;
      flex-wrap: wrap;
    }
    .field-row .field {
      flex: 1 1 12rem;
      min-width: 0;
    }
    /* SPEC §17.141 -- universal disabled-flag row. The label
       carries both the checkbox and its caption on a single
       horizontal line so the affordance reads as a single
       compound control. Reused for every kind (the flag rides
       CommonEdit in the application layer). */
    .disabled-field {
      flex-direction: row;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }
    .disabled-field input[type="checkbox"] {
      width: 1.1rem;
      height: 1.1rem;
      margin: 0;
      cursor: pointer;
    }
    input,
    textarea,
    select {
      box-sizing: border-box;
      width: 100%;
      padding: 0.55rem 0.7rem;
      background: color-mix(in srgb, currentColor 4%, transparent);
      color: inherit;
      border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
      border-radius: 6px;
      font: inherit;
    }
    input:focus,
    textarea:focus,
    select:focus {
      outline: none;
      border-color: color-mix(in srgb, currentColor 55%, transparent);
      background: color-mix(in srgb, currentColor 8%, transparent);
    }
    input::placeholder,
    textarea::placeholder {
      color: color-mix(in srgb, currentColor 50%, transparent);
      font-style: italic;
    }
    /* §17.118 -- keep the native dropdown legible on both light and dark
       backgrounds. Mirrors the add-child-modal select rule. */
    select {
      color-scheme: light dark;
      appearance: auto;
    }
    select option {
      color: black;
    }
    .weight-control {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .weight-control input[type="range"] {
      flex: 1 1 auto;
      width: auto;
      min-width: 0;
      padding: 0;
      background: transparent;
      border: none;
      accent-color: currentColor;
      height: 1.5rem;
    }
    .weight-control input[type="number"] {
      flex: 0 0 auto;
      width: 5rem;
      text-align: center;
    }
    .checkbox-row {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .checkbox-row label {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      cursor: pointer;
      font: inherit;
    }
    .checkbox-row input[type="checkbox"] {
      width: auto;
      accent-color: currentColor;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.6rem;
      margin-top: 0.5rem;
    }
    .btn {
      padding: 0.55rem 1.1rem;
      background: transparent;
      color: inherit;
      border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
      border-radius: 6px;
      cursor: pointer;
      font: inherit;
    }
    .btn--primary {
      background: color-mix(in srgb, currentColor 28%, transparent);
      border-color: color-mix(in srgb, currentColor 55%, transparent);
    }
    .btn:hover:not(:disabled),
    .btn:focus-visible {
      outline: none;
      background: color-mix(in srgb, currentColor 16%, transparent);
    }
    .btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .error {
      color: #ff8e8e;
      font-size: 0.95em;
    }
  `,
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("keydown", this.handleKeydown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleKeydown);
  }

  override willUpdate(changed: Map<string, unknown>): void {
    if (
      (changed.has("open") || changed.has("editTarget")) &&
      this.open &&
      this.editTarget
    ) {
      this.seedFromTarget(this.editTarget);
      this.errorMessage = null;
    }
  }

  render() {
    if (!this.open || !this.editTarget) {
      return nothing;
    }
    return html`
      <div
        class="backdrop"
        data-testid="edit-modal-backdrop"
        @click=${this.handleBackdropClick}
      ></div>
      <div
        class="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-node-modal-title"
        data-testid="edit-node-modal"
        data-kind=${this.editTarget.kind}
      >
        ${renderModalCloseX(this.cancel)}
        <header class="header">
          <span class="title-row" id="edit-node-modal-title"
            >Edit the focused node</span
          >
          <span class="kind-label" data-testid="edit-modal-kind"
            >${KIND_LABELS[this.editTarget.kind]}</span
          >
        </header>
        <div class="form-pane">${this.renderForm()}</div>
      </div>
    `;
  }

  private renderForm() {
    const target = this.editTarget!;
    return html`
      <form
        data-testid="edit-modal-form"
        data-kind=${target.kind}
        ?data-error=${this.errorMessage !== null}
        @submit=${this.handleSubmit}
      >
        ${this.renderKindSpecificFields(target.kind)}
        ${this.renderErrorMessage()}
        ${this.renderActions()}
      </form>
    `;
  }

  /**
   * Per-kind form-fields ladder, extracted from `renderForm` to keep
   * the latter's cognitive complexity under Sonar's S3776 cap. The
   * weight control is unconditional and gets emitted between the
   * "pre-weight" kind fields (description / status) and the
   * "post-weight" ones (BSC + Picture + URL), so the visual order is
   * unchanged from the in-line version.
   */
  private renderKindSpecificFields(kind: EditNodeTarget["kind"]) {
    // SPEC §17.94 / §17.95 — `ComputedBusinessScoreNode` mixes the
    // BSC slots (description / unit / objective) with the Computed
    // strategy dropdown. `wantsBscFields` therefore fires for both
    // the plain BSC and the computed-BSC kinds; `wantsComputation
    // Kind` fires for both plain Computed and computed-BSC.
    const wantsBscFields =
      kind === "BusinessScoreCardNode" || kind === "ComputedBusinessScoreNode";
    const isStrictRange = kind === "StrictRangeNode";
    const wantsComputationKind =
      kind === "ComputedNode" || kind === "ComputedBusinessScoreNode";
    const wantsDescription =
      wantsBscFields || isStrictRange || kind === "ComputedNode";
    return html`
      ${wantsDescription ? this.renderDescriptionField() : nothing}
      ${kind === "Workflow" ? this.renderWorkflowStatusField() : nothing}
      ${this.renderWeightField()}
      ${this.renderDisabledField()}
      ${wantsBscFields ? this.renderUnitField() : nothing}
      ${wantsBscFields ? this.renderObjectiveFields() : nothing}
      ${kind === "PictureNode" ? this.renderImageUrlField() : nothing}
      ${kind === "URLNode" ? this.renderURLField() : nothing}
      ${isStrictRange ? this.renderStrictRangeBounds() : nothing}
      ${wantsComputationKind ? this.renderComputationKindField() : nothing}
    `;
  }

  /** SPEC §17.141 -- universal disabled-flag checkbox row,
   * rendered for every kind right after the weight control (the
   * disabled flag rides `CommonEdit` in the application layer, so
   * every kind that reaches this modal honours it). The pre-§17.141
   * affordance was a `<button role="switch">` rendered inline on
   * each AsParent organism's icons slot; retiring the inline switch
   * keeps the parent identity strip uncluttered and routes the
   * write through the same modal-confirm seam the other fields
   * use. */
  private renderDisabledField() {
    return html`
      <div class="field-row" data-testid="disabled-row">
        <label class="field disabled-field">
          <input
            data-testid="field-disabled"
            type="checkbox"
            .checked=${this.disabled}
            @change=${this.handleDisabledInput}
          />
          <span>Disabled (parked, excluded from aggregation)</span>
        </label>
      </div>
    `;
  }

  private readonly handleDisabledInput = (e: Event): void => {
    const input = e.currentTarget as HTMLInputElement;
    this.disabled = input.checked;
  };

  private renderWeightField() {
    return html`
      <div class="field-row" data-testid="weight-row">
        <div class="field">
          <div class="weight-control" data-testid="weight-control">
            <input
              data-testid="field-weight-slider"
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              aria-label="Weight"
              .value=${this.weight}
              @input=${this.handleWeightInput}
            />
            <input
              data-testid="field-weight"
              type="number"
              min="0.5"
              max="10"
              step="0.5"
              placeholder="Weight — e.g. 1"
              .value=${this.weight}
              @input=${this.handleWeightInput}
            />
          </div>
        </div>
      </div>
    `;
  }

  private renderErrorMessage() {
    if (this.errorMessage === null) return nothing;
    return html`<p class="error" data-testid="edit-modal-error">
      ${this.errorMessage}
    </p>`;
  }

  private renderActions() {
    return html`
      <div class="actions" data-testid="edit-modal-actions">
        <button
          class="btn"
          type="button"
          data-testid="edit-modal-cancel"
          @click=${this.cancel}
        >
          Cancel
        </button>
        <button
          class="btn btn--primary"
          type="button"
          data-testid="edit-modal-confirm"
          ?disabled=${!this.canConfirm()}
          @click=${this.confirm}
        >
          Confirm
        </button>
      </div>
    `;
  }

  private readonly handleWeightInput = (e: Event): void => {
    this.bindString(e, "weight");
  };

  private renderDescriptionField() {
    return html`
      <div class="field">
        <textarea
          data-testid="field-description"
          placeholder="Description — e.g. Quarterly revenue across the EU-North region; sourced from the BI data warehouse."
          rows="3"
          maxlength="280"
          .value=${this.description}
          @input=${(e: Event) => this.bindString(e, "description")}
        ></textarea>
      </div>
    `;
  }

  /**
   * SPEC §17.118 — Workflow status dropdown. Defends against an orphan
   * `statusId` (board's status table was trimmed after the node was
   * created): if the current pick isn't in `workflowStatuses`, the
   * dropdown still shows it as the leading option (rendered verbatim
   * with a "— missing" tail) so the operator can see the orphan and
   * choose a replacement; selecting any known status will overwrite
   * it on Confirm.
   */
  private renderWorkflowStatusField() {
    const known = this.workflowStatuses.some((s) => s.id === this.statusId);
    return html`
      <div class="field">
        <select
          data-testid="field-status"
          required
          .value=${this.statusId}
          @change=${(e: Event) => this.bindString(e, "statusId")}
        >
          ${!known && this.statusId !== ""
            ? html`
                <option value=${this.statusId} selected>
                  ${this.statusId} — missing
                </option>
              `
            : nothing}
          ${this.workflowStatuses.map(
            (s) => html`
              <option value=${s.id} ?selected=${s.id === this.statusId}>
                ${s.label}
              </option>
            `,
          )}
        </select>
      </div>
    `;
  }

  private renderUnitField() {
    return html`
      <div class="field-row">
        <div class="field">
          <input
            data-testid="field-unit"
            type="text"
            placeholder='Unit — e.g. "%" or "M€"'
            .value=${this.unit}
            required
            @input=${(e: Event) => this.bindString(e, "unit")}
          />
        </div>
      </div>
    `;
  }

  private renderObjectiveFields() {
    return html`
      <div class="field-row">
        <div class="field">
          <input
            data-testid="field-initial"
            type="number"
            placeholder="Objective initial value — e.g. 0"
            .value=${this.initialValue}
            required
            @input=${(e: Event) => this.bindString(e, "initialValue")}
          />
        </div>
        <div class="field">
          <input
            data-testid="field-target"
            type="number"
            placeholder="Objective target value — e.g. 100"
            .value=${this.targetValue}
            required
            @input=${(e: Event) => this.bindString(e, "targetValue")}
          />
        </div>
        <div class="field">
          <input
            data-testid="field-target-date"
            type="date"
            placeholder="Objective target date — e.g. 2026-12-31"
            .value=${this.targetDate}
            required
            @input=${(e: Event) => this.bindString(e, "targetDate")}
          />
        </div>
      </div>
    `;
  }

  /**
   * SPEC §17.119 — single edit field for the Picture kind: the
   * image URL. The seed comes from `target.imageUrl`; the gate is
   * "non-empty after trim" (matching `PictureNode.normaliseImageUrl`
   * + the add-child contract). `type="url"` triggers the platform
   * URL keyboard on touch kiosks; the actual validation is the
   * domain's trim-non-empty check, mirrored by `buildPayload`'s
   * `imageUrl.length === 0` guard.
   */
  private renderImageUrlField() {
    return html`
      <div class="field" data-testid="image-url-row">
        <input
          data-testid="field-image-url"
          type="url"
          placeholder='Image URL — e.g. "https://example.com/photo.jpg"'
          .value=${this.imageUrl}
          required
          @input=${(e: Event) => this.bindString(e, "imageUrl")}
        />
      </div>
    `;
  }

  /**
   * SPEC §17.120 — single edit field for the URL kind: the URL. The
   * seed comes from `target.url`; the gate is "non-empty after trim"
   * (matching `URLNode.normaliseUrl` + the add-child contract).
   * `type="url"` triggers the platform URL keyboard on touch kiosks;
   * the actual validation is the domain's trim-non-empty check,
   * mirrored by `buildPayload`'s `url.length === 0` guard. Direct
   * parity with the §17.119 `renderImageUrlField` — same shape,
   * different field name + different placeholder copy.
   */
  private renderURLField() {
    return html`
      <div class="field" data-testid="url-row">
        <input
          data-testid="field-url"
          type="url"
          placeholder='URL — e.g. "https://example.com/docs"'
          .value=${this.url}
          required
          @input=${(e: Event) => this.bindString(e, "url")}
        />
      </div>
    `;
  }

  /**
   * SPEC §17.77 / §17.94 — read-only display of the StrictRange's
   * `[min, max]` bounds. The application service's `StrictRange`
   * edit shape is `CommonEdit` only (title / weight / disabled /
   * description); the bounds are structural and not editable from
   * this modal. Surfacing them here keeps the operator informed of
   * the active contract while editing description / weight (so a
   * future "out-of-range value" rejection from the seed-edit seam
   * isn't a surprise) without offering a non-functional input.
   */
  private renderStrictRangeBounds() {
    return html`
      <div class="field" data-testid="range-bounds-row">
        <p class="range-bounds" data-testid="range-bounds">
          Range bounds (read-only): <strong>${this.bounds.min}</strong> –
          <strong>${this.bounds.max}</strong>
        </p>
      </div>
    `;
  }

  /**
   * SPEC §17.94 / §17.95 — strategy dropdown for the Computed kind.
   * Shares the same `ComputationKind.ALL` catalogue + label map as
   * the add-child modal (`COMPUTATION_KIND_LABELS` imported from
   * `AddChildModal.js` per the §17.110 "future computation-kind-
   * change UI" anticipation). Pre-selected via the
   * `computationKindName` `@state` (seeded from the snapshot on
   * open); editable through the `change` event. Native `<select>`
   * mirrors the Workflow-status picker pattern (§17.118).
   */
  private renderComputationKindField() {
    return html`
      <div class="field" data-testid="computation-kind-row">
        <select
          data-testid="field-computation-kind"
          required
          .value=${this.computationKindName}
          @change=${(e: Event) => this.bindString(e, "computationKindName")}
        >
          ${ComputationKind.ALL.map(
            (k) => html`
              <option
                value=${k.name}
                ?selected=${k.name === this.computationKindName}
              >
                ${COMPUTATION_KIND_LABELS[k.name] ?? k.name}
              </option>
            `,
          )}
        </select>
      </div>
    `;
  }

  private cancel = (): void => {
    this.dispatchEvent(
      new CustomEvent(EDIT_NODE_CANCEL_EVENT, {
        bubbles: true,
        composed: true,
      }),
    );
  };

  private handleSubmit = (e: Event): void => {
    e.preventDefault();
    this.confirm();
  };

  private confirm = (): void => {
    const payload = this.buildPayload();
    if (!payload || !this.editTarget) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<EditNodeConfirmDetail>(EDIT_NODE_CONFIRM_EVENT, {
        bubbles: true,
        composed: true,
        detail: { nodeId: this.editTarget.nodeId, payload },
      }),
    );
  };

  private buildPayload(): EditNodeModalPayload | null {
    if (!this.editTarget) {
      return null;
    }
    // SPEC §17.50 -- title is intentionally omitted from the payload.
    // `EditNodeService.editFields` skips the field when `payload.title`
    // is `undefined`, so the operator's inline title edit (which is
    // the canonical entry point for renames) is the only path that
    // mutates the node's identity.title.
    const weight = this.parseOptionalWeight();
    // SPEC §17.141 -- `disabled` rides every payload as the
    // application layer's `CommonEdit.disabled` slot. Always
    // sending the current state mirrors how weight is sent;
    // `EditNodeService.applyCommonEdits` short-circuits a no-op
    // `setDisabled` at the value-node level so a confirm-without-
    // toggle stays cheap.
    const disabled = this.disabled;
    switch (this.editTarget.kind) {
      case "TextNode":
        return { kind: "TextNode", ...weight, disabled };
      case "PictureNode":
        return this.buildPicturePayload(weight);
      case "Workflow":
        return this.buildWorkflowPayload(weight);
      case "URLNode":
        return this.buildURLPayload(weight);
      case "BusinessScoreCardNode":
        return this.buildBscPayload(weight);
      case "StrictRangeNode":
        return this.buildStrictRangePayload(weight);
      case "ComputedNode":
        return this.buildComputedPayload(weight);
      case "ComputedBusinessScoreNode":
        return this.buildComputedBscPayload(weight);
    }
  }

  /** Trim-and-`Number()` the slider/number-pair binding into the optional `weight` slot. */
  private parseOptionalWeight(): { weight?: number } {
    if (this.weight.trim() === "") return {};
    const n = Number(this.weight);
    return Number.isNaN(n) ? {} : { weight: n };
  }

  /**
   * SPEC §17.119 — Picture edit: weight + imageUrl. Both fields stay
   * optional in the payload shape (the application service treats
   * `undefined` as "do not touch"); the modal still gates Confirm on
   * "imageUrl is non-empty after trim" because the domain rejects an
   * empty URL — leaving the field blank would throw at the service
   * boundary and roll back uselessly.
   */
  private buildPicturePayload(weight: { weight?: number }): EditNodeModalPayload | null {
    const imageUrl = this.imageUrl.trim();
    if (imageUrl.length === 0) return null;
    return { kind: "PictureNode", ...weight, disabled: this.disabled, imageUrl };
  }

  /**
   * SPEC §17.118 — Workflow shares the TextNode edit shape (weight)
   * and adds an optional `statusId` swap. The service treats
   * `undefined` as "no change", so the payload omits `statusId` when
   * the operator hasn't touched the dropdown or when the field is
   * empty. An orphan `statusId` (board's status table no longer
   * contains the id) is still acceptable — the field renders it
   * verbatim, the operator can replace it, and the service applies
   * whatever lands in the payload (the application layer is the
   * authority on validity).
   */
  private buildWorkflowPayload(weight: { weight?: number }): EditNodeModalPayload {
    const trimmed = this.statusId.trim();
    return {
      kind: "Workflow",
      ...weight,
      disabled: this.disabled,
      ...(trimmed === "" ? {} : { statusId: trimmed }),
    };
  }

  /**
   * SPEC §17.120 — URL edit: weight + url. Mirrors the Picture branch
   * structurally; gate is the same "url is non-empty after trim"
   * predicate (the URLNode domain layer applies the same validator,
   * so leaving the field blank would throw at the service boundary
   * and roll back uselessly).
   */
  private buildURLPayload(weight: { weight?: number }): EditNodeModalPayload | null {
    const url = this.url.trim();
    if (url.length === 0) return null;
    return { kind: "URLNode", ...weight, disabled: this.disabled, url };
  }

  /**
   * BusinessScoreCardNode branch — unit + objective fields are
   * mandatory (mirroring the add-child contract); description stays
   * optional. The v3-era `computed` + `eligibleForParentComputation`
   * checkboxes retired post-§17.99b/c.
   */
  private buildBscPayload(weight: { weight?: number }): EditNodeModalPayload | null {
    const description = this.description.trim();
    const unit = this.unit.trim();
    const initialValue = Number(this.initialValue);
    const targetValue = Number(this.targetValue);
    const targetDate = this.targetDate
      ? new Date(`${this.targetDate}T00:00:00.000Z`)
      : null;
    if (
      !unit ||
      Number.isNaN(initialValue) ||
      Number.isNaN(targetValue) ||
      targetDate === null ||
      Number.isNaN(targetDate.getTime())
    ) {
      return null;
    }
    return {
      kind: "BusinessScoreCardNode",
      description,
      ...weight,
      disabled: this.disabled,
      unit,
      objective: { initialValue, targetValue, targetDate },
    };
  }

  /**
   * SPEC §17.77 / §17.94 — StrictRange edit: description + weight.
   * Range bounds are structural (the application service's
   * `StrictRange` edit shape is `CommonEdit` only); only description
   * + weight flow through. Description is always defined (the
   * underlying form binding produces an empty string when blank,
   * which the service treats as "clear the description"). Confirm
   * is always enabled — every editable field has a usable default
   * (weight pre-seeded from the snapshot, description trimmable to
   * empty).
   */
  private buildStrictRangePayload(weight: { weight?: number }): EditNodeModalPayload {
    return {
      kind: "StrictRangeNode",
      description: this.description.trim(),
      ...weight,
      disabled: this.disabled,
    };
  }

  /**
   * SPEC §17.94 / §17.95 — Computed edit: description + weight +
   * computationKind. The dropdown is gated to `ComputationKind.ALL`,
   * so the trimmed `computationKindName` is always a valid singleton
   * name; the field-emission predicate is "non-empty after trim" so
   * a corrupt seed (e.g. a future enum-shrink) drops to `undefined`
   * and the service treats it as "no change". Confirm is always
   * enabled — every editable field has a usable default.
   */
  private buildComputedPayload(weight: { weight?: number }): EditNodeModalPayload {
    const computationKindName = this.computationKindName.trim();
    return {
      kind: "ComputedNode",
      description: this.description.trim(),
      ...weight,
      disabled: this.disabled,
      ...(computationKindName === "" ? {} : { computationKindName }),
    };
  }

  /**
   * SPEC §17.94 / §17.95 — ComputedBusinessScore edit: combines the
   * BSC slots (description / unit / objective) with the Computed
   * strategy dropdown. Gating mirrors `buildBscPayload` field-by-
   * field (unit non-empty after trim, finite numeric initial /
   * target values, parseable target date); the trimmed
   * `computationKindName` falls back to `undefined` on a corrupt
   * seed so the service treats it as "no change". Returning `null`
   * disables Confirm exactly when the BSC gates would.
   */
  private buildComputedBscPayload(weight: { weight?: number }): EditNodeModalPayload | null {
    const unit = this.unit.trim();
    const initialValue = Number(this.initialValue);
    const targetValue = Number(this.targetValue);
    const targetDate = this.targetDate
      ? new Date(`${this.targetDate}T00:00:00.000Z`)
      : null;
    if (
      !unit ||
      Number.isNaN(initialValue) ||
      Number.isNaN(targetValue) ||
      targetDate === null ||
      Number.isNaN(targetDate.getTime())
    ) {
      return null;
    }
    const computationKindName = this.computationKindName.trim();
    return {
      kind: "ComputedBusinessScoreNode",
      description: this.description.trim(),
      ...weight,
      disabled: this.disabled,
      unit,
      objective: { initialValue, targetValue, targetDate },
      ...(computationKindName === "" ? {} : { computationKindName }),
    };
  }

  private canConfirm(): boolean {
    return this.buildPayload() !== null;
  }

  private bindString(
    e: Event,
    field:
      | "description"
      | "weight"
      | "unit"
      | "initialValue"
      | "targetValue"
      | "targetDate"
      | "imageUrl"
      | "statusId"
      | "url"
      | "computationKindName",
  ): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    this[field] = target.value;
  }

  /**
   * Initialises the form state from the pre-edit snapshot. Called
   * exactly once per `open` flip (the `willUpdate` hook gates on
   * `changed.has("open") && this.open`). Numeric fields go through
   * `String(...)` because the underlying inputs are typed `string`
   * (matching `<add-child-modal>`'s convention so the same
   * `bindString` helper works for both halves of the weight pair).
   */
  private seedFromTarget(target: EditNodeTarget): void {
    // SPEC §17.50 -- no `formTitle` to seed; title is edited inline.
    this.weight = String(target.weight);
    // SPEC §17.141 -- disabled flag rides as a universal field
    // (every value-node kind carries it via `ValueNode.disabled`).
    // The target's `disabled` is typed optional so legacy fixtures
    // that pre-date the §17.141 modal contract stay valid; default
    // to `false` when absent (the kiosk's runtime path always
    // populates the field through `buildEditTarget` in main.ts).
    this.disabled = target.disabled ?? false;
    this.resetKindSpecificFields();
    this.applyKindSpecificSeed(target);
  }

  /**
   * Clears every kind-specific seed back to its empty/default value.
   * Pulled out of `seedFromTarget` so each per-kind branch only writes
   * the slots it actually owns; this drops both the function's
   * cognitive complexity AND its duplication footprint (every branch
   * used to repeat the same eleven-line "clear everything else"
   * preamble). Keeping a single source of truth for "what an unset
   * form looks like" also means a future kind addition only has to
   * append its slot here and write the seed branch — no risk of a
   * stale field bleeding through because one branch forgot to clear
   * it.
   */
  private resetKindSpecificFields(): void {
    this.description = "";
    this.unit = "";
    this.initialValue = "";
    this.targetValue = "";
    this.targetDate = "";
    this.imageUrl = "";
    this.statusId = "";
    this.url = "";
    this.bounds = { min: 0, max: 0 };
    this.computationKindName = "AVERAGE";
  }

  private applyKindSpecificSeed(target: EditNodeTarget): void {
    if (target.kind === "TextNode") return;
    if (target.kind === "PictureNode") {
      this.imageUrl = target.imageUrl;
      return;
    }
    if (target.kind === "URLNode") {
      this.url = target.url;
      return;
    }
    if (target.kind === "Workflow") {
      this.statusId = target.statusId;
      return;
    }
    if (target.kind === "StrictRangeNode") {
      this.description = target.description;
      this.bounds = { min: target.bounds.min, max: target.bounds.max };
      return;
    }
    if (target.kind === "ComputedNode") {
      this.description = target.description;
      this.computationKindName = target.computationKindName;
      return;
    }
    if (target.kind === "ComputedBusinessScoreNode") {
      this.description = target.description;
      this.unit = target.unit;
      this.initialValue = String(target.objective.initialValue);
      this.targetValue = String(target.objective.targetValue);
      this.targetDate = target.objective.targetDateIso;
      this.computationKindName = target.computationKindName;
      return;
    }
    this.description = target.description;
    this.unit = target.unit;
    this.initialValue = String(target.objective.initialValue);
    this.targetValue = String(target.objective.targetValue);
    this.targetDate = target.objective.targetDateIso;
  }

  private handleBackdropClick = (e: Event): void => {
    e.stopPropagation();
    this.cancel();
  };

  private readonly handleKeydown = (e: KeyboardEvent): void => {
    if (!this.open) {
      return;
    }
    if (e.key === "Escape") {
      this.cancel();
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "edit-node-modal": EditNodeModal;
  }
  interface HTMLElementEventMap {
    "edit-node-confirm": CustomEvent<EditNodeConfirmDetail>;
    "edit-node-cancel": CustomEvent<void>;
  }
}
