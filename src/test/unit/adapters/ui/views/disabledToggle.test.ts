import { describe, expect, it } from "vitest";

import { disabledToggleStyles } from "../../../../../adapters/ui/views/disabledToggle.js";

/**
 * §17.122a — the AsParent toggle switch pairs colour + glyph + knob
 * position so the state reads at a glance:
 *
 *   DISABLED (aria-checked="false") → red pill, knob LEFT, "×" glyph
 *   ENABLED  (aria-checked="true")  → green pill, knob RIGHT, "✓" glyph
 *
 * These assertions lock the CSS contract (selectors + colour
 * literals + glyph escapes) so a future refactor that flips polarity
 * or swaps a colour without updating the docblock fails loudly.
 * Visual + DOM-level wiring (event dispatch, aria-checked mapping)
 * is exercised by each AsParent view test (TextNode, ComputedCard,
 * BusinessScoreCard, WorkflowNode, etc.); this file owns the
 * style-contract assertions only.
 */
describe("disabledToggleStyles (§17.122a — red/cross + green/check)", () => {
  it("exposes a non-empty cssText payload (sanity check guarding against invalid ECMAScript escape sequences that would collapse the template's cooked string to undefined per the ES2018 template-literal-revision spec)", () => {
    expect(typeof disabledToggleStyles.cssText).toBe("string");
    expect(disabledToggleStyles.cssText.length).toBeGreaterThan(100);
  });

  it("default `.disabled-switch` (no aria-checked / aria-checked=false) paints the pill red", () => {
    const css = disabledToggleStyles.cssText;
    expect(css).toMatch(/--dts-red:\s*rgb\(220,\s*38,\s*38\)/);
    expect(css).toMatch(/\.disabled-switch\s*\{[\s\S]*?background:\s*var\(--dts-red\)/);
  });

  it("`aria-checked=\"true\"` swaps the pill to green (tailwind green-500)", () => {
    const css = disabledToggleStyles.cssText;
    expect(css).toMatch(/--dts-green:\s*rgb\(34,\s*197,\s*94\)/);
    expect(css).toMatch(/\.disabled-switch\[aria-checked="true"\]\s*\{[\s\S]*?background:\s*var\(--dts-green\)/);
  });

  it("knob lives LEFT in the default (disabled) state and slides RIGHT when aria-checked=\"true\"", () => {
    const css = disabledToggleStyles.cssText;
    expect(css).toMatch(/\.disabled-switch\s+\.knob\s*\{[\s\S]*?left:\s*0\.12em/);
    expect(css).toMatch(/\.disabled-switch\[aria-checked="true"\]\s+\.knob\s*\{[\s\S]*?left:\s*calc\(100% - var\(--dts-h\)/);
  });

  it("knob glyph is \"\u00d7\" (U+00D7) by default and flips to \"\u2713\" (U+2713) when aria-checked=\"true\"", () => {
    const css = disabledToggleStyles.cssText;
    expect(css).toMatch(/\.disabled-switch\s+\.knob::before\s*\{[\s\S]*?content:\s*"\\00d7"/);
    expect(css).toMatch(/\.disabled-switch\[aria-checked="true"\]\s+\.knob::before\s*\{[\s\S]*?content:\s*"\\2713"/);
  });

  it("knob glyph is coloured to match the active pill (red on disabled, green on enabled) for high contrast on the light knob", () => {
    const css = disabledToggleStyles.cssText;
    expect(css).toMatch(/\.disabled-switch\s+\.knob\s*\{[\s\S]*?color:\s*var\(--dts-red\)/);
    expect(css).toMatch(/\.disabled-switch\[aria-checked="true"\]\s+\.knob\s*\{[\s\S]*?color:\s*var\(--dts-green\)/);
  });
});
