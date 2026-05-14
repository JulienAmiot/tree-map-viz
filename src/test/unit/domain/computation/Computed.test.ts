import { describe, expect, it } from "vitest";

import type { Computation } from "../../../../domain/computation/Computation.js";
import { ComputationKind } from "../../../../domain/computation/ComputationKind.js";
import { ComputationOverrideError } from "../../../../domain/computation/ComputationOverrideError.js";
import { ComputationRegistry } from "../../../../domain/computation/ComputationRegistry.js";
import type { Computed } from "../../../../domain/computation/Computed.js";

/**
 * Tiny stub implementing `Computed<T>` — pins the interface contract
 * (compile-time + runtime) ahead of the §17.97 / §17.98 concrete
 * implementers that wire the same shape onto real value-node subclasses.
 */
class StubComputed implements Computed<number> {
  private _kind: ComputationKind;
  constructor(initial: ComputationKind) { this._kind = initial; }
  get computationKind(): ComputationKind { return this._kind; }
  get computation(): Computation<number> { return ComputationRegistry.resolve(this._kind); }
  setComputationKind(kind: ComputationKind): void { this._kind = kind; }
}

describe("Computed<T> interface (§17.96)", () => {
  it("exposes computationKind + computation getters consistent with the registry", () => {
    const c = new StubComputed(ComputationKind.SUM);
    expect(c.computationKind).toBe(ComputationKind.SUM);
    expect(c.computation).toBe(ComputationRegistry.resolve(ComputationKind.SUM));
  });

  it("setComputationKind flips both the enum AND the resolved strategy (one source of truth)", () => {
    const c = new StubComputed(ComputationKind.SUM);
    c.setComputationKind(ComputationKind.AVERAGE);
    expect(c.computationKind).toBe(ComputationKind.AVERAGE);
    expect(c.computation).toBe(ComputationRegistry.resolve(ComputationKind.AVERAGE));
  });
});

describe("ComputationOverrideError (§17.96 — §17.94 D5)", () => {
  it("extends Error with stable name + audit-only message template", () => {
    const e = new ComputationOverrideError("metric-42");
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ComputationOverrideError);
    expect(e.name).toBe("ComputationOverrideError");
    expect(e.message).toContain(`Node "metric-42" is computed`);
    expect(e.message).toContain("history is audit-only");
    expect(e.message).toContain("edit the children or change the computationKind");
  });
});
