/**
 * `<parent-identity-strip>` -- Lit element that renders the focused node in
 * the parent role at the top of the kiosk viewport (SPEC §4 / §12.1,
 * §17.136 S13a).
 *
 * §17.136 S13a -- the strip's pre-strand close-X (§17.23) + edit-pencil
 * (§17.28) buttons retire here and move into each AsParent's
 * `<card-frame slot="header-actions">` cell via the shared
 * `molecules/headerActions.ts` helper. Visual position unchanged;
 * encapsulation moves down a level. Events still bubble + compose
 * through both shadow boundaries to reach the shell-level listener
 * on `<tree-map-screen>`. The event-constant re-exports below keep
 * existing callsites (`main.ts`, unit tests) compiling unchanged.
 *
 * The strip still owns the panel-frame visual styling (bg / border /
 * radius) and forwards its `parent-id` attribute to the inner
 * `<node-view>` via `.parentId=${this.parentId}` so the AsParent
 * tag's `header-actions` slot can consume it.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../molecules/registerNodeViews.js";
import type { NodeViewModel } from "../molecules/NodeViewModel.js";

export {
  EDIT_NODE_OPEN_EVENT,
  FOCUS_CLOSE_TO_PARENT_EVENT,
  type EditNodeOpenDetail,
  type FocusCloseToParentDetail,
} from "../molecules/headerActions.js";

@customElement("parent-identity-strip")
export class ParentIdentityStrip extends LitElement {
  @property({ attribute: false })
  vm: NodeViewModel | null = null;

  /** SPEC §17.136 S13a -- forwarded to the inner `<node-view>`. */
  @property({ type: String, attribute: "parent-id" })
  parentId = "";

  static styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
    }
    /* SPEC §17.36 -- the parent strip is a panel; mirrors the child
       tile's panel aesthetic. SPEC §17.37 -- padding 0 (the inner
       per-view's own host padding is the only padding in play).
       SPEC §17.136 S13a -- the pre-strand .has-close / .has-edit
       modifier rules, the .strip-action / .close-x / .edit-pencil
       button rules, and the --strip-gutter-right publication all
       retire (buttons moved into each AsParent's card-frame
       header-actions cell). */
    .strip {
      position: relative;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      padding: 0;
      background: var(
        --panel-strip-bg,
        color-mix(in srgb, currentColor 12%, transparent)
      );
      border: 1px solid
        var(
          --panel-border-color,
          color-mix(in srgb, currentColor 28%, transparent)
        );
      border-radius: var(--panel-border-radius, 8px);
    }
    node-view {
      display: block;
      width: 100%;
      height: 100%;
    }
  `;

  render() {
    const focusedId = this.vm?.id ?? "";
    return html`<header
      class="strip"
      data-testid="parent-strip"
      data-focused-id=${focusedId}
    >
      ${this.vm
        ? html`<node-view
            view-role="asParent"
            .vm=${this.vm}
            .parentId=${this.parentId}
          ></node-view>`
        : nothing}
    </header>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "parent-identity-strip": ParentIdentityStrip;
  }
}
