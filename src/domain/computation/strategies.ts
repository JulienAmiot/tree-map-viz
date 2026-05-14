import type { Node } from "../nodes/Node.js";

import { Computation } from "./Computation.js";
import { EmptyChildrenError } from "./EmptyChildrenError.js";

/**
 * Six concrete `Computation<number>` singletons (SPEC §17.95 / v5 round 7).
 * Co-located matching §17.68 `Comparator.ts` (sibling singletons of one
 * abstract). Sum / Average / Min / Max share `NumericFoldComputation`;
 * WeightedAverage needs each child's `Node.weight.value` so it can't share;
 * Count is the only T-agnostic strategy + returns 0 on empty (§17.94 risk #2).
 */
abstract class NumericFoldComputation extends Computation<number> {
  protected constructor(private readonly kindName: string) {
    super();
  }

  apply(children: readonly Node[]): number {
    const vs: number[] = [];
    for (const c of this.enabledValueNodes(children)) {
      const v = this.tryReadNumber(c);
      if (v !== undefined) vs.push(v);
    }
    if (vs.length === 0) throw new EmptyChildrenError(this.kindName);
    return this.fold(vs);
  }

  protected abstract fold(vs: readonly number[]): number;
}

export class SumComputation extends NumericFoldComputation {
  private constructor() { super("SUM"); }
  static readonly INSTANCE = new SumComputation();
  protected fold(vs: readonly number[]) { return vs.reduce((a, v) => a + v, 0); }
}

export class AverageComputation extends NumericFoldComputation {
  private constructor() { super("AVERAGE"); }
  static readonly INSTANCE = new AverageComputation();
  protected fold(vs: readonly number[]) {
    return vs.reduce((a, v) => a + v, 0) / vs.length;
  }
}

export class MinComputation extends NumericFoldComputation {
  private constructor() { super("MIN"); }
  static readonly INSTANCE = new MinComputation();
  protected fold(vs: readonly number[]) { return vs.reduce((m, v) => v < m ? v : m, vs[0]); }
}

export class MaxComputation extends NumericFoldComputation {
  private constructor() { super("MAX"); }
  static readonly INSTANCE = new MaxComputation();
  protected fold(vs: readonly number[]) { return vs.reduce((m, v) => v > m ? v : m, vs[0]); }
}

export class WeightedAverageComputation extends Computation<number> {
  private constructor() { super(); }
  static readonly INSTANCE = new WeightedAverageComputation();

  apply(children: readonly Node[]): number {
    let sumWV = 0, sumW = 0, count = 0;
    for (const c of this.enabledValueNodes(children)) {
      const v = this.tryReadNumber(c);
      if (v === undefined) continue;
      const w = c.weight.value;
      sumWV += v * w;
      sumW += w;
      count += 1;
    }
    if (count === 0 || sumW === 0) throw new EmptyChildrenError("WEIGHTED_AVERAGE");
    return sumWV / sumW;
  }
}

export class CountComputation extends Computation<number> {
  private constructor() { super(); }
  static readonly INSTANCE = new CountComputation();
  apply(children: readonly Node[]): number {
    return this.enabledValueNodes(children).length;
  }
}
