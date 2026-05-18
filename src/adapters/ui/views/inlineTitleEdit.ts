/**
 * Shared inline-title-edit primitives for the parent-strip views
 * (SPEC §17.28 + §17.50).
 *
 * The `<text-node-as-parent>` / `<workflow-node-as-parent>` /
 * `<picture-node-as-parent>` / `<url-node-as-parent>` views all
 * surface the same click-to-edit affordance on their `<h1>` title:
 *   - static h1 shows the title with a `is-editable` class + cursor flip;
 *   - clicking swaps to an `<input.title-edit>` pre-filled with the title;
 *   - Enter / blur commits via `INLINE_EDIT_TITLE_EVENT`; Escape cancels.
 *
 * Pre-extraction every view re-implemented the same CSS rules, the
 * same `renderTitle()` template, and the same `commitTitle` /
 * `handleTitleKey` / `startTitleEdit` lifecycle. Sonar (§17.116
 * gate) flagged the new-code duplication when the §17.117–§17.120
 * strands (Workflow, Picture, URL) landed three more copies; this
 * module centralises the shared surface so each per-view only owns
 * what's actually kind-specific (the body / value area below the
 * title).
 */

import { css, html, nothing, type TemplateResult } from "lit";

import {
  INLINE_EDIT_TITLE_EVENT,
  type InlineEditTitleDetail,
} from "./inlineEditEvents.js";
import { inlineEditKey } from "./inlineEditHelpers.js";

/**
 * CSS for the inline-editable title slot. Includes:
 *   - `.title` — focused-panel title sizing + §17.42 bright off-white;
 *   - `.title.is-editable` — cursor: text on the static h1 so the
 *     click target reads as editable;
 *   - `.title-edit` — the `<input>` that replaces the static h1 in
 *     edit mode, fitted to the title row's full height per §17.37 +
 *     §17.50 (subtract the strip's right gutter so the input never
 *     runs behind the close-X / edit-pencil buttons);
 *   - `.title-edit:focus` — focus styling.
 *
 * A view that wants to mix this in extends its own static styles
 * array: `static readonly styles = [tileLayoutStyles, ..., titleInlineEditStyles, css\`...\`]`.
 * Per-view CSS that lands AFTER this block can still override any
 * rule (e.g. the WorkflowNode parent role mixes in extra `.value-edit`
 * rules but reuses these title literals verbatim).
 */
export const titleInlineEditStyles = css`
  .title {
    font-size: 2.4vh;
    /* SPEC §17.42 — focused-panel title is bright off-white. */
    color: rgb(245, 245, 245);
  }
  .title.is-editable {
    cursor: text;
  }
  /* Inline title-edit input — same affordance across every parent-
     role view; a future tweak to the inline-edit visual contract
     stays a one-place change here. */
  .title-edit {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    background: color-mix(in srgb, currentColor 6%, transparent);
    color: inherit;
    border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
    border-radius: 4px;
    padding: 0 0.4rem;
    line-height: 1;
    font: inherit;
    font-size: inherit;
    font-weight: inherit;
    min-width: 0;
    /* SPEC §17.50 — clear the focused-panel close-X / edit-pencil
       buttons that overlay the title row's right end. */
    max-width: calc(100% - var(--strip-gutter-right, 0px));
  }
  .title-edit:focus {
    outline: none;
    border-color: color-mix(in srgb, currentColor 65%, transparent);
    background: color-mix(in srgb, currentColor 12%, transparent);
  }
`;

/**
 * Caller-provided surface for the inline-title-edit lifecycle. The
 * helper module is presentation-agnostic; the view owns the state
 * slot (`isEditing`) and the side effects (start editing / cancel /
 * dispatch the commit event). This keeps the helpers pure functions
 * that the view can wire to a `@state` slot through small bound
 * arrow methods.
 */
export interface InlineTitleEditTarget {
  readonly nodeId: string;
  readonly title: string;
}

/**
 * Renders the **read-only** `<h2 class="title">` block every
 * `*AsChild` tile uses. The static title is identical across the
 * snapshot-leaf tile families (Picture / URL) — only the
 * `data-view-kind` differs. Pulling it into the shared helper
 * drops the duplicate template + keeps the `data-testid="title"`
 * + `data-id=...` hooks aligned across views.
 *
 * Returns `nothing` when the view model is absent so caller
 * markup can interleave it directly via Lit's `${...}`
 * interpolation.
 */
export function renderStaticTitle(args: {
  target: InlineTitleEditTarget | null;
  viewKind: string;
}): TemplateResult | typeof nothing {
  const { target, viewKind } = args;
  if (!target) return nothing;
  return html`<h2
    class="title"
    data-testid="title"
    data-view-kind=${viewKind}
    data-id=${target.nodeId}
  >
    ${target.title}
  </h2>`;
}

/**
 * Renders the inline-editable title `<h1>` element. When
 * `isEditing` is false, emits the static title with an
 * `is-editable` class + click handler. When true, emits the
 * `<input.title-edit>` with Lit-bound keydown + blur handlers.
 *
 * `viewKind` is wired through to the `data-view-kind` attribute so
 * per-view unit tests can target the right h1 (the existing
 * fixtures rely on it and pre-date the shared helper). `nodeId`
 * lands on `data-id` for the same reason.
 */
export function renderInlineEditableTitle(args: {
  target: InlineTitleEditTarget | null;
  isEditing: boolean;
  viewKind: string;
  onStart: () => void;
  onKeydown: (e: KeyboardEvent) => void;
  onBlur: (e: FocusEvent) => void;
}): TemplateResult | typeof nothing {
  const { target, isEditing, viewKind, onStart, onKeydown, onBlur } = args;
  if (!target) return nothing;
  if (isEditing) {
    return html`<h1
      class="title"
      data-testid="title"
      data-view-kind=${viewKind}
      data-id=${target.nodeId}
    >
      <input
        class="title-edit"
        data-testid="title-edit"
        type="text"
        maxlength="120"
        .value=${target.title}
        @keydown=${onKeydown}
        @blur=${onBlur}
      />
    </h1>`;
  }
  return html`<h1
    class="title is-editable"
    data-testid="title"
    data-view-kind=${viewKind}
    data-id=${target.nodeId}
    role="button"
    tabindex="0"
    title="Click to edit title"
    @click=${onStart}
  >
    ${target.title}
  </h1>`;
}

/**
 * Decodes a keydown event on the inline title input into a
 * lifecycle intent (commit / cancel) and routes the input's
 * current value through `onCommit`. The view's `commit` slot
 * receives the trimmed value (`null` if blank) and is responsible
 * for the `INLINE_EDIT_TITLE_EVENT` dispatch via
 * {@link dispatchInlineTitleCommit}; we keep the dispatch out of
 * the keydown helper so a view that wants to e.g. log the
 * commit can intercept here.
 *
 * Returns `true` if the key was handled (and the editor should
 * stop here), `false` for any other key (which the editor lets
 * propagate normally so the operator can keep typing).
 */
export function handleInlineTitleKey(
  e: KeyboardEvent,
  onCommit: (input: HTMLInputElement) => void,
  onCancel: () => void,
): boolean {
  const intent = inlineEditKey(e, /* multiline */ false);
  if (intent === "commit") {
    e.preventDefault();
    onCommit(e.currentTarget as HTMLInputElement);
    return true;
  }
  if (intent === "cancel") {
    e.preventDefault();
    onCancel();
    return true;
  }
  return false;
}

/**
 * Validates the inline title input + dispatches the
 * `INLINE_EDIT_TITLE_EVENT` if the new title is a real change.
 * Returns `true` iff the event was dispatched (the view uses this
 * to know whether the optimistic state in the editor mattered).
 *
 * Rejects empty strings (the operator cannot blank a title via
 * the inline editor; the existing add-child + edit-modal
 * surfaces are the canonical entry point for kind-specific
 * defaults). Identity-equal trims are also no-ops so an Enter on
 * an untouched value doesn't churn the persistence layer.
 */
export function dispatchInlineTitleCommit(
  host: EventTarget,
  target: InlineTitleEditTarget,
  rawValue: string,
): boolean {
  const next = rawValue.trim();
  if (next.length === 0 || next === target.title) return false;
  host.dispatchEvent(
    new CustomEvent<InlineEditTitleDetail>(INLINE_EDIT_TITLE_EVENT, {
      bubbles: true,
      composed: true,
      detail: { nodeId: target.nodeId, title: next },
    }),
  );
  return true;
}
