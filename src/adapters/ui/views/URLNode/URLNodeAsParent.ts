/**
 * `<url-node-as-parent>` — large parent-strip rendering for
 * `URLNode` (SPEC §17.120).
 *
 * Layout:
 *   - Title (top, `2.4vh` row, bright off-white from §17.42, click
 *     to inline-edit). Mirrors `PictureNodeAsParent` /
 *     `TextNodeAsParent` title affordances — pressing Enter /
 *     blurring commits via `INLINE_EDIT_TITLE_EVENT` so the
 *     composition root can apply it through
 *     `EditNodeService.editTitle`.
 *   - Value-area fills the rest of the tile and hosts the QR
 *     `<img>` (object-fit: contain) with the same warning fallback
 *     as the child role; the URL is **not** inline-editable —
 *     changing it is a structural edit routed through the
 *     `EditNodeModal`'s `url` field. The URL parent role
 *     deliberately surfaces only one inline gesture (title) so
 *     the read-only-ish "scan the QR" interaction stays
 *     uncluttered. Parity with §17.119 PictureNode parent role.
 *   - No timestamp (snapshot leaf).
 *   - No description shown separately — the URL IS the description
 *     per the §17.120 contract, and the QR code renders it.
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
import type { URLNodeViewModel } from "../NodeViewModel.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";

import { generateQRDataUrl } from "./qrGenerator.js";
import { renderURLValueArea, urlBodyStyles } from "./urlBody.js";

@customElement("url-node-as-parent")
export class URLNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: URLNodeViewModel | null = null;

  /** §17.28 — which field is currently being inline-edited (only `title` on a URL). */
  @state()
  private editingField: "title" | null = null;

  /** §17.120 — generated QR-code SVG data: URL, or `null` while the generator promise is mid-flight. */
  @state()
  private qrDataUrl: string | null = null;

  /** §17.120 — flips to `true` on QR-generation failure so the warning glyph renders. */
  @state()
  private hasError = false;

  /**
   * Race guard for async QR generation — see
   * `URLNodeAsChild.qrGenToken` for the rationale (rapid URL
   * edits could otherwise let a slow earlier promise resolution
   * clobber a fast later one).
   */
  private qrGenToken = 0;

  /** Last URL the view kicked off a QR generation for — see child-role mirror. */
  private lastUrl: string | null = null;

  static readonly styles = [
    tileLayoutStyles,
    urlBodyStyles,
    titleInlineEditStyles,
  ];

  override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has("vm")) return;
    const currentUrl = this.vm?.url ?? null;
    if (currentUrl !== this.lastUrl) {
      this.lastUrl = currentUrl;
      this.qrDataUrl = null;
      this.hasError = false;
      this.kickOffGeneration(currentUrl);
    }
  }

  override updated(): void {
    // SPEC §17.28 -- focus the title input after Lit re-renders the
    // template so the operator's caret lands inside the input without
    // an extra tap. URL-strand parity with TextNodeAsParent /
    // PictureNodeAsParent.
    if (this.editingField === "title") {
      const input = this.shadowRoot?.querySelector<HTMLInputElement>(
        "input.title-edit",
      );
      focusAndSelectInline(input ?? null);
    }
  }

  private kickOffGeneration(url: string | null): void {
    if (url === null) return;
    const tag = ++this.qrGenToken;
    generateQRDataUrl(url).then(
      (dataUrl) => {
        if (tag !== this.qrGenToken) return;
        this.qrDataUrl = dataUrl;
      },
      () => {
        if (tag !== this.qrGenToken) return;
        this.hasError = true;
      },
    );
  }

  render() {
    if (!this.vm) {
      return nothing;
    }
    return html`
      ${this.renderTitle()}
      ${renderURLValueArea(this.qrDataUrl, this.vm.title, this.hasError)}
    `;
  }

  private renderTitle() {
    return renderInlineEditableTitle({
      target: this.vm ? { nodeId: this.vm.id, title: this.vm.title } : null,
      isEditing: this.editingField === "title",
      viewKind: "URLNode",
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
    "url-node-as-parent": URLNodeAsParent;
  }
}
