/**
 * Format an ISO date string as `D MMM YYYY` (e.g. `7 Jan 2027`).
 *
 * Pre-§17.142f the helper lived on the `<target-date-cell>` molecule
 * file alongside the Lit element class. With the §17.142 `<card-body>`
 * migration the Lit element retired (every per-view stamps the date
 * inline inside the `meta` slot rendered through `renderMonoTextSvg`),
 * so the helper's natural home is here on the atoms tier where the
 * other reusable formatters live (`numberFormat.ts`, `ageFormat.ts`).
 *
 * UTC accessors keep a midnight-UTC ISO from flipping to the previous
 * day on UTC-positive hosts. A non-parseable ISO returns the raw input
 * unchanged (defensive — the kiosk loads operator-edited JSON from
 * disk, so a bad string is possible).
 */

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
