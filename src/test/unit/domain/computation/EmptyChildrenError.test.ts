import { describe, expect, it } from "vitest";

import { EmptyChildrenError } from "../../../../domain/computation/EmptyChildrenError.js";

describe("EmptyChildrenError (§17.95 — v5 round 7)", () => {
  it("extends Error with a stable name for cross-module instanceof recovery", () => {
    const err = new EmptyChildrenError("SUM");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(EmptyChildrenError);
    expect(err.name).toBe("EmptyChildrenError");
  });

  it("templates the message with the strategy kind", () => {
    expect(new EmptyChildrenError("AVERAGE").message).toBe(
      "AVERAGE computation has no eligible children",
    );
  });

  it("appends the parent hint when supplied", () => {
    expect(new EmptyChildrenError("MAX", "Root").message).toBe(
      `MAX computation has no eligible children for parent "Root"`,
    );
  });

  it("omits the parent hint when empty", () => {
    expect(new EmptyChildrenError("MIN", "").message).toBe(
      "MIN computation has no eligible children",
    );
  });
});
