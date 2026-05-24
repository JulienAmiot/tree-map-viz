/**
 * `<ds-icon>` — atomic-design icon atom (SPEC §17.131).
 *
 * Renders one of the project's iconography signs as an inline SVG from
 * the open-source Lucide library (https://lucide.dev). Replaces the
 * mix of Unicode glyphs + CSS-pseudo `content:` glyphs the kiosk used
 * pre-§17.131; full rationale lives in the SPEC entry.
 *
 * Naming: the `name` attribute uses Lucide's own kebab-case slugs
 * (e.g. `weight`, `pencil`, `triangle-alert`) so the catalogue
 * at https://lucide.dev is a 1-1 reference. Unknown names render
 * `nothing` (no console noise). Adding a new icon = one `?raw`
 * import + one entry in `ICON_REGISTRY` below.
 *
 * Accessibility: decorative by default (`aria-hidden="true"`,
 * `role="presentation"`). Setting `label` switches to
 * `role="img" aria-label=<label> aria-hidden="false"`.
 *
 * License: the full Lucide ISC + Feather MIT texts are mirrored in
 * `THIRD_PARTY_LICENSES.md` at the repo root; the About modal's
 * "Open-source notices" row links there at runtime.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";

import arrowDownSvg from "lucide-static/icons/arrow-down.svg?raw";
import arrowDownRightSvg from "lucide-static/icons/arrow-down-right.svg?raw";
import arrowRightSvg from "lucide-static/icons/arrow-right.svg?raw";
import arrowUpSvg from "lucide-static/icons/arrow-up.svg?raw";
import arrowUpRightSvg from "lucide-static/icons/arrow-up-right.svg?raw";
import banSvg from "lucide-static/icons/ban.svg?raw";
import checkSvg from "lucide-static/icons/check.svg?raw";
import pencilSvg from "lucide-static/icons/pencil.svg?raw";
import plusSvg from "lucide-static/icons/plus.svg?raw";
import sigmaSvg from "lucide-static/icons/sigma.svg?raw";
import targetSvg from "lucide-static/icons/target.svg?raw";
import triangleAlertSvg from "lucide-static/icons/triangle-alert.svg?raw";
import weightSvg from "lucide-static/icons/weight.svg?raw";
import xSvg from "lucide-static/icons/x.svg?raw";

/** Lucide icons currently used or pre-registered for an upcoming
 * migration strand. Per-slug rationale lives in SPEC §17.131. */
export const ICON_REGISTRY: Readonly<Record<string, string>> = Object.freeze({
  "arrow-down": arrowDownSvg,
  "arrow-down-right": arrowDownRightSvg,
  "arrow-right": arrowRightSvg,
  "arrow-up": arrowUpSvg,
  "arrow-up-right": arrowUpRightSvg,
  ban: banSvg,
  check: checkSvg,
  pencil: pencilSvg,
  plus: plusSvg,
  sigma: sigmaSvg,
  target: targetSvg,
  "triangle-alert": triangleAlertSvg,
  weight: weightSvg,
  x: xSvg,
});

export type DsIconName = keyof typeof ICON_REGISTRY;

@customElement("ds-icon")
export class DsIcon extends LitElement {
  /** Lucide slug — see `ICON_REGISTRY` above for the kiosk's catalogue.
   * Unknown values render `nothing`. */
  @property({ type: String })
  name = "";

  /** When non-empty, switches the host from decorative
   * (`aria-hidden="true"`, `role="presentation"`) to
   * `role="img" aria-label=<label>` so a screen reader announces
   * the glyph as an image. */
  @property({ type: String })
  label = "";

  /* Host defaults to a 1em inline-flex line-box so the glyph scales
     with the surrounding font-size. Callsites that need a fixed
     pixel size override `width` / `height` via plain CSS. Lucide
     bakes `stroke-width="2"` into every SVG; the CSS `var()` lets
     callsites bump line weight without re-rendering. */
  static readonly styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1em;
      height: 1em;
      line-height: 0;
      color: inherit;
    }
    svg {
      width: 100%;
      height: 100%;
      stroke-width: var(--ds-icon-stroke-width, 2);
    }
  `;

  render() {
    const raw = ICON_REGISTRY[this.name];
    if (!raw) return nothing;
    const decorative = this.label === "";
    return html`<span
      role=${decorative ? "presentation" : "img"}
      aria-hidden=${decorative ? "true" : "false"}
      aria-label=${decorative ? nothing : this.label}
      data-testid="ds-icon-${this.name}"
      >${unsafeSVG(raw)}</span
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ds-icon": DsIcon;
  }
}
