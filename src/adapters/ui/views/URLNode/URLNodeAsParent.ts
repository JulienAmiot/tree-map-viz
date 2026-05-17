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

  static styles = [
    tileLayoutStyles,
    urlBodyStyles,
    css`
      /* Parent strip uses a slightly larger title than the children,
         while still respecting the §17.14 vh-relative sizing — same
         literals as TextNodeAsParent / PictureNodeAsParent. */
      .title {
        font-size: 2.4vh;
        /* SPEC §17.42 — focused-panel title is bright off-white. */
        color: rgb(245, 245, 245);
      }
      .title.is-editable {
        cursor: text;
      }
      /* Inline title-edit input -- same affordance as
         TextNodeAsParent / PictureNodeAsParent, same literals so a
         future tweak to the inline-edit visual contract stays as a
         one-place change in the shared tileLayoutStyles plus
         per-view selector parity. */
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
    if (!this.vm) return nothing;
    if (this.editingField === "title") {
      return html`<h1
        class="title"
        data-testid="title"
        data-view-kind="URLNode"
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
      data-view-kind="URLNode"
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
    "url-node-as-parent": URLNodeAsParent;
  }
}
