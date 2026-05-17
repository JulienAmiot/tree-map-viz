import type { Weight } from "../values/Weight.js";

import { ValueNode } from "./ValueNode.js";

/**
 * `PictureNode` — v4 concrete picture-typed node carrying a single
 * image URL (SPEC §17.119).
 *
 * Conceptually a *snapshot* leaf: unlike `TextNode` / BSC, a picture
 * does not have a meaningful "what was this last quarter?" timeline —
 * the operator either has a current source URL or they don't, and
 * swapping it is a replacement (the previous URL has no informational
 * value beyond "an old image used to live here"). The class therefore
 * inherits from {@link ValueNode}<string> rather than
 * `HistorizableValueNode<string>`: it implements the abstract
 * `getValue()` contract by returning the URL verbatim, and skips the
 * timestamped-history mechanism altogether.
 *
 * URL contract:
 *
 *   - Stored as a plain trimmed string. The class validates "non-empty
 *     after trim" but does NOT parse the URL into a structured value
 *     object — the browser is the authoritative validator (the `<img>`
 *     tag's `error` event fires on anything it can't load) and the
 *     adapter layer renders a `warning-fill` glyph in that case per
 *     the operator's "display the same warning sign as the computed
 *     card on failure" requirement (SPEC §17.119). Keeping the domain
 *     loose about the URL shape means `data:` URLs, `blob:` URLs, and
 *     remote `https:` sources all flow through unchanged.
 *   - Mutable via `setImageUrl(url)` — the same atomic-replacement
 *     pattern `setTitle` / `setWeight` use. `EditNodeService` calls
 *     this to apply an edit; failed validation throws synchronously so
 *     the service's all-or-nothing edit contract holds.
 *
 * `getDescription()` is inherited from `ValueNode` and returns the
 * empty `_description` slot — pictures collect no description today
 * (the title carries the operator-visible label; the image carries the
 * content). A future strand may surface an `alt` text field through
 * the modal; that would land here as a description seed without
 * changing the wire shape.
 */
export class PictureNode extends ValueNode<string> {
  private _imageUrl: string;

  constructor(id: string, title: string, weight: Weight, imageUrl: string) {
    super(id, title, weight, "");
    this._imageUrl = PictureNode.normaliseImageUrl(imageUrl);
  }

  override getValue(): string {
    return this._imageUrl;
  }

  get imageUrl(): string {
    return this._imageUrl;
  }

  setImageUrl(imageUrl: string): void {
    this._imageUrl = PictureNode.normaliseImageUrl(imageUrl);
  }

  private static normaliseImageUrl(raw: string): string {
    if (typeof raw !== "string") {
      throw new Error(
        `PictureNode.imageUrl must be a string; got ${typeof raw}`,
      );
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new Error("PictureNode.imageUrl cannot be empty");
    }
    return trimmed;
  }
}
