/**
 * `<add-child-modal>` — wide kiosk modal that captures the payload for
 * `AddChildService.addChild(focusedParent, payload)` (SPEC §7).
 *
 * Two-pane layout (SPEC §17.25 — was a single-column dropdown-then-form
 * pre-§17.25):
 *   1. A **kind list** on the left (~20 % of the panel width) — one
 *      vertical button per kind in `availableKinds`. Each button shows
 *      the kind's name + a one-line description. The selected button is
 *      `aria-pressed="true"` and visually highlighted. By default the
 *      list contains every kind the modal supports; a future caller can
 *      restrict it via the `availableKinds` property (the "available
 *      nodes for the current parent" hook — for now the policy is "all
 *      of them", but the seam is wired so per-parent rules can be
 *      layered on without touching the modal).
 *   2. A **type-specific form** on the right (~80 %) that appears as
 *      soon as a kind is chosen, using the empty-field placeholder
 *      pattern (§6) — every input shows `placeholder` of the form
 *      `<Field name> — e.g. <mock>` so the field's purpose is explicit
 *      AND a concrete example is visible at a glance; no `<label>`
 *      siblings on text/number/date/textarea fields. Before a kind is
 *      chosen the right pane shows a muted "Pick a card type to start"
 *      hint.
 *
 * Why a left-rail list (vs. the pre-§17.25 dropdown):
 *   - The available kinds are visible immediately — the operator
 *     doesn't have to expand a `<select>` to discover them. That's
 *     particularly relevant on a kiosk wall where a tap → list-pop
 *     interaction adds latency that a glance can absorb instead.
 *   - The list scales naturally to per-parent restriction: a future
 *     "this parent only accepts BSC children" policy hides options by
 *     omission, no greying-out gymnastics.
 *   - Adding a new kind is still a one-line append in `KIND_OPTIONS`.
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
 *   - `availableKinds` (property, no attribute) — `readonly AddChildKind[]`
 *     listing the kinds offered to the operator. Defaults to the full
 *     set declared by `KIND_OPTIONS`. If the property is set to a list
 *     that excludes the currently chosen kind, the chosen kind is
 *     reset on the next render.
 *   - dispatches a bubbling+composed `add-child-confirm`
 *     `CustomEvent<{ parentId, payload }>` when the user confirms a valid
 *     form. The composition root calls `AddChildService.addChild(...)` and
 *     closes the modal on success.
 *   - dispatches a bubbling+composed `add-child-cancel` `CustomEvent<void>`
 *     when the user cancels (Escape, Cancel button, backdrop tap).
 *
 * Close paths (all dispatch `add-child-cancel`):
 *   - **Close-X button** (top-right corner of the panel, SPEC §17.29).
 *     Glyph + hit-target supplied by `modalFrameStyles` so every modal
 *     in the app shares the same affordance.
 *   - Cancel button.
 *   - Escape key.
 *   - Tap on the backdrop (NOT inside the panel — `composedPath()` walks
 *     shadow DOM so taps inside the panel's slotted children stay inside).
 *   - Backdrop tap is enabled even with form data partially entered; the
 *     kiosk operator UX favours "easy to dismiss" over "hard to leave"
 *     because the modal never persists until Confirm.
 *
 * Layout (SPEC §17.29 — system-wide modal frame contract):
 *   - The shared `modalFrameStyles` flex-centres the panel in the
 *     viewport and caps it at `100v{w,h} - 4rem` while letting it
 *     shrink to `max-content` for smaller forms. The two-pane grid
 *     declares its own `min-width: min(40rem, 100vw - 4rem)` so the
 *     kind-list rail + form-pane stay legible on a kiosk display.
 *   - The semi-transparent backdrop (SPEC §7 — "the board is still
 *     behind") is part of the shared frame.
 *   - The modal renders **nothing** in its DOM body when `open=false`, so
 *     it has zero pointer-event surface in the at-rest state and the
 *     focused parent strip + children grid stay fully interactive.
 *
 * Defaults (mirroring `AddChildPayload` optional fields):
 *   - Text: title + a **mandatory current value** (the seed
 *     `TimestampedValue<string>` of the otherwise-empty `TextCard`
 *     history, SPEC §17.14) are required. Weight is **pre-filled with
 *     `1`** (§17.16) and stays editable through a slider + numeric
 *     input pair (§17.26): the slider runs `0..10` step `0.5` (visual,
 *     touch-friendly, full-width); the numeric input on its right
 *     mirrors the value in real time and accepts direct keyboard
 *     input. Editing either input fires `@input` and writes to the
 *     same `weight` state, so both stay synced one keystroke at a
 *     time. There is **no** description field for TextNode — by §17.15
 *     the current value (the latest entry in the `TextCard`) IS the
 *     node's description, so collecting it twice would be redundant.
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

import {
  modalFrameStyles,
  renderModalCloseX,
} from "./modalFrameStyles.js";

export const ADD_CHILD_CONFIRM_EVENT = "add-child-confirm";
export const ADD_CHILD_CANCEL_EVENT = "add-child-cancel";

/**
 * Plain-data payload the modal dispatches on confirm. v3 used to host
 * this type on `AddChildService`; §17.112 v3 sweep moved it here so the
 * modal owns its own outbound contract and main.ts's translation shim
 * `toV4AddChildPayload` consumes it from the adapter side without
 * crossing back into a (now-deleted) v3 application service.
 *
 * The shape mirrors the v3 modal contract verbatim (v3-compat 2-kind
 * union `TextNode` / `BusinessScoreCardNode`); main.ts rewrites it to
 * the v4 payload before handing off to `AddChildService`. Optional
 * fields default sensibly at the modal/service boundary (weight=1,
 * description="", computed=false, eligibleForParentComputation=true,
 * empty initial history). TextNode intentionally has no description
 * (the latest history `TimestampedValue<string>` IS the description
 * per §17.15).
 */
export type AddChildPayload =
  | {
      readonly kind: "TextNode";
      readonly title: string;
      readonly weight?: number;
      readonly initialHistory?: readonly { readonly value: string; readonly asOf: Date }[];
    }
  | {
      readonly kind: "BusinessScoreCardNode";
      readonly title: string;
      readonly description?: string;
      readonly weight?: number;
      readonly unit: string;
      readonly objective: {
        readonly initialValue: number;
        readonly targetValue: number;
        readonly targetDate: Date;
      };
      readonly computed?: boolean;
      readonly eligibleForParentComputation?: boolean;
      readonly initialHistory?: readonly { readonly value: number; readonly asOf: Date }[];
    };

export type AddChildKind = AddChildPayload["kind"];

export type AddChildConfirmDetail = {
  readonly parentId: string;
  readonly payload: AddChildPayload;
};

/**
 * Kind catalogue — kept as a static list so adding a new kind is a
 * one-line append (since §17.19, layout-agnostic since §17.25). The
 * `description` mirrors the blurb the pre-§17.19 kind-cards rendered,
 * so each list entry still tells the operator what each kind is at a
 * glance.
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
      "A note: a free-form text value (latest in its timestamped history); no \u03a3.",
  },
  {
    kind: "BusinessScoreCardNode",
    name: "Business Score Card",
    description: "A measurable: title, unit, target, history, optional \u03a3.",
  },
];

/** Default `availableKinds` — all kinds declared by {@link KIND_OPTIONS}. */
export const ALL_ADD_CHILD_KINDS: readonly AddChildKind[] = KIND_OPTIONS.map(
  (o) => o.kind,
);

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

  /**
   * Kinds offered in the left-rail list (SPEC §17.25). Defaults to the
   * full catalogue ({@link ALL_ADD_CHILD_KINDS}). A future caller can
   * narrow it per parent — e.g. `["BusinessScoreCardNode"]` to forbid
   * Text children under a metrics-only branch. Order is preserved.
   *
   * The contract is "no kind in the list ⇒ no form ⇒ Confirm disabled":
   * the `willUpdate` hook resets `chosenKind` to `null` whenever the
   * supplied list excludes the previously-chosen kind, so a parent
   * policy change mid-edit collapses the form rather than leaving a
   * stale type-specific draft hanging.
   */
  @property({ attribute: false })
  availableKinds: readonly AddChildKind[] = ALL_ADD_CHILD_KINDS;

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

  static styles = [
    modalFrameStyles,
    css`
    /* §17.25 + §17.29 -- two-pane grid layered on top of the shared
       modal frame. The shared .panel rule already supplies the
       sizing contract (max-width / max-height: viewport - 4rem,
       width / height: max-content) and the visual frame (bg, border,
       shadow). We only add the grid layout + the panel intrinsic
       minimum width -- the two-pane form needs ~min(40rem, 90vw) to
       avoid the kind-list rail collapsing under its 8rem minmax
       lower bound. minmax(8rem, ...) keeps the kind list legible on
       narrow viewports without overflowing the panel. */
    .panel {
      display: grid;
      grid-template-rows: auto 1fr;
      grid-template-columns: minmax(8rem, 20%) 1fr;
      gap: 1rem 1.25rem;
      /* Reserve top-padding for the §17.29 close-X corner button so
         a long header title can't run under its hit zone. */
      padding: 1.5rem 2rem;
      padding-right: clamp(3.5rem, 5vw, 4.25rem);
      /* §17.29 — keep the two-pane grid wide enough to read on a
         large kiosk while still respecting the shared viewport cap
         (max-width: calc(100vw - 4rem)). On a narrow viewport the
         max-width wins (CSS resolves max < min by clamping the
         min); on a wide one the min keeps the kind-list rail and
         form-pane both legible. */
      min-width: min(40rem, calc(100vw - 4rem));
      min-height: 0;
    }
    .header {
      grid-column: 1 / -1;
      grid-row: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .title-row {
      font-size: 1.25rem;
      font-weight: 600;
    }
    /* §17.25 — left rail: vertical list of kind buttons.
       overflow-y:auto so a long catalogue keeps the form pane in view. */
    .kind-list {
      grid-column: 1;
      grid-row: 2;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-height: 0;
      overflow-y: auto;
      padding-right: 0.25rem;
      border-right: 1px solid
        color-mix(in srgb, currentColor 14%, transparent);
    }
    .kind-btn {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.2rem;
      padding: 0.65rem 0.7rem;
      background: transparent;
      color: inherit;
      border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
      border-radius: 6px;
      font: inherit;
      cursor: pointer;
      text-align: left;
    }
    .kind-btn:hover,
    .kind-btn:focus-visible {
      outline: none;
      background: color-mix(in srgb, currentColor 8%, transparent);
      border-color: color-mix(in srgb, currentColor 40%, transparent);
    }
    .kind-btn[aria-pressed="true"] {
      background: color-mix(in srgb, currentColor 18%, transparent);
      border-color: color-mix(in srgb, currentColor 60%, transparent);
    }
    .kind-btn-name {
      font-weight: 600;
    }
    .kind-btn-desc {
      font-size: 0.85em;
      color: color-mix(in srgb, currentColor 65%, transparent);
      line-height: 1.3;
    }
    /* §17.25 — right pane: the form, or the empty-state hint when no
       kind is chosen yet. min-height:0 lets nested overflow:auto work
       inside a grid track. */
    .form-pane {
      grid-column: 2;
      grid-row: 2;
      min-height: 0;
      overflow-y: auto;
      padding-left: 0.25rem;
    }
    .form-empty {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      color: color-mix(in srgb, currentColor 55%, transparent);
      font-style: italic;
      padding: 2rem 1rem;
      box-sizing: border-box;
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
    /* §17.26 — weight is a slider + numeric input pair so the kiosk
       operator can either drag (touch-friendly) or type (precise). The
       slider is the visual axis (full-width); the numeric input is a
       narrow companion that mirrors the value in real time. The slider
       opts out of the global input styling above so it does not pick
       up the 100 %% width / padded background that suits text fields.
       Heads-up: input[type=range] has higher specificity than the bare
       input selector, so its values win for the conflicting properties
       without needing !important or selector contortions. */
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
    if (changed.has("open") && this.open) {
      this.resetForm();
    }
    // §17.25 — if the available-kinds list narrows mid-edit and the
    // current pick falls outside it, drop the pick so the form
    // collapses to the "no kind" state. Confirm gating (canConfirm)
    // already returns false for `chosenKind === null`.
    if (
      changed.has("availableKinds") &&
      this.chosenKind !== null &&
      !this.availableKinds.includes(this.chosenKind)
    ) {
      this.chosenKind = null;
      this.errorMessage = null;
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
        ${renderModalCloseX(this.cancel)}
        <header class="header">
          <span class="title-row" id="add-child-modal-title"
            >Add a child to the focused node</span
          >
        </header>
        ${this.renderKindList()}
        <div class="form-pane">${this.renderFormPane()}</div>
      </div>
    `;
  }

  /**
   * SPEC §17.25 — left-rail kind picker: one button per kind in
   * `availableKinds`, each showing the kind's name and a one-line
   * description. The selected button is `aria-pressed="true"` so e2e /
   * AT can read the current pick without relying on CSS state. Picking
   * a kind populates the right pane with the corresponding form.
   */
  private renderKindList() {
    const visible = KIND_OPTIONS.filter((opt) =>
      this.availableKinds.includes(opt.kind),
    );
    return html`
      <div
        class="kind-list"
        data-testid="kind-list"
        role="group"
        aria-labelledby="add-child-modal-title"
      >
        ${visible.map(
          (opt) => html`
            <button
              class="kind-btn"
              type="button"
              data-testid="kind-btn"
              data-kind=${opt.kind}
              aria-pressed=${this.chosenKind === opt.kind ? "true" : "false"}
              @click=${() => this.pickKind(opt.kind)}
            >
              <span class="kind-btn-name">${opt.name}</span>
              <span class="kind-btn-desc">${opt.description}</span>
            </button>
          `,
        )}
      </div>
    `;
  }

  /**
   * Right-pane content. The body switches between an empty-state hint
   * (no kind chosen) and the type-specific form, but the actions row
   * (Cancel + Confirm) is rendered in both cases so the operator can
   * always back out — `<add-child-cancel>` doesn't need a kind picked
   * to fire, and pre-§17.25 the Cancel button was always available
   * (the form root rendered before the kind was chosen). Confirm is
   * disabled until `canConfirm()` returns true; with no kind chosen
   * that's never, so the gate is preserved.
   */
  private renderFormPane() {
    const body =
      this.chosenKind === null
        ? html`<p class="form-empty" data-testid="form-empty">
            Pick a card type on the left to start.
          </p>`
        : this.renderForm();
    return html`
      ${body}
      <div class="actions" data-testid="modal-actions">
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
          type="button"
          data-testid="modal-confirm"
          ?disabled=${!this.canConfirm()}
          @click=${this.confirm}
        >
          Confirm
        </button>
      </div>
    `;
  }

  private renderForm() {
    const isText = this.chosenKind === "TextNode";
    const isBsc = this.chosenKind === "BusinessScoreCardNode";
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
        ${isText ? this.renderTextCurrentValueFields() : nothing}
        ${isBsc ? this.renderBscCurrentValueFields() : nothing}
        ${isBsc ? this.renderObjectiveFields() : nothing}
        ${isBsc ? this.renderBscToggles() : nothing}
        ${this.errorMessage
          ? html`<p class="error" data-testid="modal-error">
              ${this.errorMessage}
            </p>`
          : nothing}
      </form>
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

  /**
   * SPEC §17.25 — pick a kind from the left-rail list. Switching kind
   * mid-edit clears the inline error (it referred to the previous
   * kind's payload) but otherwise leaves the in-flight values alone.
   * The two kinds share enough fields (title, weight, current-value,
   * current-value-date) that the operator's typing is rarely wasted;
   * type-specific fields that aren't part of the new kind simply stop
   * rendering.
   */
  private pickKind(kind: AddChildKind): void {
    if (!this.availableKinds.includes(kind)) {
      return;
    }
    this.chosenKind = kind;
    this.errorMessage = null;
  }

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

  private confirm = (): void => {
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
  };

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
    // chosen kind + the field state. SPEC §17.25 — the left-rail list
    // un-highlights (no aria-pressed=true), the right pane shows the
    // empty-state hint, and Confirm stays disabled.
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
