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
 * Defaults (mirroring `AddChildModalPayload` optional fields):
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
 *     description optional, weight pre-filled with `1` (§17.16). The
 *     v3-era `computed` + `eligibleForParentComputation` checkboxes
 *     retired post-§17.99b/c: a "computed BSC" is now created by
 *     picking the future `Computed` / `ComputedBusinessScore` kind
 *     rather than ticking a flag on a regular BSC; "eligibility" is
 *     a per-node `disabled` toggle owned by the (forthcoming) edit
 *     modal, not by the add-child modal. Per §17.16 the BSC current-
 *     value row lays out **current value, unit, and as-of date on the
 *     same line** (cognitively a unit — the seed observation). The
 *     "as of" date for both kinds
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

import { ComputationKind } from "../../../domain/computation/ComputationKind.js";
import type { WorkflowStatus } from "../../../domain/values/WorkflowStatus.js";
import { DEFAULT_WORKFLOW_STATUSES } from "../../../domain/values/WorkflowStatus.js";

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
 * `toAppAddChildPayload` consumes it from the adapter side without
 * crossing back into a (now-deleted) v3 application service.
 *
 * The shape mirrors the v3 modal contract verbatim (v3-compat 2-kind
 * union `TextNode` / `BusinessScoreCardNode`); main.ts rewrites it to
 * the application's 5-kind `AddChildPayload` before handing off to
 * `AddChildService`. Renamed `AddChildPayload` → `AddChildModalPayload`
 * at §17.114-followup-payloads to free the unsuffixed canonical name
 * for the application-layer payload (the modal layer's shape is the
 * v3-compat 2-kind union it has always been; the round-7 leaf kinds
 * land on the application side first and reach the modal in a future
 * UI strand). Optional fields default sensibly at the modal/service
 * boundary (weight=1, description="", empty initial history). The v3
 * `computed` + `eligibleForParentComputation` flags retired post-
 * §17.99b/c — see the class docblock above. TextNode intentionally
 * has no description (the latest history `TimestampedValue<string>`
 * IS the description per §17.15).
 */
export type AddChildModalPayload =
  | {
      readonly kind: "TextNode";
      readonly title: string;
      readonly weight?: number;
      readonly initialHistory?: readonly { readonly value: string; readonly asOf: Date }[];
    }
  | {
      readonly kind: "Workflow";
      readonly title: string;
      readonly weight?: number;
      readonly statusId: string;
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
      readonly initialHistory?: readonly { readonly value: number; readonly asOf: Date }[];
    }
  /**
   * SPEC §17.77 / §17.94 — `StrictRangeNode<number>` variant. A
   * historicised value-must-stay-within-range node (range is
   * structural, not edit-time mutable). No objective + no unit:
   * the operator collects title + optional description + weight +
   * `min` + `max` + a mandatory seed `TimestampedValue<number>`
   * (current value + as-of date) so the freshly attached node
   * boots with a non-empty history (`currentValue()` would
   * otherwise throw `EmptyHistoryError`). main.ts's
   * `toAppAddChildPayload` rewrites the modal-side
   * `"StrictRangeNode"` kind tag to the application-layer
   * `"StrictRange"` (parity with the BSC / Picture / URL kind
   * rewrites).
   */
  | {
      readonly kind: "StrictRangeNode";
      readonly title: string;
      readonly description?: string;
      readonly weight?: number;
      readonly min: number;
      readonly max: number;
      readonly initialHistory?: readonly { readonly value: number; readonly asOf: Date }[];
    }
  /**
   * SPEC §17.94 / §17.95 — `ComputedNode<number>` variant. A node
   * whose current value is **derived** from its eligible children
   * via a `Computation<T>` strategy (Sum / Average / Min / Max /
   * WeightedAverage / Count). The operator picks one of the six
   * `ComputationKind` inhabitants at create-time; no seed history
   * + no objective + no unit + no range — the children + the
   * strategy carry every piece of information. main.ts's
   * `toAppAddChildPayload` rewrites the modal-side `"ComputedNode"`
   * kind tag to the application-layer `"Computed"` (parity with
   * the BSC / StrictRange / Picture / URL kind rewrites).
   */
  | {
      readonly kind: "ComputedNode";
      readonly title: string;
      readonly description?: string;
      readonly weight?: number;
      readonly computationKind: ComputationKind;
    }
  /**
   * SPEC §17.119 — `PictureNode` variant. A snapshot leaf carrying a
   * single image URL: no description (the title labels the picture,
   * the picture IS the content), no objective row, no
   * `initialHistory` (the domain inherits from `ValueNode<string>`,
   * not `HistorizableValueNode<string>`). The modal collects title +
   * weight + imageUrl and that is the full surface. main.ts's
   * `toAppAddChildPayload` rewrites the modal-side `"PictureNode"`
   * kind tag to the application-layer `"Picture"` kind tag before
   * handing off to `AddChildService`.
   */
  | {
      readonly kind: "PictureNode";
      readonly title: string;
      readonly weight?: number;
      readonly imageUrl: string;
    }
  /**
   * SPEC §17.120 — `URLNode` variant. A snapshot leaf carrying a
   * single URL that the view layer renders as a QR code (the URL
   * lives in the inherited description slot per the operator's "the
   * URL is in the description" contract). The modal collects title
   * + weight + url and that is the full surface (no separate
   * description field — entering the URL IS entering the
   * description). main.ts's `toAppAddChildPayload` rewrites the
   * modal-side `"URLNode"` kind tag to the application-layer
   * `"URL"` kind tag before handing off to `AddChildService`.
   * Parity with the §17.119 PictureNode kind-tag rewrite.
   */
  | {
      readonly kind: "URLNode";
      readonly title: string;
      readonly weight?: number;
      readonly url: string;
    };

export type AddChildKind = AddChildModalPayload["kind"];

export type AddChildConfirmDetail = {
  readonly parentId: string;
  readonly payload: AddChildModalPayload;
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
    kind: "Workflow",
    name: "Workflow",
    description:
      "A note plus a board-level status badge (PLAN / DO / CHECK / ACT by default).",
  },
  {
    kind: "BusinessScoreCardNode",
    name: "Business Score Card",
    description: "A measurable: title, unit, target, history, optional \u03a3.",
  },
  {
    kind: "StrictRangeNode",
    name: "Strict Range",
    description:
      "A bounded metric: title, min/max range, current value with history; out-of-range values are rejected.",
  },
  {
    kind: "ComputedNode",
    name: "Computed",
    description:
      "A derived metric: title + a strategy (Sum / Average / Min / Max / Weighted Avg / Count). Value comes from eligible children.",
  },
  {
    kind: "PictureNode",
    name: "Picture",
    description:
      "An image: a title + an image URL (object-fit: cover); shows a warning glyph on load failure.",
  },
  {
    kind: "URLNode",
    name: "URL",
    description:
      "A QR code: a title + a URL the kiosk renders as a scannable QR (object-fit: contain); shows a warning glyph on generation failure.",
  },
];

/** Default `availableKinds` — all kinds declared by {@link KIND_OPTIONS}. */
export const ALL_ADD_CHILD_KINDS: readonly AddChildKind[] = KIND_OPTIONS.map(
  (o) => o.kind,
);

/**
 * SPEC §17.94 / §17.95 — UI-friendly labels for the six
 * `ComputationKind` inhabitants. Keyed by `ComputationKind.name`
 * (the canonical SCREAMING_SNAKE_CASE persisted by `jsonCodecV4`)
 * so a missing entry falls back to the raw enum name without
 * crashing the dropdown. Exported for the EditNodeModal +
 * focused-panel views which surface the same picker (the future
 * `computation-kind-change` UI mentioned in §17.110).
 */
export const COMPUTATION_KIND_LABELS: Readonly<Record<string, string>> = {
  SUM: "Sum (Σ children)",
  AVERAGE: "Average (mean of children)",
  MIN: "Min (smallest child)",
  MAX: "Max (largest child)",
  WEIGHTED_AVERAGE: "Weighted average (by child weight)",
  COUNT: "Count (number of eligible children)",
};

/**
 * Parse a `YYYY-MM-DD` value from a native `<input type="date">` into
 * a UTC midnight `Date`. Returns `null` when the input is empty / the
 * parsed timestamp is NaN — the modal's gating predicates treat both
 * as "field not yet filled" so Confirm stays disabled.
 */
function parseIsoDateInput(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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

  /**
   * Catalogue of workflow statuses offered by the `Workflow` form, sourced
   * from `Board.workflowStatuses` (SPEC §17.118). The composition root sets
   * this whenever the active board changes so the dropdown always reflects
   * the current board's status table (PDCA defaults out of the box; arbitrary
   * once per-board configuration ships).
   *
   * Defaulted to {@link DEFAULT_WORKFLOW_STATUSES} so unit tests that mount
   * the modal in isolation still render a usable Workflow form without the
   * caller having to mirror the seed.
   */
  @property({ attribute: false })
  workflowStatuses: readonly WorkflowStatus[] = DEFAULT_WORKFLOW_STATUSES;

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

  /**
   * SPEC §17.77 — lower bound for the StrictRange kind. Kept as a
   * raw `string` (the underlying input is `type="number"` but Lit
   * binds via `value`); the build-payload helper coerces with
   * `Number(...)` and gates on `Number.isNaN`.
   */
  @state()
  private rangeMin = "";

  /** SPEC §17.77 — upper bound for the StrictRange kind. */
  @state()
  private rangeMax = "";

  /**
   * SPEC §17.94 / §17.95 — selected `ComputationKind.name` for the
   * Computed (and forthcoming ComputedBusinessScore) kinds. Stored
   * as the string name (matching the `<select>` value) and resolved
   * back to the singleton via `ComputationKind.fromName` at
   * payload-build time. Defaults to `"AVERAGE"` — the most common
   * choice for a generic computed roll-up (matches the §17.99c
   * bridge default the v3-compat layer used to pick when an
   * operator ticked the legacy `computed:true` checkbox).
   */
  @state()
  private computationKindName = ComputationKind.AVERAGE.name;

  /**
   * SPEC §17.119 — image URL for the Picture kind. A plain string;
   * the domain (`PictureNode`) validates "non-empty after trim" and
   * the browser is the authoritative URL validator (the `<img>`
   * tag's `error` event drives the warning fallback). The modal
   * gates Confirm on "non-empty after trim" to match the domain's
   * minimum contract.
   */
  @state()
  private imageUrl = "";

  /**
   * Currently selected `WorkflowStatus.id` for the `Workflow` form
   * (SPEC §17.118). Empty string ⇒ no status picked ⇒ Confirm stays
   * disabled. `resetForm` seeds it with the first available status's id
   * so the most common path ("accept the default") is zero-tap.
   */
  @state()
  private statusId = "";

  /**
   * SPEC §17.120 — URL for the URL kind. A plain string; the domain
   * (`URLNode`) validates "non-empty after trim" and the qrcode
   * library is the authoritative validator for "can I encode this
   * as a QR" (extremely long payloads exceed the library's max
   * bit-density and trigger the warning-fill fallback at render
   * time). The modal gates Confirm on "non-empty after trim" to
   * match the domain's minimum contract — same predicate as
   * `imageUrl` for the Picture kind. The URL accepts any non-empty
   * string (https:, mailto:, tel:, custom schemes, plain text); we
   * intentionally do NOT enforce a stricter shape here because the
   * qrcode library encodes arbitrary text and scanners surface
   * non-URL payloads as plain text — restricting at the modal
   * would block legitimate kiosk use cases (e.g. a QR that
   * scanners interpret as a wifi-credential payload).
   */
  @state()
  private url = "";

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
    /* §17.118 -- option inherits the OS-level dropdown styling, but
       Chrome on dark backgrounds drops light-on-light text in the open
       popup. Forcing color-scheme: light dark (and a sane base color
       on the options themselves) keeps the picker readable in both
       light and dark theme without re-implementing the dropdown. */
    select {
      color-scheme: light dark;
      appearance: auto;
    }
    select option {
      color: black;
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
    // SPEC §17.118 — mirror the `availableKinds` narrowing policy for
    // the workflow-status catalogue: if the active board's status table
    // shrinks mid-edit and the operator's pick falls outside the new
    // list, snap back to the first available status (or empty if none
    // remain — Confirm will stay disabled in that edge case). This
    // matters when the composition root swaps boards while the modal is
    // open; without this guard, an orphan `statusId` would be encoded
    // into the new node and rejected by the service.
    if (changed.has("workflowStatuses")) {
      const known = this.workflowStatuses.some((s) => s.id === this.statusId);
      if (!known) {
        this.statusId = this.workflowStatuses[0]?.id ?? "";
      }
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
    const isWorkflow = this.chosenKind === "Workflow";
    const isBsc = this.chosenKind === "BusinessScoreCardNode";
    const isPicture = this.chosenKind === "PictureNode";
    const isStrictRange = this.chosenKind === "StrictRangeNode";
    const isComputed = this.chosenKind === "ComputedNode";
    const isTextOrWorkflow = isText || isWorkflow;
    const isUrl = this.chosenKind === "URLNode";
    // SPEC §17.94 — kinds that carry an operator-editable description
    // textarea: BSC, StrictRange, and the round-7 Computed roll-up.
    // (Picture / URL inherit description from the URL slot; Text /
    // Workflow are typed by the latest history entry.)
    const wantsDescription = isBsc || isStrictRange || isComputed;
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
        ${wantsDescription ? this.renderDescriptionField() : nothing}
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
        ${isWorkflow ? this.renderWorkflowStatusField() : nothing}
        ${isTextOrWorkflow ? this.renderTextCurrentValueFields() : nothing}
        ${isBsc ? this.renderBscCurrentValueFields() : nothing}
        ${isBsc ? this.renderObjectiveFields() : nothing}
        ${isStrictRange ? this.renderStrictRangeFields() : nothing}
        ${isComputed ? this.renderComputationKindField() : nothing}
        ${isPicture ? this.renderPictureFields() : nothing}
        ${isUrl ? this.renderURLFields() : nothing}
        ${this.errorMessage
          ? html`<p class="error" data-testid="modal-error">
              ${this.errorMessage}
            </p>`
          : nothing}
      </form>
    `;
  }

  /**
   * SPEC §17.119 — single-field picture form: just the image URL.
   * `type="url"` triggers the platform's URL keyboard on mobile /
   * touch kiosks and adds a soft client-side validation hint, but
   * the gating predicate (`buildPicturePayload`) is the canonical
   * "non-empty after trim" check — the field accepts `data:` and
   * `blob:` URLs that the browser's strict URL validator would
   * reject. The domain validates the same way (trim non-empty) and
   * the `<img>`'s `error` event is the load-time validator.
   */
  /**
   * SPEC §17.120 — single-field URL form: just the URL. The URL ends
   * up in the description slot per the operator's "URL is in the
   * description" contract, but the modal exposes it as a `url`
   * field for clarity ("Description: https://..." would read worse
   * to a kiosk operator than "URL: https://..."). `type="url"`
   * triggers the platform's URL keyboard on mobile / touch kiosks
   * and adds a soft client-side validation hint, but the gating
   * predicate (`buildURLPayload`) is the canonical "non-empty after
   * trim" check — the field accepts `mailto:`, `tel:`, custom
   * schemes, and even plain text that the browser's strict URL
   * validator would reject. The domain validates the same way
   * (trim non-empty) and the qrcode library is the authoritative
   * "can I encode this" validator.
   */
  private renderURLFields() {
    return html`
      <div class="field" data-testid="url-row">
        <input
          type="url"
          data-testid="modal-url"
          placeholder='URL — e.g. "https://example.com/docs"'
          .value=${this.url}
          required
          @input=${(e: Event) => this.bindString(e, "url")}
        />
      </div>
    `;
  }

  private renderPictureFields() {
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
   * SPEC §17.77 / §17.94 — Strict-range form: bounds row (min + max)
   * + a seed-observation row (current value + as-of date) mirroring
   * the BSC seed contract (every fresh historicised value-node must
   * boot with at least one `TimestampedValue<number>` so
   * `currentValue()` returns a value instead of throwing
   * `EmptyHistoryError`). No unit + no objective: a StrictRange
   * scores nothing, it just keeps measurements within bounds. The
   * domain rejects out-of-range seed values via
   * `StrictRange.requireValue` → `OutOfRangeError`, which the modal
   * surfaces through the existing form-error path; gating Confirm
   * on (`min < max`, finite numbers, current value finite, as-of
   * date parses) catches the obvious operator slips before the
   * service throws.
   */
  private renderStrictRangeFields() {
    return html`
      <div class="field-row" data-testid="range-row">
        <div class="field">
          <input
            data-testid="field-range-min"
            type="number"
            placeholder="Range min — e.g. 0"
            .value=${this.rangeMin}
            required
            @input=${(e: Event) => this.bindString(e, "rangeMin")}
          />
        </div>
        <div class="field">
          <input
            data-testid="field-range-max"
            type="number"
            placeholder="Range max — e.g. 100"
            .value=${this.rangeMax}
            required
            @input=${(e: Event) => this.bindString(e, "rangeMax")}
          />
        </div>
      </div>
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
   * SPEC §17.94 / §17.95 — strategy dropdown shared between the
   * `ComputedNode` and (forthcoming) `ComputedBusinessScoreNode`
   * forms. Lists the six `ComputationKind.ALL` inhabitants by
   * their canonical `name` (matches the JSON wire format produced
   * by `jsonCodecV4` per §17.106b), with a friendly UI label
   * resolved through `COMPUTATION_KIND_LABELS`. Pre-selected via
   * the `computationKindName` `@state` (defaults to `"AVERAGE"`),
   * editable through the `change` event. Native `<select>` mirrors
   * the Workflow-status picker pattern (§17.118): lightweight,
   * OS-familiar, no custom radio rail to maintain.
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

  /**
   * SPEC §17.118 — the Workflow form gates Confirm on a chosen status:
   * the badge IS the card's reason for existing (Plan/Do/Check/Act
   * etc.), so the dropdown is `required` and the operator must pick
   * one. The list is sourced from {@link workflowStatuses} (the active
   * Board's status table); `resetForm` pre-selects the first entry so
   * the most common path is zero-tap.
   *
   * A native `<select>` (rather than a custom radio rail) keeps the
   * kiosk modal lightweight and gives the operator the OS-level
   * picker that's already familiar.
   */
  private renderWorkflowStatusField() {
    return html`
      <div class="field">
        <select
          data-testid="field-status"
          required
          .value=${this.statusId}
          @change=${(e: Event) => this.bindString(e, "statusId")}
        >
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

  private buildPayload(): AddChildModalPayload | null {
    const title = this.formTitle.trim();
    if (!title) return null;
    const weight = this.weight.trim() === "" ? undefined : Number(this.weight);
    if (this.chosenKind === "TextNode") {
      return this.buildTextNodePayload(title, weight);
    }
    if (this.chosenKind === "Workflow") {
      return this.buildWorkflowPayload(title, weight);
    }
    if (this.chosenKind === "BusinessScoreCardNode") {
      const description = this.description.trim() || undefined;
      return this.buildBscPayload(title, description, weight);
    }
    if (this.chosenKind === "StrictRangeNode") {
      const description = this.description.trim() || undefined;
      return this.buildStrictRangePayload(title, description, weight);
    }
    if (this.chosenKind === "ComputedNode") {
      const description = this.description.trim() || undefined;
      return this.buildComputedPayload(title, description, weight);
    }
    if (this.chosenKind === "PictureNode") {
      return this.buildPicturePayload(title, weight);
    }
    if (this.chosenKind === "URLNode") {
      return this.buildURLPayload(title, weight);
    }
    return null;
  }

  /**
   * SPEC §17.14 + §17.15 — TextNode requires a seed
   * `TimestampedValue<string>` so the rendered tile has a value /
   * timestamp instead of throwing; the current value IS the
   * description (§17.15), so the form deliberately omits a separate
   * description field (the payload reflects that — no `description`
   * key). Returns `null` when either half of the seed is missing /
   * invalid so `canConfirm()` keeps the Confirm button disabled.
   */
  private buildTextNodePayload(title: string, weight: number | undefined): AddChildModalPayload | null {
    const currentText = this.currentValue;
    const currentAsOf = parseIsoDateInput(this.currentValueDate);
    if (currentText.length === 0 || currentAsOf === null) return null;
    return {
      kind: "TextNode",
      title,
      ...(weight === undefined ? {} : { weight }),
      initialHistory: [{ value: currentText, asOf: currentAsOf }],
    };
  }

  /**
   * SPEC §17.118 — Workflow shares the TextNode seed contract (a
   * `TimestampedValue<string>` so `currentValue()` returns the
   * displayed text instead of throwing) and adds a mandatory
   * `statusId` referencing the active Board's `workflowStatuses`
   * table. Returns `null` if any of (title / current value /
   * as-of date / statusId / known status) is missing so Confirm
   * stays disabled until the operator has supplied every required
   * piece.
   *
   * The known-status check (`workflowStatuses.find(...)`) defends
   * against a stale `statusId` lingering after a board switch
   * narrowed the catalogue — the service would reject it too, but
   * gating Confirm here means the operator gets immediate UI
   * feedback ("Confirm disabled") rather than a post-submit error.
   */
  private buildWorkflowPayload(title: string, weight: number | undefined): AddChildModalPayload | null {
    const currentText = this.currentValue;
    const currentAsOf = parseIsoDateInput(this.currentValueDate);
    if (currentText.length === 0 || currentAsOf === null) return null;
    const statusId = this.statusId.trim();
    if (statusId === "") return null;
    const known = this.workflowStatuses.some((s) => s.id === statusId);
    if (!known) return null;
    return {
      kind: "Workflow",
      title,
      ...(weight === undefined ? {} : { weight }),
      statusId,
      initialHistory: [{ value: currentText, asOf: currentAsOf }],
    };
  }

  /**
   * SPEC §17.13 — a fresh BSC needs both the objective triplet
   * (initialValue / targetValue / targetDate) AND the current-value
   * seed (currentValue / currentValueDate) before the modal can
   * dispatch. Returns `null` when any half is missing / invalid so
   * `canConfirm()` keeps the Confirm button disabled.
   */
  private buildBscPayload(
    title: string,
    description: string | undefined,
    weight: number | undefined,
  ): AddChildModalPayload | null {
    const unit = this.unit.trim();
    const initialValue = Number(this.initialValue);
    const targetValue = Number(this.targetValue);
    const targetDate = parseIsoDateInput(this.targetDate);
    const currentValueRaw = this.currentValue.trim();
    const currentValue = Number(this.currentValue);
    const currentAsOf = parseIsoDateInput(this.currentValueDate);
    if (
      !unit ||
      Number.isNaN(initialValue) || Number.isNaN(targetValue) || targetDate === null ||
      currentValueRaw === "" || Number.isNaN(currentValue) || currentAsOf === null
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
      initialHistory: [{ value: currentValue, asOf: currentAsOf }],
    };
  }

  /**
   * SPEC §17.77 / §17.94 — Strict-range payload: title + optional
   * description + weight + `min` + `max` + a mandatory seed
   * `TimestampedValue<number>`. Returns `null` when any required
   * piece (numeric bounds with `min < max`, numeric current value,
   * parseable as-of date) is missing or invalid so `canConfirm()`
   * keeps the Confirm button disabled. The application service
   * still gets the final say (`StrictRange.requireValue` may throw
   * `OutOfRangeError` for a seed value that sits at `min` exactly
   * or that crosses the bounds due to operator typos — gated here
   * only as a UI nicety).
   */
  private buildStrictRangePayload(
    title: string,
    description: string | undefined,
    weight: number | undefined,
  ): AddChildModalPayload | null {
    const min = Number(this.rangeMin);
    const max = Number(this.rangeMax);
    const currentValueRaw = this.currentValue.trim();
    const currentValue = Number(this.currentValue);
    const currentAsOf = parseIsoDateInput(this.currentValueDate);
    if (
      this.rangeMin.trim() === "" || this.rangeMax.trim() === "" ||
      Number.isNaN(min) || Number.isNaN(max) || min >= max ||
      currentValueRaw === "" || Number.isNaN(currentValue) || currentAsOf === null
    ) {
      return null;
    }
    return {
      kind: "StrictRangeNode",
      title,
      ...(description === undefined ? {} : { description }),
      ...(weight === undefined ? {} : { weight }),
      min,
      max,
      initialHistory: [{ value: currentValue, asOf: currentAsOf }],
    };
  }

  /**
   * SPEC §17.94 / §17.95 — Computed payload: title + optional
   * description + weight + a `ComputationKind`. Resolves the
   * selected dropdown string back to its singleton via
   * `ComputationKind.fromName` and returns `null` when the name
   * doesn't match one of the six inhabitants (defensive — the
   * `<select>` only offers the canonical names, but this guards
   * against a future feature that lets operators paste a stale
   * persisted value). No seed history + no objective + no unit
   * + no range — the children + the strategy own every value.
   */
  private buildComputedPayload(
    title: string,
    description: string | undefined,
    weight: number | undefined,
  ): AddChildModalPayload | null {
    const computationKind = ComputationKind.fromName(this.computationKindName);
    if (computationKind === undefined) return null;
    return {
      kind: "ComputedNode",
      title,
      ...(description === undefined ? {} : { description }),
      ...(weight === undefined ? {} : { weight }),
      computationKind,
    };
  }

  /**
   * SPEC §17.119 — Picture payload is the simplest of the three:
   * title + weight + a non-empty image URL. Returns `null` when the
   * URL is missing/blank so `canConfirm()` keeps the Confirm button
   * disabled until the operator types one. Mirrors the
   * `PictureNode.normaliseImageUrl` domain contract (non-empty
   * after trim).
   */
  private buildPicturePayload(
    title: string,
    weight: number | undefined,
  ): AddChildModalPayload | null {
    const imageUrl = this.imageUrl.trim();
    if (imageUrl.length === 0) return null;
    return {
      kind: "PictureNode",
      title,
      ...(weight === undefined ? {} : { weight }),
      imageUrl,
    };
  }

  /**
   * SPEC §17.120 — URL payload mirrors `buildPicturePayload`
   * structurally: title + weight + a non-empty URL. Returns `null`
   * when the URL is missing / blank so `canConfirm()` keeps the
   * Confirm button disabled until the operator types one. Matches
   * the `URLNode.normaliseUrl` domain contract (non-empty after
   * trim).
   */
  private buildURLPayload(
    title: string,
    weight: number | undefined,
  ): AddChildModalPayload | null {
    const url = this.url.trim();
    if (url.length === 0) return null;
    return {
      kind: "URLNode",
      title,
      ...(weight === undefined ? {} : { weight }),
      url,
    };
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
      | "currentValueDate"
      | "rangeMin"
      | "rangeMax"
      | "computationKindName"
      | "imageUrl"
      | "statusId"
      | "url",
  ): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    this[field] = target.value;
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
    this.rangeMin = "";
    this.rangeMax = "";
    // SPEC §17.94 — Computed defaults to AVERAGE (the §17.99c bridge
    // choice for v3 `computed:true` BSCs). Resetting between opens
    // means the operator sees the same default every time the modal
    // re-opens, regardless of whatever they picked last.
    this.computationKindName = ComputationKind.AVERAGE.name;
    this.imageUrl = "";
    // SPEC §17.118 — pre-select the first available workflow status so
    // the most common Workflow path ("accept the default — usually PLAN")
    // requires zero taps on the dropdown. Falls back to the empty string
    // when the catalogue is empty (Confirm stays disabled in that case;
    // the operator can't pick a status that doesn't exist).
    this.statusId = this.workflowStatuses[0]?.id ?? "";
    this.url = "";
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
