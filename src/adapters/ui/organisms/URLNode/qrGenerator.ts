/**
 * Shared QR-code generation helper for the URLNode views (SPEC §17.120).
 *
 * Wraps the `qrcode` npm package's `toString({ type: "svg" })` API:
 *
 *   - **SVG output (not PNG)** — `qrcode.toDataURL` and
 *     `qrcode.toCanvas` route through the DOM Canvas API, which
 *     jsdom does not implement fully. SVG generation is pure-JS:
 *     it works in every browser AND in unit tests under jsdom
 *     without canvas mocking. SVG also scales cleanly with
 *     `object-fit: contain` (no PNG pixelation), and produces a
 *     smaller payload than a 256-px PNG for short URLs.
 *   - **`data:image/svg+xml;...` URL** — the helper returns a
 *     data: URL the view layer can drop straight into `<img src="">`.
 *     We use `encodeURIComponent` rather than base64 because the
 *     SVG payload is small and URL-encoded SVG is byte-for-byte
 *     readable (helps when debugging the value via dev-tools'
 *     network panel) while still being a valid `<img>` source.
 *   - **Error-correction level "M" (medium)** — the qrcode library
 *     supports L / M / Q / H (7/15/25/30 % redundancy). M is the
 *     standard pick for URL payloads: enough redundancy to survive
 *     a smudged camera lens or a partially-obscured tile, without
 *     bloating the module count to the point where short URLs
 *     produce a denser code than necessary.
 *   - **Margin = 1 module** — the qrcode library's default is 4,
 *     which leaves a wide white quiet zone around the QR. The tile
 *     already provides ambient padding via the value-area's flex
 *     centring + the §17.119 / §17.120 `object-fit: contain`
 *     gutter; cutting the quiet zone from 4 to 1 modules lets the
 *     QR itself take more of the available pixel area without
 *     sacrificing scannability (the minimum spec-compliant quiet
 *     zone is 4 modules, but every modern scanner tolerates 1+ in
 *     practice — and we still get the host tile's padding around
 *     the data: URL boundary).
 *   - **Fixed black-on-white palette** — QR readers require the
 *     dark modules to be ≥40 % darker than the light modules. The
 *     kiosk theme is dark, but the QR PNG itself is always
 *     opaque white-on-black inside its bounding box (the
 *     surrounding tile color shows through the contain-fit gutter,
 *     not through the QR itself). We don't expose a color option;
 *     a future strand may add a per-board light-mode override.
 *
 * Async contract: every public function returns a Promise. The
 * `qrcode` library's `toString` is implemented synchronously
 * underneath but exposes a Promise-shaped API — we await it
 * verbatim and never short-circuit, so callers can rely on
 * standard async-error semantics (`try { await ... } catch { ... }`)
 * for both genuine generation failures (extremely long inputs that
 * blow past the qrcode library's max bit-density even at error-
 * correction level "L") AND any future library upgrades that
 * introduce real I/O.
 */

import QRCode from "qrcode";

/**
 * Encode `text` as a QR code and return a `data:image/svg+xml;...`
 * URL suitable for use as an `<img src="">` value. Throws (rejects
 * the Promise) when the qrcode library refuses the payload — the
 * URLNode views convert that into a `warning-fill` glyph via their
 * local `hasError` state, mirroring the §17.119 PictureNode
 * load-failure fallback.
 */
export async function generateQRDataUrl(text: string): Promise<string> {
  const svg = await QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
