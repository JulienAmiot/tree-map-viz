/**
 * Shared CSS + value-area template for the two `URLNode` views
 * (SPEC §17.120).
 *
 * The tile contract is identical across roles:
 *
 *   - **Title row** — fixed `3vh` row inherited from `tileLayoutStyles`,
 *     same vh-sized font, same `data-testid="title"` hook. Parent role
 *     overrides the colour to the bright off-white the operator's
 *     §17.42 amendment pinned for focused-panel titles; child role
 *     keeps the host's inherited colour.
 *   - **Value-area** — fills the rest of the tile and centres an
 *     `<img>` rendered with **`object-fit: contain`** (the operator's
 *     core requirement: "displays a QR code on the card (css rule
 *     for object fit: contain)"). The QR image is a PNG data: URL
 *     generated from `vm.url` via the `qrcode` npm package; the
 *     `contain` rule (vs §17.119 PictureNode's `cover` rule) keeps
 *     the entire QR code visible at any tile aspect ratio — cropping
 *     a QR code is fatal to scannability, so the spec deliberately
 *     diverges from the picture-strand precedent here.
 *   - **Warning fallback** — on QR-generation failure the per-view
 *     trips a state flag that swaps the `<img>` for a
 *     `<div class="warning-fill">` carrying the exact same DOM shape
 *     the `Computed*` tiles use when their strategy can't produce a
 *     value (SPEC §17.116) and the §17.119 PictureNode tile uses on
 *     image load failure. `.warning-fill` lives in the shared
 *     `tileLayoutStyles` so the glyph already renders huge, centred,
 *     and in a calm muted colour — no per-view CSS needed beyond
 *     declaring the class on the swap target. `data-testid=
 *     "warning-fill"` is the stable e2e hook, mirroring the Computed*
 *     + PictureNode contract so a future test that wants to assert
 *     "QR generation failed" can reuse the same selector logic.
 *
 * No timestamp: a `URLNode` is a snapshot leaf (SPEC §17.120 — the
 * domain inherits from `ValueNode<string>` rather than
 * `HistorizableValueNode<string>`), so the bottom-right corner stays
 * unused. The per-role files do not render a `<time>` element.
 *
 * No description / no inline-value editor: changing the URL is a
 * structural edit routed through the `EditNodeModal`'s `url` field;
 * the body itself is a passive viewport. Mirrors §17.119 PictureNode
 * parent-role contract.
 */

import { type TemplateResult, css, html, nothing } from "lit";

import { renderWarningFill } from "../warningFill.js";

/**
 * CSS scoped to the `URLNode` views. Adds the `<img>` sizing rule +
 * the `object-fit: contain` operator contract; everything else
 * (title row, value-area, warning-fill) is inherited from
 * `tileLayoutStyles`.
 *
 * The `.qr-img` rule pins the image to 100 % of its `.value-area`
 * parent on both axes — a bare `<img>` would size to its intrinsic
 * pixels and the contain rule would silently no-op (contain only
 * matters when the rendered box differs from the source aspect
 * ratio, which requires a fixed box). `display: block` eliminates
 * the baseline-aligned phantom descender modern browsers add to
 * inline-replaced elements; `min-width / min-height: 0` is the
 * flex-item escape hatch so the image actually shrinks below its
 * intrinsic size when the tile gets small.
 *
 * The §17.120 `contain` rule (vs §17.119 PictureNode's `cover` rule)
 * is the only CSS divergence between the two strands' value-area
 * stylesheets — every other rule is identical.
 *
 * `image-rendering: pixelated` keeps the QR's hard-edged modules
 * crisp when the browser scales the data: URL PNG up to fill the
 * tile (the QR is generated at 256 px regardless of the tile size,
 * and browsers default to bilinear smoothing which smears the
 * module edges and hurts scannability on lower-end cameras).
 */
export const urlBodyStyles = css`
  .qr-img {
    display: block;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    object-fit: contain;
    /* QR codes are pure black / white; keep the modules sharp when
       the browser upscales the PNG to the tile dimensions. */
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    /* The QR module palette is opaque white-on-black by default
       (qrcode lib option), so a transparent host background lets
       the surrounding tile colour show through the inter-tile
       gutter that object-fit: contain produces on off-square
       tiles. */
    background: transparent;
    /* Avoid the operator dragging the QR image out of the tile via
       the browser's default native drag-handler. */
    user-select: none;
    -webkit-user-drag: none;
  }
`;

/**
 * Render the value-area for a `URLNode`. When `hasError` is `false`
 * AND `qrDataUrl` is non-null the area hosts an `<img>` sized to
 * fill it (with the contain rule from `urlBodyStyles`); when
 * `hasError` is `true` it hosts the Computed*-style `warning-fill`
 * glyph; when `qrDataUrl` is `null` AND there is no error (the
 * brief async window between a vm change and the QR generator's
 * promise resolving) the area renders nothing.
 *
 * The per-role view owns the `qrDataUrl` + `hasError` state and
 * the async QR generation that drives them — keeping the state in
 * the view rather than the VM lets the same VM render cleanly the
 * moment a previously-broken URL becomes generatable again (the
 * operator edits the URL, the VM updates, the view re-runs QR
 * generation in `willUpdate`).
 *
 * @param qrDataUrl - The generated QR-code PNG data: URL, or `null`
 *   while the qrcode promise is still resolving for the current
 *   `vm.url`.
 * @param alt - Operator-visible alt text — currently the node's
 *   title, surfaced for screen-reader parity with the title row
 *   above.
 * @param hasError - Per-view state: `true` once the qrcode library
 *   has rejected the URL (e.g. payload exceeds max bit-density on
 *   the chosen error-correction level) and the warning fallback
 *   should render.
 */
function renderURLBody(
  qrDataUrl: string | null,
  alt: string,
  hasError: boolean,
): TemplateResult | typeof nothing {
  // SPEC §17.120 — three exclusive states: (a) generation rejected →
  // warning glyph fallback; (b) generation still pending → no body
  // (the value-area renders empty until the async promise resolves);
  // (c) success → QR image. Flattened from a nested ternary to keep
  // Sonar S3358 happy without changing semantics.
  if (hasError) {
    return renderWarningFill(
      "qr-generation-failed",
      "QR code could not be generated",
    );
  }
  if (qrDataUrl !== null) {
    return html`<img
      class="qr-img"
      data-testid="qr-image"
      data-value-kind="url"
      src=${qrDataUrl}
      alt=${alt}
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
    />`;
  }
  return nothing;
}

export function renderURLValueArea(
  qrDataUrl: string | null,
  alt: string,
  hasError: boolean,
  disabled = false,
): TemplateResult {
  return html`<div class="value-area" data-testid="value-row" ?data-disabled=${disabled}>
    ${renderURLBody(qrDataUrl, alt, hasError)}
  </div>`;
}
