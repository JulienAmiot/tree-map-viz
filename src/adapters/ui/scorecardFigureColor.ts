/** Stops: bright red → orange → yellow → bright green. */
const RED = { r: 255, g: 24, b: 24 } as const;
const ORANGE = { r: 255, g: 130, b: 0 } as const;
const YELLOW = { r: 255, g: 230, b: 0 } as const;
const GREEN = { r: 0, g: 220, b: 48 } as const;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(
  a: { readonly r: number; readonly g: number; readonly b: number },
  b: { readonly r: number; readonly g: number; readonly b: number },
  t: number,
) {
  return {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  };
}

/**
 * Map a figure to a color on the min→max scale along red → orange → yellow → green.
 * Below min: red; above target: green; between: interpolated along three segments.
 */
export function colorForScorecardFigure(
  figure: number,
  minimalValue: number,
  targetValue: number,
): string {
  let lo = minimalValue;
  let hi = targetValue;
  if (lo > hi) {
    [lo, hi] = [hi, lo];
  }

  let t: number;
  if (hi === lo) {
    t = figure >= hi ? 1 : 0;
  } else {
    t = (figure - lo) / (hi - lo);
    t = Math.max(0, Math.min(1, t));
  }

  if (t <= 1 / 3) {
    const u = t * 3;
    const c = lerpRgb(RED, ORANGE, u);
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
  }
  if (t <= 2 / 3) {
    const u = (t - 1 / 3) * 3;
    const c = lerpRgb(ORANGE, YELLOW, u);
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
  }
  const u = (t - 2 / 3) * 3;
  const c = lerpRgb(YELLOW, GREEN, u);
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}
