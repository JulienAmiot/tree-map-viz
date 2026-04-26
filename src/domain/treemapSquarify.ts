/**
 * Squarified treemap layout (Bruls, Huizing, van Wijk), adapted from d3-hierarchy
 * (BSD-3, https://github.com/d3/d3-hierarchy) — same row choice and aspect control.
 * Maps weights to axis-aligned rectangles that fill the container with near-square tiles.
 */

/** Default aspect ratio (golden) used by d3’s squarify tile. */
const PHI = (1 + Math.sqrt(5)) / 2;

/**
 * Min-tile floor (SPEC §4): every tile is at least 1/MIN_TILE_DENOM of the children area.
 * Set to 12 to match the equal-weight worst case at MAX_CHILDREN=12.
 */
const MIN_TILE_DENOM = 12;

/**
 * Rebalances `weights` so that no weight is below sumW/MIN_TILE_DENOM, which guarantees
 * every resulting tile occupies at least 1/MIN_TILE_DENOM of the children area.
 *
 * Fixed-point iteration: clamping a weight up raises the running sum, which raises the
 * threshold, which may force more clamping. Converges because each pass either changes
 * nothing (stable) or strictly increases the running sum toward the analytical bound
 * `T = (sum of weights above T) / (MIN_TILE_DENOM - K)` where K is the count below T.
 *
 * Pure: returns a new array; does not mutate the input.
 */
function clampWeightsToFloor(weights: readonly number[]): number[] {
  const w = weights.slice();
  // Bound the iteration to keep this safe even on pathological inputs.
  // Convergence is monotone in `sum`, and each non-trivial pass either strictly
  // raises some weight or stops. 64 passes is well above the worst case for n ≤ 12.
  const MAX_PASSES = 64;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let sum = 0;
    for (const v of w) {
      sum += v;
    }
    if (sum <= 0) {
      return w;
    }
    const threshold = sum / MIN_TILE_DENOM;
    let changed = false;
    for (let i = 0; i < w.length; i++) {
      if (w[i]! < threshold - 1e-9) {
        w[i] = threshold;
        changed = true;
      }
    }
    if (!changed) {
      return w;
    }
  }
  return w;
}

type TileNode = {
  value: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type TileRow = {
  value: number;
  dice: boolean;
  children: TileNode[];
};

type TileParent = { value: number; children: TileNode[] };

function treemapDice(parent: TileRow, x0: number, y0: number, x1: number, y1: number) {
  const nodes = parent.children;
  let i = -1;
  const n = nodes.length;
  const pVal = parent.value;
  const k = pVal && (x1 - x0) / pVal;
  while (++i < n) {
    const node = nodes[i]!;
    node.y0 = y0;
    node.y1 = y1;
    node.x0 = x0;
    node.x1 = x0 += k ? node.value * k : 0;
  }
}

function treemapSlice(parent: TileRow, x0: number, y0: number, x1: number, y1: number) {
  const nodes = parent.children;
  let i = -1;
  const n = nodes.length;
  const pVal = parent.value;
  const k = pVal && (y1 - y0) / pVal;
  while (++i < n) {
    const node = nodes[i]!;
    node.x0 = x0;
    node.x1 = x1;
    node.y0 = y0;
    node.y1 = y0 += k ? node.value * k : 0;
  }
}

/**
 * Mutates `parent.children` with x0,y0,x1,y1. Uses a running `value` (remaining area weight)
 * like d3, not a fixed parent total, so each row is sized against what is left to place.
 */
function squarifyWithMutableValue(
  ratio: number,
  parent: TileParent,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  const nodes = parent.children;
  const n = nodes.length;
  let value = parent.value;
  let i0 = 0;
  let i1 = 0;

  while (i0 < n) {
    const dx = x1 - x0;
    const dy = y1 - y0;

    let sumValue: number;
    // Find the next non-empty node (d3: do { sumValue = nodes[i1++].value; } while …).
    do {
      sumValue = nodes[i1]!.value;
      i1 += 1;
    } while (!sumValue && i1 < n);

    if (!sumValue) {
      break;
    }

    let minValue = sumValue;
    let maxValue = sumValue;
    const alpha = Math.max(dy / dx, dx / dy) / (value * ratio);
    let beta = sumValue * sumValue * alpha;
    let minRatio = Math.max(maxValue / beta, beta / minValue);
    let nodeValue: number;

    for (; i1 < n; ++i1) {
      nodeValue = nodes[i1]!.value;
      sumValue += nodeValue;
      if (nodeValue < minValue) {
        minValue = nodeValue;
      }
      if (nodeValue > maxValue) {
        maxValue = nodeValue;
      }
      beta = sumValue * sumValue * alpha;
      const newRatio = Math.max(maxValue / beta, beta / minValue);
      if (newRatio > minRatio) {
        sumValue -= nodeValue;
        break;
      }
      minRatio = newRatio;
    }

    const row: TileRow = {
      value: sumValue,
      dice: dx < dy,
      children: nodes.slice(i0, i1) as TileNode[],
    };

    if (row.dice) {
      treemapDice(row, x0, y0, x1, value ? (y0 += (dy * sumValue) / value) : y1);
    } else {
      treemapSlice(row, x0, y0, value ? (x0 += (dx * sumValue) / value) : x1, y1);
    }
    value -= sumValue;
    i0 = i1;
  }
}

/**
 * Lays out `weights` into rectangles covering [0,w]×[0,h] in the same order as inputs.
 * Each rectangle’s area is proportional to its weight. Squarify picks row splits so
 * each tile is as close to square as the row geometry allows.
 * Zero/negative weights are treated as 0; if the sum is 0, areas are equal.
 */
export function layoutSquarified(
  weights: number[],
  width: number,
  height: number,
  options: { aspectRatio?: number; padding?: number } = {},
): { x: number; y: number; w: number; h: number }[] {
  const ratio = options.aspectRatio ?? PHI;
  const padding = options.padding ?? 0;
  const n = weights.length;
  if (n === 0 || width <= 0 || height <= 0) {
    return [];
  }
  if (n === 1) {
    const p = padding;
    return [
      { x: p, y: p, w: width - 2 * p, h: height - 2 * p },
    ];
  }

  const safe = weights.map((w) => (w > 0 ? w : 0));
  let sumW = 0;
  for (const w of safe) {
    sumW += w;
  }
  if (sumW <= 0) {
    for (let i = 0; i < safe.length; i++) {
      safe[i] = 1;
    }
    sumW = n;
  }

  // SPEC §4: apply the 1/12 min-tile floor before laying out so tiles stay tappable
  // even when weights are skewed. The squarify quality degrades slightly in exchange.
  const clamped = clampWeightsToFloor(safe);
  sumW = 0;
  for (const w of clamped) {
    sumW += w;
  }

  const children: TileNode[] = clamped.map((v) => ({
    value: v,
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 0,
  }));

  const parent: TileParent = { value: sumW, children };
  const p = padding;
  const innerW = width - 2 * p;
  const innerH = height - 2 * p;
  squarifyWithMutableValue(ratio, parent, p, p, p + innerW, p + innerH);

  return children.map((c) => ({
    x: c.x0,
    y: c.y0,
    w: c.x1 - c.x0,
    h: c.y1 - c.y0,
  }));
}
