/**
 * Shared CSS + sizing helper for the TextNode value body (SPEC §17.27).
 *
 * Both `<text-node-as-parent>` and `<text-node-as-child>` render the
 * latest TextNode entry's value as **markdown** (parsed by
 * `renderMarkdownToHtml`) inside a `.md-body` element. This module
 * carries the two pieces they share:
 *
 *   - {@link textBodyStyles} — the CSS for the `.md-body` block:
 *     tile-relative font-size baseline (`cqmin` clamp) so the body
 *     scales with the tile, plus per-tag rules for `<p>`, headings,
 *     lists, `<code>`, and links.
 *   - {@link fitMarkdownBodyToTile} — a JS shrink-to-fit helper that
 *     binary-searches the largest font-size at which the rendered
 *     markdown still fits the value-area (no overflow). The CSS
 *     baseline already does most of the work; this helper is the
 *     "fully visible" guarantee for content that's longer than the
 *     baseline can comfortably hold. No-ops in jsdom (where layout
 *     is not computed) so unit tests stay deterministic.
 *
 * The fitter writes an inline `font-size` (in px) on the `.md-body`,
 * which trumps the CSS `clamp(...)` baseline. The CSS rule lives in
 * {@link textBodyStyles}; the inline override lives in this module.
 * Keeping the two sides separate means a "no-fitter" build (e.g.
 * unit tests, SSR) still gets a sensible default size from CSS
 * alone.
 */

import { css } from "lit";

/**
 * Floor / ceiling for the JS shrink-to-fit (in CSS pixels).
 *
 * The floor `8 px` is the absolute minimum at which the markdown
 * body stays legible on a kiosk screen; below that we accept some
 * clipping rather than render unreadable text. The ceiling caps the
 * font-size on giant single-child layouts so a 5-character note
 * doesn't render at "movie-theatre" size and dominate the tile —
 * the tile's `<h1>` title still wants the visual lead.
 */
export const TEXT_BODY_FONT_PX_FLOOR = 8;
export const TEXT_BODY_FONT_PX_CEILING = 64;

export const textBodyStyles = css`
  .md-body {
    width: 100%;
    height: 100%;
    overflow: hidden;
    text-align: left;
    /* §17.27 — cqmin baseline so the text size adapts to the tile.
       The clamp's range is much narrower than the BSC value's
       (clamp(1.5rem, 36cqmin, 20rem)) because the body is *body
       copy* (paragraphs, lists), not a hero figure. The 4cqmin
       coefficient lands at ~24 px on a 600 px tile (comfortable
       reading), at ~12 px on a 300 px tile (still legible), and
       saturates at the floor / ceiling for the extremes. The JS
       shrink-to-fit (fitMarkdownBodyToTile) tightens this further
       when the rendered content overflows. */
    font-size: clamp(0.55rem, 4cqmin, 1.4rem);
    font-weight: 400;
    line-height: 1.35;
    word-break: break-word;
  }
  .md-body.empty::before {
    content: "";
  }
  /* §17.27 — block-level markdown elements get tight, tile-friendly
     spacing. The first child's top margin is collapsed so the body
     hugs the value-area's top edge; the last child's bottom margin
     is dropped for symmetry. */
  .md-body > :first-child {
    margin-top: 0;
  }
  .md-body > :last-child {
    margin-bottom: 0;
  }
  .md-body p {
    margin: 0 0 0.45em;
  }
  .md-body h3,
  .md-body h4,
  .md-body h5 {
    margin: 0.25em 0 0.3em;
    line-height: 1.2;
  }
  .md-body h3 {
    font-size: 1.18em;
    font-weight: 700;
  }
  .md-body h4 {
    font-size: 1.08em;
    font-weight: 700;
  }
  .md-body h5 {
    font-size: 1em;
    font-weight: 600;
  }
  .md-body ul,
  .md-body ol {
    margin: 0.2em 0 0.45em;
    padding-left: 1.4em;
  }
  .md-body li {
    margin: 0.1em 0;
  }
  .md-body code {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    background: color-mix(in srgb, currentColor 12%, transparent);
    padding: 0 0.25em;
    border-radius: 3px;
    font-size: 0.92em;
  }
  .md-body strong {
    font-weight: 700;
  }
  .md-body em {
    font-style: italic;
  }
  .md-body a {
    color: inherit;
    text-decoration: underline;
  }
`;

/**
 * Shrink-to-fit the markdown body so it never overflows the
 * `.value-area` parent (SPEC §17.27 — "fully visible").
 *
 * Algorithm: try the {@link TEXT_BODY_FONT_PX_CEILING}. If the
 * rendered body fits (no scroll overflow), keep it. Otherwise binary
 * search down to {@link TEXT_BODY_FONT_PX_FLOOR}, settling on the
 * largest size at which the body's `scrollHeight` ≤ `clientHeight`
 * AND `scrollWidth` ≤ `clientWidth`. ~12 iterations resolve to
 * sub-px granularity.
 *
 * In jsdom (and any other layout-less environment) the body's
 * `getBoundingClientRect()` returns zeros, so we bail early — no
 * inline `font-size` is set, the CSS baseline carries the day, and
 * unit tests stay deterministic.
 */
export function fitMarkdownBodyToTile(body: HTMLElement | null): void {
  if (!body) return;
  const r = body.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;

  body.style.fontSize = `${TEXT_BODY_FONT_PX_CEILING}px`;
  if (
    body.scrollHeight <= body.clientHeight &&
    body.scrollWidth <= body.clientWidth
  ) {
    // Fits at the ceiling — leave the inline size in place so the
    // body uses the largest size (rather than falling back to the
    // smaller CSS clamp default).
    return;
  }

  let lo = TEXT_BODY_FONT_PX_FLOOR;
  let hi = TEXT_BODY_FONT_PX_CEILING;
  for (let i = 0; i < 14 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2;
    body.style.fontSize = `${mid}px`;
    if (
      body.scrollHeight <= body.clientHeight &&
      body.scrollWidth <= body.clientWidth
    ) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  body.style.fontSize = `${lo}px`;
}
