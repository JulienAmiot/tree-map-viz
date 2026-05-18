import type { Weight } from "../values/Weight.js";

import { ValueNode } from "./ValueNode.js";

/**
 * `URLNode` — v4 concrete URL-typed node carrying a single web URL the
 * adapter layer renders as a QR code (SPEC §17.120).
 *
 * Per the operator's strand request ("URLNode/URLCard: the URL is in
 * the description, it displays a QR code on the card (css rule for
 * object fit: contain)"), the URL is stored in the inherited
 * `_description` slot rather than a dedicated private field — the
 * description IS the URL on this kind. `setUrl(url)` calls
 * `setDescription(url)` after running the URL-shape validator, and
 * `url` is exposed as both a getter and the `getValue()` projection so
 * the view layer can read it without caring which slot stores the
 * string. The wire-format encoding follows the same convention: the
 * JSON envelope carries `"description": "<url>"` (no separate `url`
 * field) so the persistence layer's `ValueNode`-shaped decoder lifts
 * the URL through the standard description path.
 *
 * Conceptually a *snapshot* leaf, mirroring `PictureNode` (SPEC §17.119):
 * the operator either has a current URL or they don't, and swapping
 * it is a replacement (the previous URL has no informational value
 * beyond "an old link used to live here"). The class therefore
 * inherits from {@link ValueNode}<string> rather than
 * `HistorizableValueNode<string>`: it implements the abstract
 * `getValue()` contract by returning the URL verbatim, and skips the
 * timestamped-history mechanism altogether.
 *
 * URL contract:
 *
 *   - Stored as a plain trimmed string. The class validates "non-empty
 *     after trim" but does NOT parse the URL into a structured value
 *     object — the QR code generator is the authoritative validator
 *     (anything that round-trips through `QRCode.toDataURL(text)`
 *     produces a scannable code; arbitrary text encodes into a QR
 *     that scanners surface as plain text). Keeping the domain loose
 *     about the URL shape means `mailto:`, `tel:`, `sms:`, custom
 *     scheme URIs, and even non-URL text snippets all flow through
 *     unchanged; the kiosk operator gets a QR for whatever they
 *     entered. The view layer renders the §17.116 `warning-fill`
 *     glyph if QR generation throws (the qrcode library refuses
 *     inputs that exceed its max bit-density on the chosen error-
 *     correction level — extremely long strings).
 *   - Mutable via `setUrl(url)` — the same atomic-replacement pattern
 *     `setTitle` / `setWeight` / `PictureNode.setImageUrl` use.
 *     `EditNodeService` calls this to apply an edit; failed validation
 *     throws synchronously so the service's all-or-nothing edit
 *     contract holds.
 *
 * Unlike PictureNode whose description slot is intentionally empty,
 * URLNode's `getDescription()` returns the URL itself — the title
 * still labels the node ("Bug tracker", "Marketing playbook"), but
 * the description IS the URL string so existing description-aware
 * surfaces (codec round-trip, future "show description on hover"
 * affordances) automatically reflect the URL.
 */
export class URLNode extends ValueNode<string> {
  constructor(id: string, title: string, weight: Weight, url: string) {
    super(id, title, weight, URLNode.normaliseUrl(url));
  }

  override getValue(): string {
    return this.getDescription();
  }

  get url(): string {
    return this.getDescription();
  }

  setUrl(url: string): void {
    this.setDescription(URLNode.normaliseUrl(url));
  }

  private static normaliseUrl(raw: string): string {
    if (typeof raw !== "string") {
      throw new Error(`URLNode.url must be a string; got ${typeof raw}`);
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new Error("URLNode.url cannot be empty");
    }
    return trimmed;
  }
}
