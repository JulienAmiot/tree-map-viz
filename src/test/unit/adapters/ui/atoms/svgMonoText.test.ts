import { render } from "lit";
import { describe, expect, it } from "vitest";

import {
  MONO_CHAR_WIDTH,
  MONO_VIEWBOX_FONT_SIZE,
  renderMonoTextSvg,
} from "../../../../../adapters/ui/atoms/svgMonoText.js";

function renderToHost(template: ReturnType<typeof renderMonoTextSvg>): SVGSVGElement {
  const host = document.createElement("div");
  render(template, host);
  const svg = host.querySelector("svg");
  if (!svg) throw new Error("expected an <svg> root in the rendered template");
  return svg as SVGSVGElement;
}

describe("svgMonoText (SPEC §17.139)", () => {
  it("pins MONO_CHAR_WIDTH at 13.2 (= 0.6 \xd7 MONO_VIEWBOX_FONT_SIZE 22) -- the 0.59-0.6 monospace advance-width ratio averaged across Cascadia / SF Mono / Menlo at fontSize 22", () => {
    expect(MONO_CHAR_WIDTH).toBe(13.2);
    expect(MONO_VIEWBOX_FONT_SIZE).toBe(22);
    expect(MONO_CHAR_WIDTH / MONO_VIEWBOX_FONT_SIZE).toBeCloseTo(0.6, 5);
  });

  it("computes the SVG viewBox width from `text.length * MONO_CHAR_WIDTH` (no leftPadding) and the height from MONO_VIEWBOX_FONT_SIZE", () => {
    const svg = renderToHost(renderMonoTextSvg("99.6"));
    expect(svg.getAttribute("viewBox")).toBe(
      `0 0 ${4 * MONO_CHAR_WIDTH} ${MONO_VIEWBOX_FONT_SIZE}`,
    );
    expect(svg.getAttribute("width")).toBe("100%");
    expect(svg.getAttribute("height")).toBe("auto");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMinYMid meet");
  });

  it("adds the `leftPadding` to the viewBox width AND the `<text>` x-coordinate so callers can reserve viewBox space for a leading icon background", () => {
    const svg = renderToHost(renderMonoTextSvg("99.6", { leftPadding: 28 }));
    expect(svg.getAttribute("viewBox")).toBe(
      `0 0 ${28 + 4 * MONO_CHAR_WIDTH} ${MONO_VIEWBOX_FONT_SIZE}`,
    );
    const text = svg.querySelector("text");
    expect(text?.getAttribute("x")).toBe("28");
  });

  it("\u00a717.140 \u2014 adds `rightPadding` to the viewBox width WITHOUT shifting the text (xMinYMid meet keeps the glyph anchored at the left, so the extra room reads as trailing whitespace before a CSS background icon on the right edge)", () => {
    const svg = renderToHost(renderMonoTextSvg("99.6", { rightPadding: 10 }));
    expect(svg.getAttribute("viewBox")).toBe(
      `0 0 ${4 * MONO_CHAR_WIDTH + 10} ${MONO_VIEWBOX_FONT_SIZE}`,
    );
    expect(svg.querySelector("text")?.getAttribute("x")).toBe("0");
  });

  it("\u00a717.140 \u2014 `leftPadding` + `rightPadding` compose: viewBox width = leftPadding + text.length*MONO_CHAR_WIDTH + rightPadding", () => {
    const svg = renderToHost(
      renderMonoTextSvg("42", { leftPadding: 28, rightPadding: 5 }),
    );
    expect(svg.getAttribute("viewBox")).toBe(
      `0 0 ${28 + 2 * MONO_CHAR_WIDTH + 5} ${MONO_VIEWBOX_FONT_SIZE}`,
    );
  });

  it("renders the text content with `fill=\"currentColor\"` so the surrounding CSS color (e.g. `--bsc-value-color`) cascades into the SVG glyph paint", () => {
    const svg = renderToHost(renderMonoTextSvg("42"));
    const text = svg.querySelector("text");
    expect(text?.getAttribute("fill")).toBe("currentColor");
    expect(text?.textContent).toBe("42");
  });

  it("uses the bold weight (700) by default and accepts overrides via `fontWeight`", () => {
    const bold = renderToHost(renderMonoTextSvg("42"));
    expect(bold.querySelector("text")?.getAttribute("font-weight")).toBe("700");
    const normal = renderToHost(renderMonoTextSvg("42", { fontWeight: 400 }));
    expect(normal.querySelector("text")?.getAttribute("font-weight")).toBe("400");
  });

  it("forwards `testid` and `dataValueKind` options to the SVG / text data-* attributes so callers can pin them in e2e selectors", () => {
    const svg = renderToHost(
      renderMonoTextSvg("42", {
        testid: "my-value",
        dataValueKind: "recordedValue",
      }),
    );
    expect(svg.getAttribute("data-testid")).toBe("my-value");
    const text = svg.querySelector("text");
    expect(text?.getAttribute("data-value-kind")).toBe("recordedValue");
  });
});
