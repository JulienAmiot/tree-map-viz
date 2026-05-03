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
 *   - The two flows have **different** payload shapes (`AddChildPayload`
 *     vs `EditNodePayload`), different mandatory fields (a fresh BSC
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
 *      weight, description, unit, objective, computed,
 *      eligibleForParentComputation. Title comes through this flow as
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
 *     `CustomEvent<{ nodeId, payload: EditNodePayload }>` on confirm.
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

import type { EditNodePayload } from "../../../application/EditNodeService.js";
import {
  modalFrameStyles,
  renderModalCloseX,
} from "./modalFrameStyles.js";

export const EDIT_NODE_CONFIRM_EVENT = "edit-node-confirm";
export const EDIT_NODE_CANCEL_EVENT = "edit-node-cancel";

/** Pre-edit snapshot supplied by the composition root when opening the modal. */
export type EditNodeTarget =
  | {
      readonly nodeId: string;
      readonly kind: "TextNode";
      readonly title: string;
      readonly weight: number;
    }
  | {
      readonly nodeId: string;
      readonly kind: "BusinessScoreCardNode";
      readonly title: string;
      readonly description: string;
      readonly weight: number;
      readonly unit: string;
      readonly objective: {
        readonly initialValue: number;
        readonly targetValue: number;
        /** ISO `YYYY-MM-DD` (UTC) — the form's date input wants this format. */
        readonly targetDateIso: string;
      };
      readonly computed: boolean;
      readonly eligibleForParentComputation: boolean;
    };

export type EditNodeConfirmDetail = {
  readonly nodeId: string;
  readonly payload: EditNodePayload;
};

const KIND_LABELS: Record<EditNodeTarget["kind"], string> = {
  TextNode: "Text",
  BusinessScoreCardNode: "Business Score Card",
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

  @state()
  private unit = "";

  @state()
  private initialValue = "";

  @state()
  private targetValue = "";

  @state()
  private targetDate = "";

  @state()
  private computed = false;

  @state()
  private eligibleForParentComputation = true;

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
    input,
    textarea {
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
    textarea:focus {
      outline: none;
      border-color: color-mix(in srgb, currentColor 55%, transparent);
      background: color-mix(in srgb, currentColor 8%, transparent);
    }
    input::placeholder,
    textarea::placeholder {
      color: color-mix(in srgb, currentColor 50%, transparent);
      font-style: italic;
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
    const isBsc = target.kind === "BusinessScoreCardNode";
    return html`
      <form
        data-testid="edit-modal-form"
        data-kind=${target.kind}
        ?data-error=${this.errorMessage !== null}
        @submit=${this.handleSubmit}
      >
        ${isBsc ? this.renderDescriptionField() : nothing}
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
                @input=${(e: Event) => this.bindString(e, "weight")}
              />
              <input
                data-testid="field-weight"
                type="number"
                min="0.5"
                max="10"
                step="0.5"
                placeholder="Weight — e.g. 1"
                .value=${this.weight}
                @input=${(e: Event) => this.bindString(e, "weight")}
              />
            </div>
          </div>
        </div>
        ${isBsc ? this.renderUnitField() : nothing}
        ${isBsc ? this.renderObjectiveFields() : nothing}
        ${isBsc ? this.renderBscToggles() : nothing}
        ${this.errorMessage
          ? html`<p class="error" data-testid="edit-modal-error">
              ${this.errorMessage}
            </p>`
          : nothing}
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
      </form>
    `;
  }

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

  private renderBscToggles() {
    return html`
      <div class="checkbox-row">
        <label>
          <input
            data-testid="field-computed"
            type="checkbox"
            .checked=${this.computed}
            @change=${(e: Event) => this.bindBool(e, "computed")}
          />
          Computed (aggregate from eligible children)
        </label>
        <label>
          <input
            data-testid="field-eligible"
            type="checkbox"
            .checked=${this.eligibleForParentComputation}
            @change=${(e: Event) => this.bindBool(e, "eligibleForParentComputation")}
          />
          Eligible for parent computation
        </label>
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

  private buildPayload(): EditNodePayload | null {
    if (!this.editTarget) {
      return null;
    }
    // SPEC §17.50 -- title is intentionally omitted from the payload.
    // `EditNodeService.editFields` skips the field when `payload.title`
    // is `undefined`, so the operator's inline title edit (which is
    // the canonical entry point for renames) is the only path that
    // mutates the node's identity.title.
    const weight = this.weight.trim() === "" ? undefined : Number(this.weight);
    if (this.editTarget.kind === "TextNode") {
      return {
        kind: "TextNode",
        ...(weight === undefined || Number.isNaN(weight) ? {} : { weight }),
      };
    }
    // BusinessScoreCardNode branch — unit + objective fields are
    // mandatory (mirroring the add-child contract); description stays
    // optional. computed / eligibleForParentComputation are checkboxes,
    // always defined (no "tristate" intermediate).
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
      ...(weight === undefined || Number.isNaN(weight) ? {} : { weight }),
      unit,
      objective: { initialValue, targetValue, targetDate },
      computed: this.computed,
      eligibleForParentComputation: this.eligibleForParentComputation,
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
      | "targetDate",
  ): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    this[field] = target.value;
  }

  private bindBool(
    e: Event,
    field: "computed" | "eligibleForParentComputation",
  ): void {
    const target = e.target as HTMLInputElement;
    this[field] = target.checked;
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
    if (target.kind === "TextNode") {
      this.description = "";
      this.unit = "";
      this.initialValue = "";
      this.targetValue = "";
      this.targetDate = "";
      this.computed = false;
      this.eligibleForParentComputation = true;
      return;
    }
    this.description = target.description;
    this.unit = target.unit;
    this.initialValue = String(target.objective.initialValue);
    this.targetValue = String(target.objective.targetValue);
    this.targetDate = target.objective.targetDateIso;
    this.computed = target.computed;
    this.eligibleForParentComputation = target.eligibleForParentComputation;
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
