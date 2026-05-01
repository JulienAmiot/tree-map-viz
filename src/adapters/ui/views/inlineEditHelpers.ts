/**
 * Shared click-to-edit lifecycle helpers for the focused-panel views
 * (SPEC §17.28).
 *
 * Both `TextNodeAsParent` and `BusinessScoreCardNodeAsParent` surface
 * inline editing on the title and value displays. The lifecycle is the
 * same in both cases:
 *
 *   1. On click on the static element, the view swaps to an editor
 *      (`<input>` or `<textarea>`) pre-filled with the current value.
 *   2. The editor auto-focuses + selects-all so the operator can either
 *      retype or tweak.
 *   3. **Enter** commits the edit (single-line inputs); **Ctrl/Cmd +
 *      Enter** commits a multi-line textarea (so plain Enter inserts a
 *      newline, matching common multi-line editor conventions).
 *   4. **Blur** also commits (touch-friendly: tapping outside the
 *      editor finishes the edit).
 *   5. **Escape** cancels without committing.
 *
 * The helpers below own steps 2 + 3 + 5 (focus / keydown). The view
 * owns the event dispatch (the caller decides whether to commit a
 * title or a value) so this module stays presentation-agnostic.
 */

/**
 * Auto-focus + select-all on the next animation frame. Called from a
 * Lit `updated()` hook after the view swaps to its editing template;
 * the rAF defers focus until after the DOM mutation has settled, which
 * matters in jsdom (the synchronous render sometimes loses the focus
 * to the document body otherwise).
 */
export function focusAndSelectInline(
  el: HTMLInputElement | HTMLTextAreaElement | null,
): void {
  if (!el) return;
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      el.focus();
      try {
        el.select();
      } catch {
        // jsdom occasionally throws on textarea.select(); the focus
        // alone is good enough for the unit-test pathway.
      }
    });
  } else {
    el.focus();
    try {
      el.select();
    } catch {
      /* same fallback as above */
    }
  }
}

/**
 * Returns the kind of commit a key event represents on an inline
 * editor, or `null` for keys that should pass through.
 *
 *  - `commit`  — the operator wants to apply the edit.
 *  - `cancel`  — the operator wants to abort (Escape).
 *  - `null`    — any other key; let the editor consume it normally.
 *
 * `multiline` flips Enter's behaviour: in single-line mode plain Enter
 * commits; in multi-line mode plain Enter inserts a newline and only
 * Ctrl/Cmd + Enter commits.
 */
export function inlineEditKey(
  event: KeyboardEvent,
  multiline: boolean,
): "commit" | "cancel" | null {
  if (event.key === "Escape") {
    return "cancel";
  }
  if (event.key === "Enter") {
    if (!multiline) {
      return "commit";
    }
    if (event.ctrlKey || event.metaKey) {
      return "commit";
    }
    return null;
  }
  return null;
}
