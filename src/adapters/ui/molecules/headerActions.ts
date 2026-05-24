/**
 * `renderHeaderActions` -- shared AsParent header-actions slot
 * content (SPEC §17.23 + §17.28 + §17.136 S13a).
 *
 * §17.136 S13a -- the close-X (§17.23) + edit-pencil (§17.28)
 * buttons that historically lived in `<parent-identity-strip>` now
 * live inside each AsParent's `<card-frame slot="header-actions">`
 * cell. Visual position unchanged; encapsulation moves down a
 * level so each AsParent owns its own action affordances. Events
 * bubble + compose through both shadow boundaries (AsParent +
 * strip) so the shell-level listener on `<tree-map-screen>` still
 * resolves them. The strip re-exports the event constants for
 * back-compat with `main.ts` + existing tests.
 */

import { type LitElement, type TemplateResult, css, html, nothing } from "lit";

import "../atoms/icon/Icon.js";

export const FOCUS_CLOSE_TO_PARENT_EVENT = "focus-close-to-parent";
export const EDIT_NODE_OPEN_EVENT = "edit-node-open";

export type FocusCloseToParentDetail = { readonly parentId: string };
export type EditNodeOpenDetail = { readonly nodeId: string };

/**
 * CSS rules the AsParent's host needs so the stamped buttons
 * render with the right shape. Same clamp / hover / focus / active
 * literals the strip used pre-§17.136 S13a; the absolute positioning
 * retires (card-frame's grid puts the slot in the right cell).
 */
export const headerActionsStyles = css`
  .header-actions-row {
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    gap: 0.25rem;
  }
  .header-action {
    width: clamp(1.5rem, 3vh, 2.25rem);
    height: clamp(1.5rem, 3vh, 2.25rem);
    padding: 0;
    margin: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
  }
  .header-action:hover {
    background: color-mix(in srgb, currentColor 12%, transparent);
  }
  .header-action:focus-visible {
    background: color-mix(in srgb, currentColor 12%, transparent);
    outline: 2px solid color-mix(in srgb, currentColor 35%, transparent);
    outline-offset: 1px;
  }
  .header-action:active {
    background: color-mix(in srgb, currentColor 22%, transparent);
  }
  .header-action.edit-pencil {
    font-size: clamp(0.85rem, 2vh, 1.5rem);
    line-height: 1;
  }
  .header-action.close-x {
    font-size: clamp(0.9rem, 1.8vh, 1.35rem);
    line-height: 1;
  }
`;

/**
 * Stamp the close-X + edit-pencil. Close-X omitted when
 * `parentId === ""` (root focus). Caller wraps the result in a
 * `<span slot="header-actions">`. Both events bubble + compose.
 */
export function renderHeaderActions(
  host: LitElement,
  opts: { nodeId: string; parentId: string },
): TemplateResult {
  const { nodeId, parentId } = opts;
  const hasClose = parentId !== "";
  const onPencil = (): void => {
    host.dispatchEvent(
      new CustomEvent<EditNodeOpenDetail>(EDIT_NODE_OPEN_EVENT, {
        detail: { nodeId },
        bubbles: true,
        composed: true,
      }),
    );
  };
  const onClose = (): void => {
    if (!hasClose) return;
    host.dispatchEvent(
      new CustomEvent<FocusCloseToParentDetail>(FOCUS_CLOSE_TO_PARENT_EVENT, {
        detail: { parentId },
        bubbles: true,
        composed: true,
      }),
    );
  };
  return html`<span class="header-actions-row" data-testid="header-actions">
    <button
      class="header-action edit-pencil"
      type="button"
      data-testid="edit-node"
      data-node-id=${nodeId}
      aria-label="Edit this node"
      title="Edit this node"
      @click=${onPencil}
    ><ds-icon name="pencil"></ds-icon></button>
    ${hasClose
      ? html`<button
          class="header-action close-x"
          type="button"
          data-testid="close-to-parent"
          data-parent-id=${parentId}
          aria-label="Close \u2014 navigate to parent"
          title="Close \u2014 navigate to parent"
          @click=${onClose}
        ><ds-icon name="x"></ds-icon></button>`
      : nothing}
  </span>`;
}
