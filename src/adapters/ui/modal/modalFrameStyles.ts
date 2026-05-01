/**
 * `modalFrameStyles` — the shared visual frame every modal in the app
 * uses (SPEC §17.29).
 *
 * What this module owns:
 *   - The host's fixed-position overlay + flex-centring of the panel.
 *   - The semi-transparent backdrop (SPEC §7 — "the board is still
 *     behind").
 *   - The panel's **sizing contract** (§17.29):
 *       * `max-width` / `max-height: calc(100vw|100vh - 4rem)` so the
 *         modal never exceeds the viewport modulo a comfortable margin.
 *       * `width: max-content` / `height: max-content` so a small
 *         modal (e.g. an edit form with two fields) shrinks to fit its
 *         content rather than ballooning to fill the screen.
 *       * `overflow: hidden` so the panel itself never scrolls — the
 *         per-modal `.form-pane` (or equivalent inner column) carries
 *         `overflow-y: auto` to scroll content that exceeds the cap.
 *   - The shared **close-X button** styling (`.modal-close-x`) — same
 *     CSS-pseudo-element glyph idiom as the §17.23 close-to-parent X
 *     and the §17.24 plus-tile cross. Inherits `currentColor`, sized
 *     in `rem` so it stays consistent across viewport sizes.
 *
 * What this module does NOT own:
 *   - Per-modal layout inside the panel (e.g. `<add-child-modal>`'s
 *     two-pane grid, `<edit-node-modal>`'s single-column form). Each
 *     modal extends the panel selector with its own `display:` rule
 *     and grid / flex configuration.
 *   - The header / form / actions row styling. Those are duplicated
 *     across the two modals today; a future refactor could extract
 *     them into a shared `formFieldStyles` module, but for §17.29 the
 *     scope is deliberately narrow to "modal frame contract".
 *
 * Why a shared module instead of duplication:
 *   - The user's §17.29 rule is system-wide ("any modal in the app
 *     must follow the same design"). A shared module makes the
 *     contract enforceable: a future third modal that doesn't import
 *     this stylesheet stands out in review.
 *   - The close-X glyph uses non-trivial CSS (positioned pseudo-
 *     elements + transforms). Duplicating those rules across modals
 *     is the kind of drift that produces "the cancel-X is two pixels
 *     bigger on the edit modal than on the add-child modal" bugs.
 *
 * Usage pattern:
 * ```ts
 * import { modalFrameStyles, renderModalCloseX } from "./modalFrameStyles.js";
 *
 * static styles = [
 *   modalFrameStyles,
 *   css`
 *     .panel {  // extends, does NOT replace the shared sizing
 *       display: grid;
 *       grid-template-rows: auto 1fr;
 *       padding: 1.5rem 2rem;
 *     }
 *     // ...
 *   `,
 * ];
 *
 * render() {
 *   return html`
 *     <div class="backdrop" @click=${this.cancel}></div>
 *     <div class="panel" role="dialog" aria-modal="true">
 *       ${renderModalCloseX(this.cancel)}
 *       <header>...</header>
 *       <div class="form-pane">...</div>
 *     </div>
 *   `;
 * }
 * ```
 *
 * The close-X button is positioned absolutely inside the panel, in
 * the same top-right corner the kiosk operator already learnt from
 * the focused-panel close-X (§17.23). It sits **above** any header
 * content thanks to `z-index: 1`; per-modal headers should reserve
 * a small right-padding (~3rem) so a long title doesn't run under
 * the X button's hit zone.
 */

import { css, html } from "lit";

/**
 * Shared CSS for every modal in the app. Imported alongside the
 * per-modal stylesheet (Lit accepts a `static styles` array, so the
 * order is "shared first, per-modal overrides second").
 */
export const modalFrameStyles = css`
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
  /* §17.29 — flex-centre the panel while honouring its content-driven
     intrinsic size. Pre-§17.29 the host was display:block and the
     panel used position:absolute + inset:5vh 8vw, which forced every
     modal to occupy ~84vw × ~90vh regardless of how little content
     it carried. The new rule lets a small modal collapse to its
     natural size while still capping wide / tall ones at the
     viewport. */
  :host([open]) {
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    /* SPEC §7 — semi-transparent so the board behind stays visible.
       Direct rgba (instead of color-mix(... transparent)) so
       getComputedStyle returns a parseable alpha to e2e checks. */
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(2px);
  }
  /* §17.29 — sizing contract for every modal panel:
       * shrink to content (width: max-content / height: max-content);
       * cap at viewport - 4rem so there's a comfortable margin around
         the panel even on a small kiosk display.
       * box-sizing: border-box so the cap accounts for border /
         padding the per-modal stylesheet adds.
     The per-modal stylesheet extends this rule with its own layout
     (display: grid for two-pane, etc.) but should NOT override the
     max-* caps. */
  .panel {
    position: relative;
    box-sizing: border-box;
    width: max-content;
    height: max-content;
    max-width: calc(100vw - 4rem);
    max-height: calc(100vh - 4rem);
    background: color-mix(in srgb, currentColor 8%, var(--bg, #0c0f14));
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    border-radius: 12px;
    box-shadow: 0 24px 64px color-mix(in srgb, #000 60%, transparent);
    /* The panel itself does not scroll; the per-modal scrollable
       region (e.g. .form-pane) does. overflow:hidden also keeps the
       border-radius from being clipped through by inner elements. */
    overflow: hidden;
    min-height: 0;
  }
  /* §17.29 — close-X button sitting in the top-right corner of every
     modal panel. Same glyph idiom as the §17.23 close-to-parent X:
     a circular hit-target with two ::before / ::after bars rotated
     45° to form the X. Inherits currentColor so theme changes Just
     Work. The 2.25rem footprint matches SPEC §1 "no-keyboard,
     finger-friendly" target size. */
  .modal-close-x {
    position: absolute;
    top: clamp(0.4rem, 1vw, 0.85rem);
    right: clamp(0.4rem, 1vw, 0.85rem);
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    margin: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    z-index: 1;
  }
  .modal-close-x:hover {
    background: color-mix(in srgb, currentColor 12%, transparent);
  }
  .modal-close-x:focus-visible {
    background: color-mix(in srgb, currentColor 12%, transparent);
    outline: 2px solid color-mix(in srgb, currentColor 35%, transparent);
    outline-offset: 1px;
  }
  .modal-close-x:active {
    background: color-mix(in srgb, currentColor 22%, transparent);
  }
  .modal-close-x::before,
  .modal-close-x::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 1.1rem;
    height: 2px;
    background: currentColor;
    border-radius: 1px;
    transform-origin: center;
  }
  .modal-close-x::before {
    transform: translate(-50%, -50%) rotate(45deg);
  }
  .modal-close-x::after {
    transform: translate(-50%, -50%) rotate(-45deg);
  }
`;

/**
 * Renders the shared close-X button inside a modal panel. Call from
 * each modal's `render()` as the first child of `.panel` so the
 * button sits in the corner above any header content. Wires the
 * button to the modal's existing `cancel`-equivalent handler, so
 * close-X dispatches the same `*-cancel` event as the Cancel button,
 * the backdrop tap, and the Escape key.
 *
 * The shared `data-testid="modal-close-x"` is set on every close-X
 * across the app — there is at most one modal open at a time so the
 * id is unambiguous, and tests reference the same selector for every
 * modal.
 */
export function renderModalCloseX(onClose: () => void) {
  return html`<button
    class="modal-close-x"
    type="button"
    data-testid="modal-close-x"
    aria-label="Close modal"
    title="Close modal"
    @click=${onClose}
  ></button>`;
}
