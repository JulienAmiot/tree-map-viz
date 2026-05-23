import { describe, expect, it } from "vitest";

import { generateQRDataUrl } from "../../../../../../adapters/ui/organisms/URLNode/qrGenerator.js";

/**
 * SPEC §17.120 — unit tests for the shared `generateQRDataUrl`
 * helper that powers both `<url-node-as-child>` and
 * `<url-node-as-parent>`. The helper is a thin wrapper around the
 * `qrcode` library's `toString({ type: "svg" })` API; the tests
 * pin the operator-facing contract (data: URL output, sensible
 * failure on oversized payloads, custom-scheme tolerance) so a
 * future swap to a different QR library — or a switch to PNG output
 * — surfaces immediately rather than as a downstream view-layer
 * regression.
 */
describe("generateQRDataUrl (§17.120)", () => {
  it("returns a `data:image/svg+xml;...` URL for a typical https URL", async () => {
    const dataUrl = await generateQRDataUrl("https://example.com/docs");
    expect(dataUrl.startsWith("data:image/svg+xml;")).toBe(true);
    // SPEC §17.120 — the encoded SVG must contain a <svg> root tag
    // so the browser actually parses it as SVG (not as raw text).
    expect(decodeURIComponent(dataUrl)).toMatch(/<svg[\s>]/);
  });

  it("accepts arbitrary text payloads (mailto:, tel:, custom schemes, plain text — the qrcode library encodes them all)", async () => {
    // SPEC §17.120 — the domain stays loose about URL shape; the
    // helper does the same. Operators get a QR for whatever they
    // entered (scanners surface non-URL payloads as plain text).
    const payloads = [
      "mailto:ops@example.com",
      "tel:+33-1-23-45-67-89",
      "custom-scheme://payload",
      "just some text",
    ];
    for (const p of payloads) {
      const dataUrl = await generateQRDataUrl(p);
      expect(dataUrl.startsWith("data:image/svg+xml;")).toBe(true);
    }
  });

  it("rejects when the payload exceeds the qrcode library's max bit-density (10k chars at error-correction level M)", async () => {
    // SPEC §17.120 — feeds the same oversized-URL trick the view
    // tests use, asserting the helper surface (not the view-layer
    // warning-fill glyph). 10,000 chars at error-correction level M
    // is comfortably above the library's max alphanumeric capacity
    // (~5,500 chars at level L; less at M).
    await expect(generateQRDataUrl("a".repeat(10000))).rejects.toThrow();
  });

  it("two calls with the same input produce identical data: URLs (deterministic — the SVG payload is library-version-stable for fixed options)", async () => {
    // SPEC §17.120 — determinism matters because the URLNode views
    // compare URL strings (not data: URL strings) when deciding
    // whether to regenerate. If `generateQRDataUrl` were non-
    // deterministic (e.g. random module order, timestamp comment),
    // a "no-op vm update" test couldn't reliably compare two
    // data: URL outputs. Pinning determinism here also catches a
    // future library upgrade that adds a generation-time nonce.
    const [a, b] = await Promise.all([
      generateQRDataUrl("https://example.com/x"),
      generateQRDataUrl("https://example.com/x"),
    ]);
    expect(a).toBe(b);
  });

  it("different inputs produce different data: URLs (the helper actually encodes the input — not a fixed-output stub)", async () => {
    const a = await generateQRDataUrl("https://example.com/a");
    const b = await generateQRDataUrl("https://example.com/b");
    expect(a).not.toBe(b);
  });
});
