/**
 * `<picture-node-as-parent>` — large parent-strip rendering for
 * `PictureNode` (SPEC §17.119).
 *
 * Layout:
 *   - Title (top, `2.4vh` row, bright off-white from §17.42, click
 *     to inline-edit). Mirrors `TextNodeAsParent`'s title affordance
 *     — pressing Enter / blurring commits via
 *     `INLINE_EDIT_TITLE_EVENT` so the composition root can apply
 *     it through `EditNodeService.editTitle`.
 *   - Value-area fills the rest of the tile and hosts the `<img>`
 *     (object-fit: cover) with the same warning fallback as the
 *     child role; the image is **not** inline-editable — changing
 *     the URL is a structural edit routed through the
 *     `EditNodeModal`'s `imageUrl` field. The picture parent role
 *     deliberately surfaces only one inline gesture (title) so the
 *     read-only-ish "look at the image" interaction stays
 *     uncluttered.
 *   - No timestamp (snapshot leaf).
 *   - No description.
 */

import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import {
  INLINE_EDIT_TITLE_EVENT,
  type InlineEditTitleDetail,
} from "../inlineEditEvents.js";
import {
  focusAndSelectInline,
  inlineEditKey,
} from "../inlineEditHelpers.js";
import type { PictureNodeViewModel } from "../NodeViewModel.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";

import { pictureBodyStyles, renderPictureValueArea } from "./pictureBody.js";

@customElement("picture-node-as-parent")
export class PictureNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: PictureNodeViewModel | null = null;

  /** §17.28 — which field is currently being inline-edited (only `title` on a picture). */
  @state()
  private editingField: "title" | null = null;

  /** §17.119 — flips to `true` on the `<img>`'s `error` event so the warning glyph renders. */
  @state()
  private hasError = false;

  private lastUrl: string | null = null;

  static styles = [
    tileLayoutStyles,
    pictureBodyStyles,
    css`
      /* Parent strip uses a slightly larger title than the children,
         while still respecting the §17.14 vh-relative sizing — same
         literals as TextNodeAsParent / BSCNodeAsParent. */
      .title {
        font-size: 2.4vh;
        /* SPEC §17.42 — focused-panel title is bright off-white. */
        color: rgb(245, 245, 245);
      }
      .title.is-editable {
        cursor: text;
      }
      /* Inline title-edit input -- same affordance as TextNodeAsParent,
         same literals so a future tweak to the inline-edit visual
         contract stays as a one-place change in the shared
         tileLayoutStyles plus per-view selector parity. */
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
    `,
  ];

  override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has("vm")) return;
    const currentUrl = this.vm?.imageUrl ?? null;
    if (currentUrl !== this.lastUrl) {
      this.lastUrl = currentUrl;
      if (this.hasError) {
        this.hasError = false;
      }
    }
  }

  override updated(): void {
    // SPEC §17.28 -- focus the title input after Lit re-renders the
    // template so the operator's caret lands inside the input without
    // an extra tap. Picture-strand parity with TextNodeAsParent.
    if (this.editingField === "title") {
      const input = this.shadowRoot?.querySelector<HTMLInputElement>(
        "input.title-edit",
      );
      focusAndSelectInline(input ?? null);
    }
  }

  private handleImageError = (): void => {
    this.hasError = true;
  };

  render() {
    if (!this.vm) {
      return nothing;
    }
    return html`
      ${this.renderTitle()}
      ${renderPictureValueArea(
        this.vm.imageUrl,
        this.vm.title,
        this.hasError,
        this.handleImageError,
      )}
    `;
  }

  private renderTitle() {
    if (!this.vm) return nothing;
    if (this.editingField === "title") {
      return html`<h1
        class="title"
        data-testid="title"
        data-view-kind="PictureNode"
        data-id=${this.vm.id}
      >
        <input
          class="title-edit"
          data-testid="title-edit"
          type="text"
          maxlength="120"
          .value=${this.vm.title}
          @keydown=${(e: KeyboardEvent) => this.handleTitleKey(e)}
          @blur=${(e: FocusEvent) => this.commitTitle(e.target as HTMLInputElement)}
        />
      </h1>`;
    }
    return html`<h1
      class="title is-editable"
      data-testid="title"
      data-view-kind="PictureNode"
      data-id=${this.vm.id}
      role="button"
      tabindex="0"
      title="Click to edit title"
      @click=${this.startTitleEdit}
    >
      ${this.vm.title}
    </h1>`;
  }

  private startTitleEdit = (): void => {
    if (!this.vm) return;
    this.editingField = "title";
  };

  private handleTitleKey(e: KeyboardEvent): void {
    const intent = inlineEditKey(e, /* multiline */ false);
    if (intent === "commit") {
      e.preventDefault();
      this.commitTitle(e.currentTarget as HTMLInputElement);
    } else if (intent === "cancel") {
      e.preventDefault();
      this.editingField = null;
    }
  }

  private commitTitle(input: HTMLInputElement | null): void {
    if (this.editingField !== "title") return;
    if (!this.vm || !input) {
      this.editingField = null;
      return;
    }
    const next = input.value.trim();
    this.editingField = null;
    if (next.length === 0 || next === this.vm.title) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<InlineEditTitleDetail>(INLINE_EDIT_TITLE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { nodeId: this.vm.id, title: next },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "picture-node-as-parent": PictureNodeAsParent;
  }
}
