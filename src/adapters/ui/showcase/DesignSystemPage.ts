/**
 * `<design-system-page>` — full-screen showcase reached from the
 * About modal (§17.127 strand A1). Tiers fill in incrementally:
 * Atoms (§17.127 A2), Molecules / Organisms / Templates / Pages
 * (§17.127.3 → §17.127.6). Dismissal: close button or Escape →
 * `design-system-close`.
 *
 * §17.127 A2 — Atoms tier shows real codebase tokens + glyphs:
 *   - colour tokens read from `src/index.css` (`:root` block);
 *   - the 5 trend-arrow glyphs taken from
 *     `BusinessScoreCardNode/valueTemplate.ts#TREND_ARROW_GLYPHS`;
 *   - the bullseye (U+25CE) and warning (U+26A0 + VS15) glyphs taken
 *     from `tileLayoutStyles.ts`'s ::before content rules;
 *   - the disabled-indicator (U+29B8) glyph taken from
 *     `disabledToggle.ts`'s `.disabled-indicator::before`;
 *   - the four PDCA workflow status colours sourced from
 *     `domain/values/WorkflowStatus.ts#DEFAULT_WORKFLOW_STATUSES`.
 */

import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { DEFAULT_WORKFLOW_STATUSES } from "../../../domain/values/WorkflowStatus.js";
import { renderUnitChip, unitChipStyles } from "../views/unitChip.js";
import {
  renderStatusBadge,
  statusBadgeStyles,
} from "../views/WorkflowNode/statusBadge.js";
import {
  disabledToggleStyles,
  renderDisabledIndicator,
  renderDisabledSwitch,
} from "../views/disabledToggle.js";
import "../shell/BurgerMenu.js";
import "../shell/Breadcrumb.js";
import "../shell/ParentIdentityStrip.js";
import "../shell/ChildrenGrid.js";
import "../shell/TreeMapScreen.js";
import "../views/plus/PlusTile.js";
import "../views/BusinessScoreCardNode/BusinessScoreCardNodeAsParent.js";
import "../views/BusinessScoreCardNode/BusinessScoreCardNodeAsChild.js";
import "../views/ComputedNode/ComputedCards.js";
import "../views/TextNode/TextNodeAsParent.js";
import "../views/TextNode/TextNodeAsChild.js";
import "../views/WorkflowNode/WorkflowNodeAsParent.js";
import "../views/WorkflowNode/WorkflowNodeAsChild.js";
import "../views/PictureNode/PictureNodeAsParent.js";
import "../views/PictureNode/PictureNodeAsChild.js";
import "../views/URLNode/URLNodeAsParent.js";
import "../views/URLNode/URLNodeAsChild.js";
import type { BreadcrumbSegment } from "../shell/Breadcrumb.js";
import {
  sampleBreadcrumbPath,
  sampleBusinessScoreVMOffTrack,
  sampleBusinessScoreVMOnTrack,
  sampleChildSlots,
  sampleComputedBSCVM,
  sampleComputedNodeVM,
  sampleFocusedTreeView,
  samplePictureNodeVM,
  sampleTextNodeVM,
  sampleURLNodeVM,
  sampleWorkflowNodeVM,
} from "./sampleViewModels.js";

export const DESIGN_SYSTEM_CLOSE_EVENT = "design-system-close";

type Tier = "atoms" | "molecules" | "organisms" | "templates" | "pages";

const TIERS: readonly { id: Tier; label: string; lead: string }[] = [
  { id: "atoms", label: "Atoms", lead: "Tokens, glyphs, primitives." },
  { id: "molecules", label: "Molecules", lead: "Chips, badges, toggles." },
  { id: "organisms", label: "Organisms", lead: "Live Lit custom elements." },
  { id: "templates", label: "Templates", lead: "Page-level layouts." },
  { id: "pages", label: "Pages", lead: "End-to-end screens." },
] as const;

/** Colour tokens declared in `src/index.css`'s `:root` block. */
const COLOR_TOKENS: readonly { name: string; value: string; usage: string }[] =
  [
    { name: "--bg", value: "#0c0f14", usage: "App background" },
    { name: "--panel", value: "#151a22", usage: "Panel / tile surface" },
    { name: "--text", value: "#e8ecf4", usage: "Primary text" },
    { name: "--muted", value: "#8b95a8", usage: "Secondary / muted text" },
    { name: "--accent", value: "#5b8cff", usage: "Focus / active accent" },
  ] as const;

/** Trend arrows — mirrored from `BSC valueTemplate.ts#TREND_ARROW_GLYPHS`. */
const TREND_ARROWS: readonly { glyph: string; label: string }[] = [
  { glyph: "\u2191", label: "Well ahead" },
  { glyph: "\u2197", label: "On track" },
  { glyph: "\u2192", label: "Flat" },
  { glyph: "\u2198", label: "Slight regression" },
  { glyph: "\u2193", label: "Significant regression" },
] as const;

/** Sample breadcrumb path used by the Organisms tier (§17.127 A4a). */
const DEMO_BREADCRUMB_PATH: readonly BreadcrumbSegment[] = [
  { id: "ds-root", title: "Obeya" },
  { id: "ds-reliability", title: "Reliability" },
  { id: "ds-pager", title: "Pager fatigue" },
] as const;

/** Other Unicode glyphs used by the kiosk views. */
const KIOSK_GLYPHS: readonly { glyph: string; codepoint: string; label: string }[] = [
  { glyph: "\u25CE", codepoint: "U+25CE", label: "Bullseye — objective target row" },
  { glyph: "\u26A0\uFE0E", codepoint: "U+26A0", label: "Warning — deadline-risk overlay" },
  { glyph: "\u03A3", codepoint: "U+03A3", label: "Sigma — computed-mean badge" },
  { glyph: "\u29B8", codepoint: "U+29B8", label: "Forbidden — disabled indicator" },
  { glyph: "\u00D7", codepoint: "U+00D7", label: "Times — disabled-switch off" },
  { glyph: "\u2713", codepoint: "U+2713", label: "Check — disabled-switch on" },
] as const;

@customElement("design-system-page")
export class DesignSystemPage extends LitElement {
  @property({ type: Boolean, reflect: true })
  open = false;

  @state()
  private currentTier: Tier = "atoms";

  /** §17.127 P2 — top-bar search-filter query (case-insensitive
   * substring match against each section's `data-search-text`).
   * Persists across tier switches. */
  @state()
  private query = "";

  static readonly styles = [
    unitChipStyles,
    statusBadgeStyles,
    disabledToggleStyles,
    css`
    :host { position: fixed; inset: 0; z-index: 250; display: none; pointer-events: none; color: var(--text, #e8ecf4); background: var(--bg, #0c0f14); font: 1rem/1.4 system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    :host([open]) { display: block; pointer-events: auto; overflow: auto; }
    .topbar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 1.25rem; padding: 0.85rem 1.25rem; background: color-mix(in srgb, currentColor 6%, var(--bg, #0c0f14)); border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent); }
    .brand { color: var(--text, #e8ecf4); font-weight: 700; }
    .spacer { flex: 1; }
    .search { position: relative; display: inline-flex; align-items: center; }
    .search input { width: 16rem; padding: 0.4rem 1.85rem 0.4rem 0.7rem; background: color-mix(in srgb, currentColor 6%, transparent); color: inherit; border: 1px solid color-mix(in srgb, currentColor 28%, transparent); border-radius: 6px; font: inherit; }
    .search input:focus { outline: 2px solid var(--accent, #5b8cff); outline-offset: -1px; }
    .search input::-webkit-search-cancel-button { display: none; }
    .search-clear { position: absolute; right: 0.25rem; width: 1.45rem; height: 1.45rem; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: var(--muted, #8b95a8); border: 0; border-radius: 50%; cursor: pointer; font-size: 1rem; line-height: 1; }
    .search-clear:hover { background: color-mix(in srgb, currentColor 18%, transparent); color: var(--text, #e8ecf4); }
    .empty-state { padding: 2.25rem 1.25rem; margin-top: 0.85rem; background: color-mix(in srgb, currentColor 4%, transparent); border: 1px dashed color-mix(in srgb, currentColor 22%, transparent); border-radius: 10px; color: var(--muted, #8b95a8); text-align: center; }
    .empty-state code { background: color-mix(in srgb, currentColor 10%, transparent); padding: 0.05rem 0.4rem; border-radius: 4px; color: var(--text, #e8ecf4); }
    .close-btn { padding: 0.45rem 0.95rem; background: transparent; color: inherit; border: 1px solid color-mix(in srgb, currentColor 35%, transparent); border-radius: 6px; cursor: pointer; font: inherit; }
    .close-btn:hover { background: color-mix(in srgb, currentColor 16%, transparent); }
    .shell { display: grid; grid-template-columns: 220px 1fr; min-height: calc(100vh - 56px); }
    nav.tiers { background: color-mix(in srgb, currentColor 4%, var(--bg, #0c0f14)); border-right: 1px solid color-mix(in srgb, currentColor 18%, transparent); padding: 1rem 0.6rem; }
    nav.tiers button { display: block; width: 100%; text-align: left; background: transparent; color: var(--muted, #8b95a8); border: 0; padding: 0.55rem 0.7rem; border-radius: 6px; cursor: pointer; font: inherit; }
    nav.tiers button:hover, nav.tiers button.active { background: color-mix(in srgb, var(--accent, #5b8cff) 18%, transparent); color: var(--text, #e8ecf4); }
    main { padding: 1.5rem 1.75rem 4rem; max-width: 1200px; }
    h1 { color: var(--text, #e8ecf4); margin: 0 0 0.25rem; font-size: 1.5rem; }
    h2 { color: var(--text, #e8ecf4); margin: 1.75rem 0 0.5rem; font-size: 1.05rem; font-weight: 600; }
    .lead { color: var(--muted, #8b95a8); margin-bottom: 1.5rem; }
    .placeholder { padding: 2rem 1.25rem; background: color-mix(in srgb, currentColor 4%, transparent); border: 1px dashed color-mix(in srgb, currentColor 22%, transparent); border-radius: 10px; color: var(--muted, #8b95a8); text-align: center; }
    .swatch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.75rem; }
    .swatch { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.75rem; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 8px; background: color-mix(in srgb, currentColor 3%, transparent); }
    .swatch .chip { height: 2.2rem; border-radius: 6px; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); }
    .swatch .name { font-family: ui-monospace, "Consolas", "Menlo", monospace; font-size: 0.82rem; color: var(--text, #e8ecf4); }
    .swatch .usage { font-size: 0.75rem; color: var(--muted, #8b95a8); }
    .glyph-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.75rem; }
    .glyph-cell { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: 0.85rem 0.5rem; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 8px; }
    .glyph-cell .big { font-size: 2rem; line-height: 1; color: var(--text, #e8ecf4); }
    .glyph-cell .label { font-size: 0.78rem; color: var(--muted, #8b95a8); text-align: center; }
    .glyph-cell .code { font-family: ui-monospace, "Consolas", "Menlo", monospace; font-size: 0.7rem; color: var(--muted, #8b95a8); }
    .pdca-row { display: flex; flex-wrap: wrap; gap: 0.6rem; }
    .pdca-badge { padding: 0.18rem 0.75rem; border-radius: 999px; border: 1.5px solid currentColor; font-weight: 600; font-size: 0.82rem; letter-spacing: 0.04em; background: transparent; }
    .mol-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.85rem; }
    .mol-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 0.5rem; padding: 0.85rem; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 8px; background: var(--panel, #151a22); }
    .mol-cell .stage { display: inline-flex; align-items: center; gap: 0.5rem; min-height: 1.6em; }
    .mol-cell .stage-title { font-size: 1.05rem; color: var(--text, #e8ecf4); }
    .mol-cell .caption { font-size: 0.75rem; color: var(--muted, #8b95a8); }
    .org-cell { display: flex; flex-direction: column; gap: 0.6rem; padding: 1rem; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 8px; background: var(--panel, #151a22); margin-bottom: 0.85rem; }
    .org-cell .stage { display: flex; align-items: center; gap: 0.6rem; min-height: 2.5em; }
    .org-cell .caption { font-size: 0.78rem; color: var(--muted, #8b95a8); }
    .org-plus-stage { width: 120px; height: 120px; }
    .org-bsc-asparent { width: 100%; min-height: 220px; }
    .org-bsc-asparent business-score-card-as-parent { display: block; width: 100%; height: 100%; min-height: 220px; }
    .org-bsc-aschild { width: 280px; height: 200px; }
    .org-bsc-aschild business-score-card-as-child { display: block; width: 100%; height: 100%; }
    .tpl-cell { display: flex; flex-direction: column; gap: 0.6rem; padding: 1rem; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 8px; background: var(--panel, #151a22); margin-bottom: 0.85rem; }
    .tpl-cell .caption { font-size: 0.78rem; color: var(--muted, #8b95a8); }
    .tpl-stage { display: grid; grid-template-rows: 25% 1fr; width: 100%; height: 480px; gap: 0.5rem; }
    .tpl-stage parent-identity-strip { display: block; width: 100%; height: 100%; }
    .tpl-stage children-grid { display: block; width: 100%; height: 100%; }
    .pg-cell { display: flex; flex-direction: column; gap: 0.6rem; padding: 1rem; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 8px; background: var(--panel, #151a22); margin-bottom: 0.85rem; }
    .pg-cell .caption { font-size: 0.78rem; color: var(--muted, #8b95a8); }
    .pg-stage { width: 100%; height: 540px; border-radius: 6px; overflow: hidden; }
    .pg-stage tree-map-screen { display: block; width: 100%; height: 100%; }
  `,
  ];

  /** UI events bubbled by showcase organisms that we silence at the
   * host so they don't trigger real app logic in main.ts (§17.127 A3+). */
  private static readonly SILENCED_BUBBLES = [
    "value-node-disabled-change",
    "burger-menu-action",
    "breadcrumb-navigate",
    "plus-tile-activate",
    "inline-edit-title",
    "inline-edit-value",
    "inline-edit-unit",
    "computation-kind-change",
    "workflow-status-change",
    "focus-close-to-parent",
    "edit-node-open",
    "tile-drill",
    "weight-edit-open",
  ] as const;

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("keydown", this.handleKeydown);
    for (const ev of DesignSystemPage.SILENCED_BUBBLES) {
      this.addEventListener(ev, this.silenceEvent);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleKeydown);
    for (const ev of DesignSystemPage.SILENCED_BUBBLES) {
      this.removeEventListener(ev, this.silenceEvent);
    }
  }

  private readonly silenceEvent = (e: Event): void => {
    e.stopPropagation();
  };

  render() {
    if (!this.open) return nothing;
    const active = TIERS.find((t) => t.id === this.currentTier) ?? TIERS[0];
    return html`
      <header class="topbar">
        <span class="brand">Tree Map Viz — design system</span>
        <span class="spacer"></span>
        <label class="search">
          <input
            type="search"
            data-testid="ds-search"
            placeholder="Filter this tier…"
            aria-label="Filter sections in this tier"
            .value=${this.query}
            @input=${this.handleSearchInput}
          />
          ${this.query
            ? html`<button
                type="button"
                class="search-clear"
                data-testid="ds-search-clear"
                aria-label="Clear filter"
                title="Clear filter"
                @click=${this.clearSearch}
              >
                ×
              </button>`
            : nothing}
        </label>
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
          ${this.renderTierBody(active.id, active.label)}
          <div class="empty-state" data-testid="ds-empty-state" hidden>
            No section in <strong>${active.label}</strong> matches
            "<code>${this.query}</code>".
          </div>
        </main>
      </div>
    `;
  }

  private renderTierBody(id: Tier, label: string) {
    if (id === "atoms") return this.renderAtoms();
    if (id === "molecules") return this.renderMolecules();
    if (id === "organisms")
      return html`${this.renderOrganismsShell()}${this.renderOrganismsNodes()}`;
    if (id === "templates") return this.renderTemplates();
    if (id === "pages") return this.renderPages();
    return html`<div class="placeholder" data-testid="ds-placeholder">
      ${label} tier — coming soon.
    </div>`;
  }

  /**
   * §17.127 A6 — Pages tier mounts the real `<tree-map-screen>` Lit
   * element (the kiosk's outer page surface) bound to a synthesized
   * `FocusedTreeViewModel` + a 3-segment breadcrumb + a friendly
   * board name. Every bubbled event the screen surfaces is already
   * in `SILENCED_BUBBLES` (burger / breadcrumb / tile-drill /
   * close-to-parent / weight / inline-edit / disabled-change) so
   * the embedded page is fully inert with respect to `main.ts`.
   */
  private renderPages() {
    return this.section("pg-screen", "page tree map screen kiosk end-to-end full", html`
        <h2 data-testid="ds-pg-screen">
          End-to-end kiosk screen (&lt;tree-map-screen&gt;)
        </h2>
        <div class="pg-cell" data-testid="ds-pg-screen-cell">
          <div class="pg-stage">
            <tree-map-screen
              data-testid="ds-pg-screen-mount"
              .boardName=${"Design system demo"}
              .view=${sampleFocusedTreeView()}
              .breadcrumbPath=${sampleBreadcrumbPath()}
            ></tree-map-screen>
          </div>
          <span class="caption">
            The real kiosk page surface mounted with a synthesized
            focused-tree view. Every bubbled UI event the screen
            surfaces is silenced at the showcase host, so taps stay
            inside the page and never reach
            <code>main.ts</code>'s composition root.
          </span>
        </div>
      `,
    );
  }

  /**
   * §17.127 A5 — Templates tier composes the two shell elements that
   * together make up the focused-panel layout (SPEC §4 / §12.1):
   * `<parent-identity-strip>` on top (the focused VM in AsParent
   * role) + `<children-grid>` below (the squarified treemap of
   * children). All four bubbled events specific to this composition
   * (`focus-close-to-parent`, `edit-node-open`, `tile-drill`,
   * `weight-edit-open`) are silenced at the showcase host.
   */
  private renderTemplates() {
    const focusedVm = sampleBusinessScoreVMOnTrack();
    const slots = sampleChildSlots(focusedVm.id);
    return this.section("tpl-focused", "template focused panel parent strip children grid composition", html`
        <h2 data-testid="ds-tpl-focused">
          Focused panel template (parent strip + children grid)
        </h2>
        <div class="tpl-cell" data-testid="ds-tpl-focused-cell">
          <div class="tpl-stage">
            <parent-identity-strip
              .vm=${focusedVm}
              parent-id="ds-demo-grandparent"
            ></parent-identity-strip>
            <children-grid .slots=${slots}></children-grid>
          </div>
          <span class="caption">
            Composition of <code>&lt;parent-identity-strip&gt;</code> on
            top (focused VM in AsParent role + edit-pencil + close-X)
            and <code>&lt;children-grid&gt;</code> below (squarified
            treemap of 3 child slots + a trailing <code>+</code>
            affordance). Bubbled <code>focus-close-to-parent</code> /
            <code>edit-node-open</code> / <code>tile-drill</code> /
            <code>weight-edit-open</code> are silenced at the showcase
            host so taps don't escape to <code>main.ts</code>.
          </span>
        </div>
      `,
    );
  }

  private renderOrganismsNodes() {
    const onTrack = sampleBusinessScoreVMOnTrack();
    const offTrack = sampleBusinessScoreVMOffTrack();
    return html`
      ${this.section("org-bsc", "business score card bsc parent child trend objective on-track off-track", html`
      <h2 data-testid="ds-org-bsc">
        Business Score Card (&lt;business-score-card-as-parent / -as-child&gt;)
      </h2>
      <div class="org-cell" data-testid="ds-org-bsc-asparent-cell">
        <div class="stage org-bsc-asparent">
          <business-score-card-as-parent .vm=${onTrack}></business-score-card-as-parent>
        </div>
        <span class="caption">
          AsParent role \u2014 recorded value above objective, trend arrow
          <code>up-right</code> (on track). Inline-edit affordances on the
          title / value / unit chip are silenced by the showcase host.
        </span>
      </div>
      <div class="org-cell" data-testid="ds-org-bsc-aschild-cell">
        <div class="stage org-bsc-aschild">
          <business-score-card-as-child .vm=${offTrack}></business-score-card-as-child>
        </div>
        <span class="caption">
          AsChild role \u2014 computedMean branch below objective; warning
          glyph + <code>down-right</code> trend arrow (regressing).
        </span>
      </div>
        `,
      )}
      ${this.section("org-computed", "computed card cbsn business score sum average weighted strategy kind aggregation", html`
      <h2 data-testid="ds-org-computed">
        Computed cards (&lt;computed-card&gt; + &lt;computed-business-score-card&gt;)
      </h2>
      <div class="org-cell" data-testid="ds-org-computed-cell">
        <div class="stage org-bsc-aschild">
          <computed-card
            view-role="asParent"
            .vm=${sampleComputedNodeVM()}
          ></computed-card>
        </div>
        <span class="caption">
          ComputedNode AsParent \u2014 SUM strategy picker live;
          <code>computation-kind-change</code> silenced at the host.
        </span>
      </div>
      <div class="org-cell" data-testid="ds-org-computed-bsc-cell">
        <div class="stage org-bsc-asparent">
          <computed-business-score-card
            view-role="asParent"
            .vm=${sampleComputedBSCVM()}
          ></computed-business-score-card>
        </div>
        <span class="caption">
          ComputedBusinessScoreNode AsParent \u2014 WEIGHTED_AVERAGE with
          objective row, trend arrow <code>right</code> (flat).
        </span>
      </div>
        `,
      )}
      ${this.section("org-text", "text node workflow pdca status note retro postmortem", html`
      <h2 data-testid="ds-org-text">
        Text + Workflow cards (&lt;text-node-as-*&gt; / &lt;workflow-node-as-*&gt;)
      </h2>
      <div class="org-cell" data-testid="ds-org-text-asparent-cell">
        <div class="stage org-bsc-asparent">
          <text-node-as-parent .vm=${sampleTextNodeVM()}></text-node-as-parent>
        </div>
        <span class="caption">
          TextNode AsParent \u2014 free-text note; value mirrors
          description per the §17.15 single-source rule.
        </span>
      </div>
      <div class="org-cell" data-testid="ds-org-text-aschild-cell">
        <div class="stage org-bsc-aschild">
          <text-node-as-child .vm=${sampleTextNodeVM()}></text-node-as-child>
        </div>
        <span class="caption">TextNode AsChild \u2014 compact grid tile.</span>
      </div>
      <div class="org-cell" data-testid="ds-org-workflow-asparent-cell">
        <div class="stage org-bsc-asparent">
          <workflow-node-as-parent
            .vm=${sampleWorkflowNodeVM()}
          ></workflow-node-as-parent>
        </div>
        <span class="caption">
          WorkflowNode AsParent \u2014 PDCA status <code>DO</code> with the
          inline <code>&lt;select&gt;</code> picker; bubbled
          <code>workflow-status-change</code> is silenced.
        </span>
      </div>
      <div class="org-cell" data-testid="ds-org-workflow-aschild-cell">
        <div class="stage org-bsc-aschild">
          <workflow-node-as-child
            .vm=${sampleWorkflowNodeVM()}
          ></workflow-node-as-child>
        </div>
        <span class="caption">
          WorkflowNode AsChild \u2014 read-only badge in the subtitle slot.
        </span>
      </div>
        `,
      )}
      ${this.section("org-picture", "picture image url qr code node child parent svg data anchor runbook", html`
      <h2 data-testid="ds-org-picture">
        Picture + URL cards (&lt;picture-node-as-*&gt; / &lt;url-node-as-*&gt;)
      </h2>
      <div class="org-cell" data-testid="ds-org-picture-asparent-cell">
        <div class="stage org-bsc-asparent">
          <picture-node-as-parent
            .vm=${samplePictureNodeVM()}
          ></picture-node-as-parent>
        </div>
        <span class="caption">
          PictureNode AsParent \u2014 inline data-URL SVG so the demo
          stays offline-safe; only the title is inline-editable
          (bubbled <code>inline-edit-title</code> is silenced).
        </span>
      </div>
      <div class="org-cell" data-testid="ds-org-picture-aschild-cell">
        <div class="stage org-bsc-aschild">
          <picture-node-as-child
            .vm=${samplePictureNodeVM()}
          ></picture-node-as-child>
        </div>
        <span class="caption">
          PictureNode AsChild \u2014 same VM rendered as a grid tile.
        </span>
      </div>
      <div class="org-cell" data-testid="ds-org-url-asparent-cell">
        <div class="stage org-bsc-asparent">
          <url-node-as-parent .vm=${sampleURLNodeVM()}></url-node-as-parent>
        </div>
        <span class="caption">
          URLNode AsParent \u2014 QR code + clickable URL aside (§17.123).
        </span>
      </div>
      <div class="org-cell" data-testid="ds-org-url-aschild-cell">
        <div class="stage org-bsc-aschild">
          <url-node-as-child .vm=${sampleURLNodeVM()}></url-node-as-child>
        </div>
        <span class="caption">URLNode AsChild \u2014 compact grid tile.</span>
      </div>
        `,
      )}
    `;
  }

  private renderOrganismsShell() {
    return html`
      ${this.section("org-burger", "burger menu navigation popup import export boards settings about", html`
          <h2 data-testid="ds-org-burger">Burger menu (&lt;burger-menu&gt;)</h2>
          <div class="org-cell" data-testid="ds-org-burger-cell">
            <div class="stage"><burger-menu></burger-menu></div>
            <span class="caption">
              Triple-bar trigger \u2192 popup with Import / Export / Boards /
              Settings / About. Activating an item emits
              <code>burger-menu-action</code> (silenced inside the showcase).
            </span>
          </div>
        `,
      )}
      ${this.section("org-breadcrumb", "breadcrumb focus path navigation segment", html`
          <h2 data-testid="ds-org-breadcrumb">Focus breadcrumb (&lt;focus-breadcrumb&gt;)</h2>
          <div class="org-cell" data-testid="ds-org-breadcrumb-cell">
            <div class="stage">
              <focus-breadcrumb .path=${DEMO_BREADCRUMB_PATH}></focus-breadcrumb>
            </div>
            <span class="caption">
              Path from root \u2192 focused leaf. Tapping a non-current
              segment emits <code>breadcrumb-navigate</code> (silenced
              inside the showcase).
            </span>
          </div>
        `,
      )}
      ${this.section("org-plus", "plus tile add child affordance new", html`
          <h2 data-testid="ds-org-plus">Plus tile (&lt;plus-tile&gt;)</h2>
          <div class="org-cell" data-testid="ds-org-plus-cell">
            <div class="stage">
              <div class="org-plus-stage">
                <plus-tile parent-id="ds-demo-parent"></plus-tile>
              </div>
            </div>
            <span class="caption">
              Dashed "add-child" affordance rendered by the children grid
              when the focused parent has room. Emits
              <code>plus-tile-activate</code> (silenced inside the showcase).
            </span>
          </div>
        `,
      )}
    `;
  }

  private renderMolecules() {
    return html`
      ${this.section("mol-units", "unit chip renderUnitChip usd percent currency suffix", html`
      <h2 data-testid="ds-mol-units">Unit chip (renderUnitChip)</h2>
      <div class="mol-grid">
        <div class="mol-cell" data-testid="ds-mol-unit-usd">
          <div class="stage">
            ${renderUnitChip("USD")}<span class="stage-title">Revenue</span>
          </div>
          <span class="caption">renderUnitChip("USD")</span>
        </div>
        <div class="mol-cell" data-testid="ds-mol-unit-percent">
          <div class="stage">
            ${renderUnitChip("%")}<span class="stage-title">SLA</span>
          </div>
          <span class="caption">renderUnitChip("%")</span>
        </div>
        <div class="mol-cell" data-testid="ds-mol-unit-empty">
          <div class="stage"><span class="stage-title">Headcount</span></div>
          <span class="caption">renderUnitChip("") &rarr; nothing</span>
        </div>
      </div>
        `,
      )}
      ${this.section("mol-badges", "status badge renderStatusBadge pdca workflow plan do check act", html`
      <h2 data-testid="ds-mol-badges">Status badge (renderStatusBadge)</h2>
      <div class="mol-grid">
        ${DEFAULT_WORKFLOW_STATUSES.map(
          (s) => html`
            <div
              class="mol-cell"
              data-testid=${`ds-mol-badge-${s.id}`}
            >
              <div class="stage">${renderStatusBadge(s)}</div>
              <span class="caption">renderStatusBadge(${s.id})</span>
            </div>
          `,
        )}
      </div>
        `,
      )}
      ${this.section("mol-disabled", "disabled toggle indicator switch renderDisabledIndicator renderDisabledSwitch forbidden", html`
      <h2 data-testid="ds-mol-disabled">Disabled affordances (disabledToggle.ts)</h2>
      <div class="mol-grid">
        <div class="mol-cell" data-testid="ds-mol-disabled-indicator">
          <div class="stage">
            ${renderDisabledIndicator(true)}<span class="stage-title">Disabled metric</span>
          </div>
          <span class="caption">renderDisabledIndicator(true)</span>
        </div>
        <div class="mol-cell" data-testid="ds-mol-disabled-switch-off">
          <div class="stage">
            ${renderDisabledSwitch(this, "ds-demo-off", true)}
            <span class="stage-title">switch (off)</span>
          </div>
          <span class="caption">renderDisabledSwitch(\u2026, true)</span>
        </div>
        <div class="mol-cell" data-testid="ds-mol-disabled-switch-on">
          <div class="stage">
            ${renderDisabledSwitch(this, "ds-demo-on", false)}
            <span class="stage-title">switch (on)</span>
          </div>
          <span class="caption">renderDisabledSwitch(\u2026, false)</span>
        </div>
      </div>
        `,
      )}
    `;
  }

  private renderAtoms() {
    return html`
      ${this.section("atoms-colors", "color tokens swatch background bg panel text muted accent root css", html`
      <h2 data-testid="ds-atoms-colors">Colour tokens (src/index.css :root)</h2>
      <div class="swatch-grid">
        ${COLOR_TOKENS.map(
          (t) => html`
            <div class="swatch" data-testid=${`ds-token-${t.name.slice(2)}`}>
              <div class="chip" style=${`background:${t.value}`}></div>
              <span class="name">${t.name}</span>
              <span class="name">${t.value}</span>
              <span class="usage">${t.usage}</span>
            </div>
          `,
        )}
      </div>
        `,
      )}
      ${this.section("atoms-arrows", "trend arrow up right flat down regression bsc value glyph", html`
      <h2 data-testid="ds-atoms-arrows">Trend arrows (BSC value row)</h2>
      <div class="glyph-grid">
        ${TREND_ARROWS.map(
          (a) => html`
            <div class="glyph-cell" data-testid=${`ds-arrow-${a.glyph.codePointAt(0)?.toString(16)}`}>
              <span class="big">${a.glyph}</span>
              <span class="label">${a.label}</span>
            </div>
          `,
        )}
      </div>
        `,
      )}
      ${this.section("atoms-glyphs", "glyph bullseye warning sigma forbidden times check unicode codepoint kiosk", html`
      <h2 data-testid="ds-atoms-glyphs">Kiosk Unicode glyphs</h2>
      <div class="glyph-grid">
        ${KIOSK_GLYPHS.map(
          (g) => html`
            <div class="glyph-cell" data-testid=${`ds-glyph-${g.codepoint.toLowerCase()}`}>
              <span class="big">${g.glyph}</span>
              <span class="code">${g.codepoint}</span>
              <span class="label">${g.label}</span>
            </div>
          `,
        )}
      </div>
        `,
      )}
      ${this.section("atoms-pdca", "pdca workflow status plan do check act color badge", html`
      <h2 data-testid="ds-atoms-pdca">PDCA workflow status colours</h2>
      <div class="pdca-row">
        ${DEFAULT_WORKFLOW_STATUSES.map(
          (s) => html`
            <span
              class="pdca-badge"
              style=${`color:${s.color}`}
              data-testid=${`ds-pdca-${s.id}`}
              >${s.label}</span
            >
          `,
        )}
      </div>
        `,
      )}
    `;
  }

  private selectTier(id: Tier): void {
    this.currentTier = id;
  }

  /** §17.127 P2 — wraps a `<h2>` + body pair in a filterable
   * `<section>`. `searchText` is the lowercase keyword haystack
   * the filter matches against. */
  private section(id: string, searchText: string, body: TemplateResult): TemplateResult {
    return html`<section data-testid="ds-section-${id}" data-section-id=${id} data-search-text=${searchText.toLowerCase()}>${body}</section>`;
  }

  private readonly handleSearchInput = (e: Event): void => {
    this.query = (e.target as HTMLInputElement).value;
  };

  private readonly clearSearch = (): void => {
    this.query = "";
  };

  /** §17.127 P2 — toggles each `<section>`'s `hidden` and the
   * empty-state element based on `this.query`. */
  override updated(): void {
    if (!this.shadowRoot) return;
    const q = this.query.trim().toLowerCase();
    const sections = this.shadowRoot.querySelectorAll<HTMLElement>("section[data-search-text]");
    let visibleCount = 0;
    for (const s of sections) {
      const match = q === "" || (s.dataset.searchText ?? "").includes(q);
      s.hidden = !match;
      if (match) visibleCount++;
    }
    const empty = this.shadowRoot.querySelector<HTMLElement>("[data-testid='ds-empty-state']");
    if (empty) empty.hidden = q === "" || visibleCount > 0;
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
