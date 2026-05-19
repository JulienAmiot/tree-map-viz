import { describe, expect, it } from "vitest";

import { disabledToggleStyles } from "../../../../../adapters/ui/views/disabledToggle.js";

/**
 * §17.122a / §17.122b — the AsParent toggle switch pairs colour +
 * glyph + knob position so the state reads at a glance. The
 * §17.122b refinement keeps the pill body transparent so only three
 * elements carry colour:
 *
 *   DISABLED (aria-checked="false"):
 *     red border + red knob LEFT + red "×" glyph centred on RIGHT half.
 *   ENABLED  (aria-checked="true"):
 *     green border + green knob RIGHT + green "✓" glyph centred on LEFT half.
 *
 * These assertions lock the CSS contract (selectors + colour
 * literals + glyph escapes + knob/glyph anchors) so a future
 * refactor that flips polarity, swaps a colour, fills the
 * background, or moves the glyph into the knob fails loudly.
 * Visual + DOM-level wiring (event dispatch, aria-checked mapping)
 * is exercised by each AsParent view test (TextNode, ComputedCard,
 * BusinessScoreCard, WorkflowNode, etc.); this file owns the
 * style-contract assertions only.
 */
describe("disabledToggleStyles (§17.122b — outline + icon-aside)", () => {
  it("exposes a non-empty cssText payload (sanity check guarding against invalid ECMAScript escape sequences that would collapse the template's cooked string to undefined per the ES2018 template-literal-revision spec)", () => {
    expect(typeof disabledToggleStyles.cssText).toBe("string");
    expect(disabledToggleStyles.cssText.length).toBeGreaterThan(100);
  });

  it("default `.disabled-switch` paints a red border on a TRANSPARENT pill body (no solid fill)", () => {
    const css = disabledToggleStyles.cssText;
    expect(css).toMatch(/--dts-red:\s*rgb\(220,\s*38,\s*38\)/);
    expect(css).toMatch(/\.disabled-switch\s*\{[\s\S]*?border:\s*1\.5px\s+solid\s+var\(--dts-red\)/);
    expect(css).toMatch(/\.disabled-switch\s*\{[\s\S]*?background:\s*transparent/);
  });

  it("`aria-checked=\"true\"` swaps the border to green (tailwind green-500); background stays transparent (the transparent default carries through — no override redeclares it)", () => {
    const css = disabledToggleStyles.cssText;
    expect(css).toMatch(/--dts-green:\s*rgb\(34,\s*197,\s*94\)/);
    expect(css).toMatch(/\.disabled-switch\[aria-checked="true"\]\s*\{[\s\S]*?border-color:\s*var\(--dts-green\)/);
    // `background: transparent` appears exactly once — on the
    // default `.disabled-switch` block. The aria-checked override
    // only repaints the border colour; nothing fills the pill.
    const transparentBackgrounds = css.match(/background:\s*transparent/g) ?? [];
    expect(transparentBackgrounds.length).toBe(1);
  });

  it("knob is a SOLID coloured circle (no glyph inside), red by default and green when aria-checked=\"true\"", () => {
    const css = disabledToggleStyles.cssText;
    expect(css).toMatch(/\.disabled-switch\s+\.knob\s*\{[\s\S]*?background:\s*var\(--dts-red\)/);
    expect(css).toMatch(/\.disabled-switch\[aria-checked="true"\]\s+\.knob\s*\{[\s\S]*?background:\s*var\(--dts-green\)/);
    // The knob has no ::before / ::after rule any more — the glyph
    // moved onto the button itself, see the next test.
    expect(css).not.toMatch(/\.disabled-switch\s+\.knob::(before|after)/);
  });

  it("knob slides LEFT in the default (disabled) state and RIGHT when aria-checked=\"true\"", () => {
    const css = disabledToggleStyles.cssText;
    expect(css).toMatch(/\.disabled-switch\s+\.knob\s*\{[\s\S]*?left:\s*0\.12em/);
    expect(css).toMatch(/\.disabled-switch\[aria-checked="true"\]\s+\.knob\s*\{[\s\S]*?left:\s*calc\(100% - var\(--dts-h\)/);
  });

  it("glyph rides a `::before` pseudo on the BUTTON (not the knob) so it sits in the EMPTY half opposite the knob", () => {
    const css = disabledToggleStyles.cssText;
    // Default: glyph anchored at 72 % of the pill width (centre of the RIGHT half, knob is LEFT).
    expect(css).toMatch(/\.disabled-switch::before\s*\{[\s\S]*?left:\s*72%/);
    // Checked: glyph anchored at 28 % of the pill width (centre of the LEFT half, knob is RIGHT).
    expect(css).toMatch(/\.disabled-switch\[aria-checked="true"\]::before\s*\{[\s\S]*?left:\s*28%/);
  });

  it("glyph content is \"\u00d7\" (U+00D7) by default and flips to \"\u2713\" (U+2713) when aria-checked=\"true\"", () => {
    const css = disabledToggleStyles.cssText;
    expect(css).toMatch(/\.disabled-switch::before\s*\{[\s\S]*?content:\s*"\\00d7"/);
    expect(css).toMatch(/\.disabled-switch\[aria-checked="true"\]::before\s*\{[\s\S]*?content:\s*"\\2713"/);
  });

  it("glyph colour matches the active state (red on disabled, green on enabled) — the only thing besides the border + knob that carries colour", () => {
    const css = disabledToggleStyles.cssText;
    expect(css).toMatch(/\.disabled-switch::before\s*\{[\s\S]*?color:\s*var\(--dts-red\)/);
    expect(css).toMatch(/\.disabled-switch\[aria-checked="true"\]::before\s*\{[\s\S]*?color:\s*var\(--dts-green\)/);
  });
});
