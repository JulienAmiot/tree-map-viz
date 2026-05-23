/**
 * `<design-system-page>` — full-screen showcase reached from the
 * About modal (§17.127 strand A1). Foundation only: top bar + tier
 * nav + tier-router; bodies are "Coming soon" placeholders. Follow-up
 * strands §17.127.2 → §17.127.6 fill each tier under the 300-line
 * Sonar gate. Dismissal: close button or Escape → `design-system-close`.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export const DESIGN_SYSTEM_CLOSE_EVENT = "design-system-close";

type Tier = "atoms" | "molecules" | "organisms" | "templates" | "pages";

const TIERS: readonly { id: Tier; label: string; lead: string }[] = [
  { id: "atoms", label: "Atoms", lead: "Tokens, glyphs, primitives." },
  { id: "molecules", label: "Molecules", lead: "Chips, badges, toggles." },
  { id: "organisms", label: "Organisms", lead: "Live Lit custom elements." },
  { id: "templates", label: "Templates", lead: "Page-level layouts." },
  { id: "pages", label: "Pages", lead: "End-to-end screens." },
] as const;

@customElement("design-system-page")
export class DesignSystemPage extends LitElement {
  @property({ type: Boolean, reflect: true })
  open = false;

  @state()
  private currentTier: Tier = "atoms";

  static readonly styles = css`
    :host { position: fixed; inset: 0; z-index: 250; display: none; pointer-events: none; color: var(--text, #e8ecf4); background: var(--bg, #0c0f14); font: 1rem/1.4 system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    :host([open]) { display: block; pointer-events: auto; overflow: auto; }
    .topbar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 1.25rem; padding: 0.85rem 1.25rem; background: color-mix(in srgb, currentColor 6%, var(--bg, #0c0f14)); border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent); }
    .brand { color: var(--text, #e8ecf4); font-weight: 700; }
    .spacer { flex: 1; }
    .close-btn { padding: 0.45rem 0.95rem; background: transparent; color: inherit; border: 1px solid color-mix(in srgb, currentColor 35%, transparent); border-radius: 6px; cursor: pointer; font: inherit; }
    .close-btn:hover { background: color-mix(in srgb, currentColor 16%, transparent); }
    .shell { display: grid; grid-template-columns: 220px 1fr; min-height: calc(100vh - 56px); }
    nav.tiers { background: color-mix(in srgb, currentColor 4%, var(--bg, #0c0f14)); border-right: 1px solid color-mix(in srgb, currentColor 18%, transparent); padding: 1rem 0.6rem; }
    nav.tiers button { display: block; width: 100%; text-align: left; background: transparent; color: var(--muted, #8b95a8); border: 0; padding: 0.55rem 0.7rem; border-radius: 6px; cursor: pointer; font: inherit; }
    nav.tiers button:hover, nav.tiers button.active { background: color-mix(in srgb, var(--accent, #5b8cff) 18%, transparent); color: var(--text, #e8ecf4); }
    main { padding: 1.5rem 1.75rem 4rem; max-width: 1200px; }
    h1 { color: var(--text, #e8ecf4); margin: 0 0 0.25rem; font-size: 1.5rem; }
    .lead { color: var(--muted, #8b95a8); margin-bottom: 1.5rem; }
    .placeholder { padding: 2rem 1.25rem; background: color-mix(in srgb, currentColor 4%, transparent); border: 1px dashed color-mix(in srgb, currentColor 22%, transparent); border-radius: 10px; color: var(--muted, #8b95a8); text-align: center; }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("keydown", this.handleKeydown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleKeydown);
  }

  render() {
    if (!this.open) return nothing;
    const active = TIERS.find((t) => t.id === this.currentTier) ?? TIERS[0];
    return html`
      <header class="topbar">
        <span class="brand">Tree Map Viz — design system</span>
        <span class="spacer"></span>
        <button type="button" class="close-btn" data-testid="design-system-close" @click=${this.close}>
          Back to kiosk
        </button>
      </header>
      <div class="shell">
        <nav class="tiers" aria-label="Atomic design tiers">
          ${TIERS.map(
            (t) => html`
              <button
                type="button"
                class=${t.id === this.currentTier ? "active" : ""}
                data-testid="ds-tier-${t.id}"
                @click=${() => this.selectTier(t.id)}
              >
                ${t.label}
              </button>
            `,
          )}
        </nav>
        <main data-testid="ds-main">
          <h1>${active.label}</h1>
          <p class="lead">${active.lead}</p>
          <div class="placeholder" data-testid="ds-placeholder">
            ${active.label} tier — coming soon.
          </div>
        </main>
      </div>
    `;
  }

  private selectTier(id: Tier): void {
    this.currentTier = id;
  }

  private readonly close = (): void => {
    this.dispatchEvent(
      new CustomEvent(DESIGN_SYSTEM_CLOSE_EVENT, {
        bubbles: true,
        composed: true,
      }),
    );
  };

  private readonly handleKeydown = (e: KeyboardEvent): void => {
    if (this.open && e.key === "Escape") this.close();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "design-system-page": DesignSystemPage;
  }
  interface HTMLElementEventMap {
    "design-system-close": CustomEvent<void>;
  }
}
