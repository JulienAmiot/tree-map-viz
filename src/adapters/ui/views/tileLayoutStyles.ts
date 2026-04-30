/**
 * Shared CSS for the four per-(kind × role) view elements (SPEC §17.14).
 *
 * The contract that every tile must satisfy:
 *
 *  - **Title row**: top of the tile, **fixed `3vh` height**, font-size also
 *    `vh`-relative so titles are visually consistent across tiles regardless
 *    of how big or small a given tile is. The "3 %" comes straight from the
 *    user requirement; bumping the constant is a one-line change.
 *  - **Timestamp**: absolutely-positioned in the **top-right corner**,
 *    rendered by the per-role element (the BSC value template tells
 *    callers via `timestampForValue()` whether to show one). Sized in
 *    `vh` so it stays readable at any tile size, and de-emphasised
 *    visually so it doesn't fight with the value for attention.
 *  - **Value box**: takes the rest of the tile (`flex: 1`) and centers a
 *    big value glyph. Font-size is `cqmin`-driven so the value fills the
 *    *tile* (container query — independent of the title's `vh` scale),
 *    clamped between a readable floor and a ceiling that doesn't blow
 *    out the largest tiles. The clamp range was tuned for 1280×720 –
 *    3840×2160 kiosk panels.
 *  - **Unit**: 1/3 of the value's font-size via `font-size: calc(1em / 3)`
 *    on a nested `<span class="unit">`. Because `em` resolves against
 *    the parent's computed font-size, the ratio holds whatever the
 *    `cqmin`-clamped value lands at.
 *
 * Each element imports this `tileLayoutStyles` constant and concats it
 * into its own `static styles`. The shared constant means a layout
 * tweak is a single-file change instead of a four-way grep.
 */

import { css } from "lit";

export const tileLayoutStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    container-type: size;
    position: relative;
    width: 100%;
    height: 100%;
    color: inherit;
    font: inherit;
    /* Modest inner padding lets the value breathe a little without
       eating into the available space too much; tuned to keep small
       tiles still legible. */
    padding: 0.4rem 0.6rem;
    overflow: hidden;
  }
  .title {
    margin: 0;
    height: 3vh;
    line-height: 3vh;
    font-size: 2vh;
    font-weight: 600;
    /* Fade out long titles instead of wrapping; we have a fixed 3vh
       height to honour. */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    /* Reserve room for the absolute-positioned timestamp on the right. */
    padding-right: clamp(3.5rem, 14vw, 8rem);
  }
  .timestamp {
    position: absolute;
    top: 0.4rem;
    right: 0.6rem;
    font-size: 1.4vh;
    line-height: 1;
    color: color-mix(in srgb, currentColor 60%, transparent);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .value-area {
    display: flex;
    align-items: center;
    justify-content: center;
    /* Fill the rest of the tile below the title row. */
    height: calc(100% - 3vh);
    text-align: center;
    overflow: hidden;
    /* Avoid a single very long word forcing horizontal overflow. */
    word-break: break-word;
  }
  .value {
    font-weight: 700;
    line-height: 1.05;
    /* SPEC §17.14 — value occupies the most space possible inside the
       tile. cqmin scales with the smaller of the tile's own width/
       height, clamped between a small-tile floor and a large-tile
       ceiling. The value lives inside .value-area so the flex
       centering handles the visual balance. */
    font-size: clamp(1.1rem, 18cqmin, 12rem);
  }
  .value.empty::before {
    content: "";
  }
  /* Unit nested inside the value: 1/3 of the value's surrounding
     font-size, regardless of where the cqmin clamp landed. */
  .value .unit {
    font-size: calc(1em / 3);
    font-weight: 500;
    color: color-mix(in srgb, currentColor 75%, transparent);
  }
  .sigma {
    /* Σ badge for computed BSCs — small chip near the value, tile-relative
       so it stays proportional. */
    margin-left: 0.45em;
    font-size: clamp(0.85rem, 4cqmin, 1.5rem);
    padding: 0.05em 0.4em;
    border-radius: 999px;
    background: color-mix(in srgb, currentColor 12%, transparent);
    color: color-mix(in srgb, currentColor 90%, transparent);
    vertical-align: middle;
  }
`;
