/**
 * `<add-child-modal>` — wide kiosk modal that captures the payload for
 * `AddChildService.addChild(focusedParent, payload)` (SPEC §7).
 *
 * Two-step flow:
 *   1. **Type selector**: pick `Text` or `BusinessScoreCard` (extensible
 *      later through the same per-kind registry as views).
 *   2. **Type-specific form**: empty-field placeholder pattern (§6) — every
 *      input shows a `placeholder` of the form `<Field name> — e.g. <mock>`
 *      so the field's purpose is explicit AND a concrete example is
 *      visible at a glance; no `<label>` siblings.
 *
 * Surface contract:
 *   - `open` (boolean attribute, reflected) — whether the modal is visible.
 *     Reflected so `:host([open])` styling and e2e `getAttribute("open")`
 *     both work.
 *   - `parentId` (property, no attribute) — informational; included in the
 *     `add-child-confirm` detail so the composition root can resolve the
 *     focused parent without re-querying. The shell sets it from the most
 *     recent `plus-tile-activate` event (also forwards `view.center.id`
 *     when the modal opens via keyboard).
 *   - dispatches a bubbling+composed `add-child-confirm`
 *     `CustomEvent<{ parentId, payload }>` when the user confirms a valid
 *     form. The composition root calls `AddChildService.addChild(...)` and
 *     closes the modal on success.
 *   - dispatches a bubbling+composed `add-child-cancel` `CustomEvent<void>`
 *     when the user cancels (Escape, Cancel button, backdrop tap).
 *
 * Close paths (all dispatch `add-child-cancel`):
 *   - Cancel button.
 *   - Escape key.
 *   - Tap on the backdrop (NOT inside the panel — `composedPath()` walks
 *     shadow DOM so taps inside the panel's slotted children stay inside).
 *   - Backdrop tap is enabled even with form data partially entered; the
 *     kiosk operator UX favours "easy to dismiss" over "hard to leave"
 *     because the modal never persists until Confirm.
 *
 * Layout:
 *   - Wide modal with side margin so the underlying board is visible
 *     through a semi-transparent backdrop (SPEC §7 — "the board is still
 *     behind").
 *   - The modal renders **nothing** in its DOM body when `open=false`, so
 *     it has zero pointer-event surface in the at-rest state and the
 *     focused parent strip + children grid stay fully interactive.
 *
 * Defaults (mirroring `AddChildPayload` optional fields):
 *   - Text: title + a **mandatory current value** (the seed
 *     `TimestampedValue<string>` of the otherwise-empty `TextCard`
 *     history, SPEC §17.14) are required; description optional, weight
 *     default 1.
 *   - BusinessScoreCard: title + unit + objective + a **mandatory current
 *     value** (the seed `TimestampedValue<number>` of the otherwise-empty
 *     `BusinessScoreCard` history, SPEC §17.13) are all required;
 *     description optional, weight default 1, computed default false,
 *     eligibleForParentComputation default true. The "as of" date for
 *     both kinds defaults to **today** (the kiosk operator's local
 *     calendar day, ISO `YYYY-MM-DD`) and stays editable — most field
 *     uses record "what we measured today", but back-filling a past
 *     observation must remain trivial.
 *
 * Validation: rejects empty `title` (and empty `unit` + missing objective
 * numbers + missing current-value/date — for both Text and BSC kinds) by
 * leaving the Confirm button disabled until the required fields are
 * filled. Domain-side validation (Title.of throws on length cap,
 * Weight.of rejects ≤0, etc.) still runs in `AddChildService`, which
 * surfaces failures back through its `Outcome` — the modal reflects
 * those into the `data-error` attribute on the form.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { AddChildPayload } from "../../../application/AddChildService.js";

export const ADD_CHILD_CONFIRM_EVENT = "add-child-confirm";
export const ADD_CHILD_CANCEL_EVENT = "add-child-cancel";

export type AddChildKind = AddChildPayload["kind"];

export type AddChildConfirmDetail = {
  readonly parentId: string;
  readonly payload: AddChildPayload;
};

type Step = "pick-kind" | "fill-form";

@customElement("add-child-modal")
export class AddChildModal extends LitElement {
  /** Whether the modal is visible. Reflected so `:host([open])` works. */
  @property({ type: Boolean, reflect: true })
  open = false;

  /** Id of the focused parent — re-emitted in `add-child-confirm`. */
  @property({ attribute: false })
  parentId = "";

  /** Free-form error message rendered as `data-error` on the form. */
  @property({ attribute: false })
  errorMessage: string | null = null;

  @state()
  private step: Step = "pick-kind";

  @state()
  private chosenKind: AddChildKind | null = null;

  // NB: cannot be named `title` — that would shadow `HTMLElement.title` and
  // break the `T extends HTMLElement` constraint on `mountLitElement<T>`.
  @state()
  private formTitle = "";

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

  /** Seed value for the BSC's TimestampedValue history (SPEC §17.13). */
  @state()
  private currentValue = "";

  /**
   * "As of" date for {@link currentValue}, ISO `YYYY-MM-DD`.
   *
   * Re-initialised to **today** every time the modal opens (see
   * `resetForm`). Kept editable so the operator can back-fill a past
   * observation (e.g. recording last quarter's revenue when on-boarding
   * a new metric).
   */
  @state()
  private currentValueDate = "";

  @state()
  private computed = false;

  @state()
  private eligibleForParentComputation = true;

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 200;
      display: none;
      pointer-events: none;
      color: var(--text, #e8ecf4);
      font: 1rem/1.4 system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial,
        sans-serif;
    }
    :host([open]) {
      display: block;
      pointer-events: auto;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      /* SPEC §7 — semi-transparent so the board behind stays visible. Direct
         rgba (instead of color-mix(... transparent)) so getComputedStyle
         returns a parseable alpha to e2e checks. */
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(2px);
    }
    .panel {
      position: absolute;
      inset: 5vh 8vw;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.5rem 2rem;
      background: color-mix(in srgb, currentColor 8%, var(--bg, #0c0f14));
      border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
      border-radius: 12px;
      box-shadow: 0 24px 64px color-mix(in srgb, #000 60%, transparent);
      overflow: auto;
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
    .step {
      flex: 0 0 auto;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      font-size: 0.85em;
      background: color-mix(in srgb, currentColor 18%, transparent);
    }
    .kind-row {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .kind-card {
      flex: 1 1 14rem;
      box-sizing: border-box;
      padding: 1rem 1.25rem;
      background: transparent;
      color: inherit;
      border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
      border-radius: 10px;
      text-align: left;
      cursor: pointer;
      font: inherit;
    }
    .kind-card:hover,
    .kind-card:focus-visible {
      background: color-mix(in srgb, currentColor 10%, transparent);
      outline: none;
    }
    .kind-card .kind-name {
      font-weight: 600;
      font-size: 1.05em;
      margin-bottom: 0.35rem;
    }
    .kind-card .kind-blurb {
      color: color-mix(in srgb, currentColor 70%, transparent);
      font-size: 0.95em;
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
    /* Empty-field placeholder pattern (SPEC §6): no labels, the placeholder
       carries the field's purpose. The italic + muted styling makes the
       difference between empty (italic, muted) and filled (upright, vivid)
       legible at a glance. */
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
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("keydown", this.handleKeydown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleKeydown);
  }

  override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("open") && this.open) {
      this.resetForm();
    }
  }

  render() {
    if (!this.open) {
      return nothing;
    }
    return html`
      <div
        class="backdrop"
        data-testid="modal-backdrop"
        @click=${this.handleBackdropClick}
      ></div>
      <div
        class="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-child-modal-title"
        data-testid="add-child-modal"
        data-step=${this.step}
      >
        <header class="header">
          <span class="title-row" id="add-child-modal-title"
            >Add a child to the focused node</span
          >
          <span class="step" data-testid="modal-step"
            >${this.step === "pick-kind" ? "Step 1 / 2" : "Step 2 / 2"}</span
          >
        </header>
        ${this.step === "pick-kind"
          ? this.renderKindPicker()
          : this.renderForm()}
      </div>
    `;
  }

  private renderKindPicker() {
    return html`
      <div class="kind-row" data-testid="kind-picker">
        <button
          class="kind-card"
          type="button"
          data-testid="kind-card"
          data-kind="TextNode"
          @click=${() => this.pickKind("TextNode")}
        >
          <div class="kind-name">Text</div>
          <div class="kind-blurb">
            A note: title + description, no value, no Σ.
          </div>
        </button>
        <button
          class="kind-card"
          type="button"
          data-testid="kind-card"
          data-kind="BusinessScoreCardNode"
          @click=${() => this.pickKind("BusinessScoreCardNode")}
        >
          <div class="kind-name">Business Score Card</div>
          <div class="kind-blurb">
            A measurable: title, unit, target, history, optional Σ.
          </div>
        </button>
      </div>
      <div class="actions">
        <button
          class="btn"
          type="button"
          data-testid="modal-cancel"
          @click=${this.cancel}
        >
          Cancel
        </button>
      </div>
    `;
  }

  private renderForm() {
    const isText = this.chosenKind === "TextNode";
    return html`
      <form
        data-testid="modal-form"
        data-kind=${this.chosenKind ?? ""}
        ?data-error=${this.errorMessage !== null}
        @submit=${this.handleSubmit}
      >
        <div class="field">
          <input
            data-testid="field-title"
            type="text"
            placeholder=${'Title — e.g. "North-region revenue"'}
            .value=${this.formTitle}
            required
            maxlength="120"
            @input=${(e: Event) => this.bindString(e, "formTitle")}
          />
        </div>
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
        <div class="field-row">
          <div class="field">
            <input
              data-testid="field-weight"
              type="number"
              min="0.1"
              step="0.1"
              placeholder="Weight — e.g. 1"
              .value=${this.weight}
              @input=${(e: Event) => this.bindString(e, "weight")}
            />
          </div>
          ${isText ? nothing : this.renderUnitField()}
        </div>
        ${isText
          ? this.renderTextCurrentValueFields()
          : this.renderBscCurrentValueFields()}
        ${isText ? nothing : this.renderObjectiveFields()}
        ${isText ? nothing : this.renderBscToggles()}
        ${this.errorMessage
          ? html`<p class="error" data-testid="modal-error">
              ${this.errorMessage}
            </p>`
          : nothing}
        <div class="actions">
          <button
            class="btn"
            type="button"
            data-testid="modal-back"
            @click=${this.backToPicker}
          >
            Back
          </button>
          <button
            class="btn"
            type="button"
            data-testid="modal-cancel"
            @click=${this.cancel}
          >
            Cancel
          </button>
          <button
            class="btn btn--primary"
            type="submit"
            data-testid="modal-confirm"
            ?disabled=${!this.canConfirm()}
          >
            Confirm
          </button>
        </div>
      </form>
    `;
  }

  private renderUnitField() {
    return html`
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
    `;
  }

  /**
   * SPEC §17.13 — every BSC must boot with at least one `TimestampedValue`
   * in its history; otherwise `currentValue()` would throw on the very
   * first read. The kiosk collects that seed measurement here.
   */
  private renderBscCurrentValueFields() {
    return html`
      <div class="field-row">
        <div class="field">
          <input
            data-testid="field-current-value"
            type="number"
            placeholder="Current value — e.g. 42"
            .value=${this.currentValue}
            required
            @input=${(e: Event) => this.bindString(e, "currentValue")}
          />
        </div>
        <div class="field">
          <input
            data-testid="field-current-value-date"
            type="date"
            placeholder="As of — e.g. 2026-04-30 (today)"
            .value=${this.currentValueDate}
            required
            @input=${(e: Event) => this.bindString(e, "currentValueDate")}
          />
        </div>
      </div>
    `;
  }

  /**
   * SPEC §17.14 — TextNode mirror of the BSC seed contract: every fresh
   * TextNode must boot with at least one `TimestampedValue<string>` so
   * `currentValue()` returns the displayed text instead of throwing.
   * Uses a `textarea` because text-typed values are typically richer
   * than a single line (notes, summaries, headlines).
   */
  private renderTextCurrentValueFields() {
    return html`
      <div class="field">
        <textarea
          data-testid="field-current-value"
          placeholder="Current value — e.g. The team shipped the v2 dashboard."
          rows="3"
          .value=${this.currentValue}
          required
          @input=${(e: Event) => this.bindString(e, "currentValue")}
        ></textarea>
      </div>
      <div class="field-row">
        <div class="field">
          <input
            data-testid="field-current-value-date"
            type="date"
            placeholder="As of — e.g. 2026-04-30 (today)"
            .value=${this.currentValueDate}
            required
            @input=${(e: Event) => this.bindString(e, "currentValueDate")}
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

  private pickKind(kind: AddChildKind): void {
    this.chosenKind = kind;
    this.step = "fill-form";
  }

  private backToPicker = (): void => {
    this.step = "pick-kind";
    this.errorMessage = null;
  };

  private cancel = (): void => {
    this.dispatchEvent(
      new CustomEvent(ADD_CHILD_CANCEL_EVENT, {
        bubbles: true,
        composed: true,
      }),
    );
  };

  private handleSubmit = (e: Event): void => {
    e.preventDefault();
    this.confirm();
  };

  private confirm(): void {
    const payload = this.buildPayload();
    if (!payload) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<AddChildConfirmDetail>(ADD_CHILD_CONFIRM_EVENT, {
        bubbles: true,
        composed: true,
        detail: { parentId: this.parentId, payload },
      }),
    );
  }

  private buildPayload(): AddChildPayload | null {
    const title = this.formTitle.trim();
    if (!title) {
      return null;
    }
    const description = this.description.trim() || undefined;
    const weight = this.weight.trim() === "" ? undefined : Number(this.weight);
    if (this.chosenKind === "TextNode") {
      // SPEC §17.14 — Text nodes require a seed `TimestampedValue<string>`
      // so the rendered tile has a value/timestamp instead of throwing.
      // The seed is mandatory; gating mirrors BSC's §17.13 contract.
      const currentText = this.currentValue;
      const currentAsOf = this.currentValueDate
        ? new Date(`${this.currentValueDate}T00:00:00.000Z`)
        : null;
      if (
        currentText.length === 0 ||
        currentAsOf === null ||
        Number.isNaN(currentAsOf.getTime())
      ) {
        return null;
      }
      return {
        kind: "TextNode",
        title,
        ...(description === undefined ? {} : { description }),
        ...(weight === undefined ? {} : { weight }),
        initialHistory: [{ value: currentText, asOf: currentAsOf }],
      };
    }
    if (this.chosenKind === "BusinessScoreCardNode") {
      const unit = this.unit.trim();
      const initialValue = Number(this.initialValue);
      const targetValue = Number(this.targetValue);
      const targetDate = this.targetDate
        ? new Date(`${this.targetDate}T00:00:00.000Z`)
        : null;
      // Mandatory seed for the otherwise-empty TimestampedValue history
      // (SPEC §17.13). Confirm stays disabled until both halves are filled.
      const currentValueRaw = this.currentValue.trim();
      const currentValue = Number(this.currentValue);
      const currentAsOf = this.currentValueDate
        ? new Date(`${this.currentValueDate}T00:00:00.000Z`)
        : null;
      if (
        !unit ||
        Number.isNaN(initialValue) ||
        Number.isNaN(targetValue) ||
        targetDate === null ||
        Number.isNaN(targetDate.getTime()) ||
        currentValueRaw === "" ||
        Number.isNaN(currentValue) ||
        currentAsOf === null ||
        Number.isNaN(currentAsOf.getTime())
      ) {
        return null;
      }
      return {
        kind: "BusinessScoreCardNode",
        title,
        ...(description === undefined ? {} : { description }),
        ...(weight === undefined ? {} : { weight }),
        unit,
        objective: { initialValue, targetValue, targetDate },
        computed: this.computed,
        eligibleForParentComputation: this.eligibleForParentComputation,
        initialHistory: [{ value: currentValue, asOf: currentAsOf }],
      };
    }
    return null;
  }

  private canConfirm(): boolean {
    return this.buildPayload() !== null;
  }

  private bindString(
    e: Event,
    field:
      | "formTitle"
      | "description"
      | "weight"
      | "unit"
      | "initialValue"
      | "targetValue"
      | "targetDate"
      | "currentValue"
      | "currentValueDate",
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

  private resetForm(): void {
    this.step = "pick-kind";
    this.chosenKind = null;
    this.formTitle = "";
    this.description = "";
    this.weight = "";
    this.unit = "";
    this.initialValue = "";
    this.targetValue = "";
    this.targetDate = "";
    this.currentValue = "";
    this.currentValueDate = AddChildModal.todayIsoDate();
    this.computed = false;
    this.eligibleForParentComputation = true;
    this.errorMessage = null;
  }

  /**
   * Local-calendar today, ISO `YYYY-MM-DD`. Used as the default for the
   * BSC current-value's "as of" field so the kiosk operator's most
   * common case ("we measured this today") needs zero typing. Computed
   * from `Date` rather than imported as a clock port because the modal
   * is a pure presentational element with no other domain dependencies;
   * the seam is the editable input itself, not a constructor argument.
   */
  private static todayIsoDate(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
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
    "add-child-modal": AddChildModal;
  }
  interface HTMLElementEventMap {
    "add-child-confirm": CustomEvent<AddChildConfirmDetail>;
    "add-child-cancel": CustomEvent<void>;
  }
}
