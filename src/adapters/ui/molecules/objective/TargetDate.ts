/**
 * SPEC §17.137 (A1) — `<target-date-cell>` molecule: deadline
 * date inside a `<time>`, formatted as `D MMM YYYY`.
 *
 * Pre-A1 the date was stamped inline by `renderTargetRow` in
 * `BusinessScoreCardNode/valueTemplate.ts`; A1 promotes it so the
 * §17.137 A2 split-body layout can place it in its own grid cell.
 * `formatTargetDate` moves here from the organism layer (was the
 * inline `formatDate`; SPEC §17.116-followup-2 for the format
 * rationale).
 *
 * Empty `dateIso` (no deadline) renders nothing so the surrounding
 * layout can collapse the cell. UTC accessors keep a midnight-UTC
 * ISO from flipping to the previous day on UTC-positive hosts.
 */

import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export function formatTargetDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const d = new Date(ms);
  return `${d.getUTCDate()} ${SHORT_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

@customElement("target-date-cell")
export class TargetDateCell extends LitElement {
  @property({ attribute: "date-iso" })
  dateIso = "";

  static readonly styles = css`
    :host { display: inline-flex; align-items: center; }
  `;

  override render(): TemplateResult | typeof nothing {
    if (!this.dateIso) return nothing;
    return html`<time
      class="target-date"
      data-testid="target-date"
      datetime=${this.dateIso}
      >${formatTargetDate(this.dateIso)}</time
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "target-date-cell": TargetDateCell;
  }
}
