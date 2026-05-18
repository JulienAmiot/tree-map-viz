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

import { LitElement, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { focusAndSelectInline } from "../inlineEditHelpers.js";
import {
  dispatchInlineTitleCommit,
  handleInlineTitleKey,
  renderInlineEditableTitle,
  titleInlineEditStyles,
} from "../inlineTitleEdit.js";
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

  static readonly styles = [
    tileLayoutStyles,
    pictureBodyStyles,
    titleInlineEditStyles,
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

  private readonly handleImageError = (): void => {
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
    return renderInlineEditableTitle({
      target: this.vm ? { nodeId: this.vm.id, title: this.vm.title } : null,
      isEditing: this.editingField === "title",
      viewKind: "PictureNode",
      onStart: this.startTitleEdit,
      onKeydown: this.handleTitleKey,
      onBlur: this.handleTitleBlur,
    });
  }

  private readonly startTitleEdit = (): void => {
    if (!this.vm) return;
    this.editingField = "title";
  };

  private readonly handleTitleKey = (e: KeyboardEvent): void => {
    handleInlineTitleKey(
      e,
      (input) => this.commitTitle(input),
      () => {
        this.editingField = null;
      },
    );
  };

  private readonly handleTitleBlur = (e: FocusEvent): void => {
    this.commitTitle(e.target as HTMLInputElement | null);
  };

  private commitTitle(input: HTMLInputElement | null): void {
    if (this.editingField !== "title") return;
    if (!this.vm || !input) {
      this.editingField = null;
      return;
    }
    const value = input.value;
    this.editingField = null;
    dispatchInlineTitleCommit(this, { nodeId: this.vm.id, title: this.vm.title }, value);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "picture-node-as-parent": PictureNodeAsParent;
  }
}
