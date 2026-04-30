/**
 * `<add-child-modal>` — wide kiosk modal that captures the payload for
 * `AddChildService.addChild(focusedParent, payload)` (SPEC §7).
 *
 * Single-page flow (SPEC §17.19 — was a two-step flow pre-§17.19):
 *   1. A **kind dropdown** at the top of the panel. Each `<option>`
 *      shows `Name — Description` so the kind's purpose is visible
 *      from the picker alone (same content the pre-§17.19 kind-cards
 *      carried, just in `<select>` form). The first option is a
 *      placeholder ("Select a card type — …") that disables Confirm
 *      until a real kind is picked, mirroring the empty-field
 *      placeholder pattern (§6) for the rest of the form.
 *   2. A **type-specific form** that appears dynamically beneath the
 *      dropdown as soon as a kind is chosen — empty-field placeholder
 *      pattern (§6) — every input shows `placeholder` of the form
 *      `<Field name> — e.g. <mock>` so the field's purpose is explicit
 *      AND a concrete example is visible at a glance; no `<label>`
 *      siblings on text/number/date/textarea fields.
 *
 * Why a dropdown (vs. the pre-§17.19 two-card picker):
 *   - Collapses the modal into a single screen — the operator sees
 *     the chosen kind AND its form on the same page, which makes
 *     "switching kind mid-edit" a one-click change instead of a
 *     Back-button round-trip.
 *   - The `<select>` is keyboard-native (arrow keys, type-ahead) so
 *     the kiosk works the same with a touch screen, mouse, or
 *     plugged-in keyboard.
 *   - Adding a new kind in the future is a one-line `<option>`
 *     append — extensibility is built into the standard control
 *     instead of needing a layout tweak.
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
 *     history, SPEC §17.14) are required. Weight is **pre-filled with
 *     `1`** (§17.16) and stays editable. There is **no** description
 *     field for TextNode — by §17.15 the current value (the latest
 *     entry in the `TextCard`) IS the node's description, so collecting
 *     it twice would be redundant.
 *   - BusinessScoreCard: title + unit + objective + a **mandatory current
 *     value** (the seed `TimestampedValue<number>` of the otherwise-empty
 *     `BusinessScoreCard` history, SPEC §17.13) are all required;
 *     description optional, weight pre-filled with `1` (§17.16),
 *     computed default false, eligibleForParentComputation default
 *     true. Per §17.16 the BSC current-value row lays out **current
 *     value, unit, and as-of date on the same line** (cognitively a
 *     unit — the seed observation). The "as of" date for both kinds
 *     defaults to **today** (the kiosk operator's local calendar day,
 *     ISO `YYYY-MM-DD`) and stays editable — most field uses record
 *     "what we measured today", but back-filling a past observation
 *     must remain trivial.
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

/**
 * Dropdown options — kept as a static list so adding a new kind is a
 * one-line append (SPEC §17.19). The `description` mirrors the blurb
 * the pre-§17.19 kind-cards rendered, so the dropdown still tells the
 * operator what each kind is at a glance.
 */
type KindOption = {
  readonly kind: AddChildKind;
  readonly name: string;
  readonly description: string;
};

const KIND_OPTIONS: readonly KindOption[] = [
  {
    kind: "TextNode",
    name: "Text",
    description:
      "A note: a free-form text value (latest in its timestamped history); no Σ.",
  },
  {
    kind: "BusinessScoreCardNode",
    name: "Business Score Card",
    description: "A measurable: title, unit, target, history, optional Σ.",
  },
];

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
       legible at a glance. The kind <select> (SPEC §17.19 dropdown)
       inherits the same visual treatment so it sits in the form like any
       other input. */
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
    /* The placeholder option (value="") renders muted/italic to mirror
       the empty-field placeholder treatment on the surrounding inputs
       (SPEC §6 + §17.19). When a real kind is chosen the select reads
       upright/vivid like a filled input. */
    select.is-empty {
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
      >
        <header class="header">
          <span class="title-row" id="add-child-modal-title"
            >Add a child to the focused node</span
          >
        </header>
        ${this.renderForm()}
      </div>
    `;
  }

  private renderForm() {
    const isText = this.chosenKind === "TextNode";
    const isBsc = this.chosenKind === "BusinessScoreCardNode";
    const kindChosen = this.chosenKind !== null;
    return html`
      <form
        data-testid="modal-form"
        data-kind=${this.chosenKind ?? ""}
        ?data-error=${this.errorMessage !== null}
        @submit=${this.handleSubmit}
      >
        ${this.renderKindSelect()}
        ${kindChosen
          ? html`
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
            `
          : nothing}
        ${isBsc ? this.renderDescriptionField() : nothing}
        ${kindChosen
          ? html`
              <div class="field-row" data-testid="weight-row">
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
              </div>
            `
          : nothing}
        ${isText ? this.renderTextCurrentValueFields() : nothing}
        ${isBsc ? this.renderBscCurrentValueFields() : nothing}
        ${isBsc ? this.renderObjectiveFields() : nothing}
        ${isBsc ? this.renderBscToggles() : nothing}
        ${this.errorMessage
          ? html`<p class="error" data-testid="modal-error">
              ${this.errorMessage}
            </p>`
          : nothing}
        <div class="actions">
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

  /**
   * SPEC §17.19 — the kind picker is a single `<select>` at the top
   * of the form. The first `<option>` is a placeholder ("Select a
   * card type — …") that mirrors the empty-field placeholder pattern
   * (§6) for the rest of the form: while it's selected, no
   * type-specific fields render and Confirm stays disabled. Each
   * real `<option>` shows `Name — Description` so the operator sees
   * what the kind is at a glance, same content as the pre-§17.19
   * kind-cards carried.
   */
  private renderKindSelect() {
    const empty = this.chosenKind === null;
    return html`
      <div class="field" data-testid="kind-row">
        <select
          data-testid="kind-select"
          class=${empty ? "is-empty" : ""}
          .value=${this.chosenKind ?? ""}
          required
          @change=${this.handleKindChange}
        >
          <option value="" disabled .selected=${empty}>
            Card type — e.g. Text, Business Score Card
          </option>
          ${KIND_OPTIONS.map(
            (opt) => html`
              <option
                value=${opt.kind}
                data-kind=${opt.kind}
                .selected=${this.chosenKind === opt.kind}
              >
                ${opt.name} — ${opt.description}
              </option>
            `,
          )}
        </select>
      </div>
    `;
  }

  /**
   * SPEC §17.15 — only `BusinessScoreCardNode` carries a meaningful
   * description (the metric's definition: "Quarterly revenue across the
   * EU-North region; sourced from the BI data warehouse."). For
   * `TextNode` the current value IS the description, so this field is
   * rendered only on the BSC branch.
   */
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
   * SPEC §17.13 — every BSC must boot with at least one `TimestampedValue`
   * in its history; otherwise `currentValue()` would throw on the very
   * first read. The kiosk collects that seed measurement here.
   *
   * SPEC §17.16 — the row deliberately lays out **current value, unit,
   * and as-of date on the same line**: those three pieces together
   * describe a single measurement (the seed observation) and are
   * cognitively a unit. Putting them side-by-side reduces eye-travel for
   * the kiosk operator entering "42 % as of today".
   */
  private renderBscCurrentValueFields() {
    return html`
      <div class="field-row" data-testid="current-value-row">
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
            data-testid="field-unit"
            type="text"
            placeholder='Unit — e.g. "%" or "M€"'
            .value=${this.unit}
            required
            @input=${(e: Event) => this.bindString(e, "unit")}
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

  private handleKindChange = (e: Event): void => {
    const target = e.target as HTMLSelectElement;
    const value = target.value;
    if (value === "TextNode" || value === "BusinessScoreCardNode") {
      // SPEC §17.19 — switching kind mid-edit clears the inline error
      // (it referred to the previous kind's payload) but otherwise
      // leaves the in-flight values alone. The two kinds share enough
      // fields (title, weight, current-value, current-value-date) that
      // the operator's typing is rarely wasted; type-specific fields
      // that aren't part of the new kind simply stop rendering.
      this.chosenKind = value;
      this.errorMessage = null;
    } else {
      this.chosenKind = null;
    }
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
      // SPEC §17.15 — the current value IS the TextNode's description, so
      // the form deliberately omits a separate description field. The
      // payload reflects that: no `description` key here.
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
    // SPEC §17.19 — single-page flow: no `step` to reset, just the
    // chosen kind + the field state. The dropdown reverts to the
    // placeholder option (`chosenKind === null`), the form below
    // disappears, and the next render shows just the picker.
    this.chosenKind = null;
    this.formTitle = "";
    this.description = "";
    // SPEC §17.16 — `weight` is pre-filled with the default value `"1"`
    // (matching the placeholder example AND the service-side fallback in
    // `AddChildService.buildNode`). The vast majority of nodes carry the
    // default weight; pre-filling saves the operator a tap and removes a
    // "do I need to type 1?" hesitation. It stays editable for the rare
    // case where a child should weigh more (or less) than its siblings.
    this.weight = "1";
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
