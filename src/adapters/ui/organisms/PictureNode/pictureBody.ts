/**
 * Shared CSS + value-area template for the two `PictureNode` views
 * (SPEC §17.119).
 *
 * The tile contract is identical across roles:
 *
 *   - **Title row** — fixed `3vh` row inherited from `tileLayoutStyles`,
 *     same vh-sized font, same `data-testid="title"` hook. Parent role
 *     overrides the colour to the bright off-white the operator's
 *     §17.42 amendment pinned for focused-panel titles; child role
 *     keeps the host's inherited colour.
 *   - **Value-area** — fills the rest of the tile and centres an
 *     `<img>` rendered with **`object-fit: cover`** (the operator's
 *     core requirement: "contain an image, css rule object-fit:
 *     cover"). The image takes 100 % of its area on both axes so the
 *     cover rule actually has a box to fit against; without an
 *     explicit width / height the intrinsic image size would drive
 *     the layout and the cover behaviour would not be observable.
 *   - **Warning fallback** — on the `<img>`'s `error` event the per-
 *     view trips a state flag that swaps the `<img>` for a
 *     `<div class="warning-fill">` carrying the exact same DOM shape
 *     the `Computed*` tiles use when their strategy can't produce a
 *     value (SPEC §17.116). The `.warning-fill` rule lives in the
 *     shared `tileLayoutStyles` so the glyph already renders huge,
 *     centred, and in a calm muted colour — no per-view CSS needed
 *     beyond declaring the class on the swap target. `data-testid=
 *     "warning-fill"` is the stable e2e hook, mirroring the
 *     Computed* contract so a future test that wants to assert
 *     "image failed to load" can reuse the same selector logic.
 *
 * No timestamp: a `PictureNode` is a snapshot leaf (SPEC §17.119 — the
 * domain inherits from `ValueNode<string>` rather than
 * `HistorizableValueNode<string>`), so the bottom-right corner stays
 * unused. The per-role files do not render a `<time>` element.
 *
 * No description / no inline-value editor: changing the image URL is
 * a structural edit routed through the `EditNodeModal`'s `imageUrl`
 * field; the body itself is a passive viewport.
 */

import { type TemplateResult, css, html } from "lit";

import { renderWarningFill } from "../../atoms/warningFill.js";

/**
 * CSS scoped to the `PictureNode` views. Adds the `<img>` sizing rule
 * + the `object-fit: cover` operator contract; everything else
 * (title row, value-area, warning-fill) is inherited from
 * `tileLayoutStyles`.
 *
 * The `.picture-img` rule pins the image to 100 % of its
 * `.value-area` parent on both axes — a bare `<img>` would size to
 * its intrinsic pixels and the cover rule would silently no-op
 * (cover only matters when the rendered box is smaller than the
 * source aspect ratio, which requires a fixed box). `display: block`
 * eliminates the baseline-aligned phantom descender modern browsers
 * add to inline-replaced elements; `min-width / min-height: 0` is
 * the flex-item escape hatch so the image actually shrinks below
 * its intrinsic size when the tile gets small.
 */
export const pictureBodyStyles = css`
  .picture-img {
    display: block;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    object-fit: cover;
    /* Plays nicely with the dark kiosk theme — a transparent PNG /
       data: URL renders against the tile's own background instead
       of an explicit white sheet that would clash with the rest of
       the focused panel. */
    background: transparent;
    /* Avoid the operator dragging the image out of the tile via the
       browser's default native drag-handler. */
    user-select: none;
    -webkit-user-drag: none;
  }
`;

/**
 * Render the value-area for a `PictureNode`. When `hasError` is
 * `false` the area hosts an `<img>` sized to fill it (with the
 * cover rule from `pictureBodyStyles`); when `true` it hosts the
 * Computed*-style `warning-fill` glyph. The per-role view owns the
 * `hasError` state and the `@error` handler that flips it — keeping
 * the state in the view rather than the VM lets the same VM render
 * cleanly the moment a previously-broken URL becomes reachable
 * again (the operator edits the URL, the VM updates, the view
 * resets `hasError` in `updated()`, the `<img>` retries).
 *
 * @param imageUrl - Already-validated URL from the VM (domain
 *   guarantees non-empty trimmed string; the browser is the
 *   authoritative validator for "can this actually load").
 * @param alt - Operator-visible alt text — currently the node's
 *   title, surfaced for screen-reader parity with the title row
 *   above. A future strand may extract a dedicated alt-text
 *   description without changing this signature.
 * @param hasError - Per-view state: `true` once the image's `error`
 *   event has fired and the warning fallback should render.
 * @param onError - Bound handler invoked when the `<img>`'s
 *   `error` event fires (DOM-level event; the view sets its own
 *   state from here).
 */
export function renderPictureValueArea(
  imageUrl: string,
  alt: string,
  hasError: boolean,
  onError: (e: Event) => void,
): TemplateResult {
  return html`<div class="value-area" data-testid="value-row">
    ${hasError
      ? renderWarningFill("image-load-failed", "Image failed to load")
      : html`<img
          class="picture-img"
          data-testid="picture-image"
          data-value-kind="imageUrl"
          src=${imageUrl}
          alt=${alt}
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          @error=${onError}
        />`}
  </div>`;
}
