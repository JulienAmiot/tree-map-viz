import { describe, expect, it } from "vitest";

import { InvalidTitleError, Title } from "../../../../domain/values/Title.js";

describe("Title", () => {
  it("accepts a non-empty string and exposes its value", () => {
    expect(Title.of("Revenue North").value).toBe("Revenue North");
  });

  it("trims surrounding whitespace", () => {
    expect(Title.of("  Revenue North  ").value).toBe("Revenue North");
  });

  it("trims tabs and newlines too", () => {
    expect(Title.of("\t\nRevenue North\r\n ").value).toBe("Revenue North");
  });

  it("rejects an empty string", () => {
    expect(() => Title.of("")).toThrow(InvalidTitleError);
  });

  it("rejects an all-whitespace string", () => {
    expect(() => Title.of("   \t\n  ")).toThrow(InvalidTitleError);
  });

  it("accepts the maximum length (120 chars)", () => {
    const max = "a".repeat(120);
    expect(Title.of(max).value).toBe(max);
  });

  it("rejects a string longer than 120 chars", () => {
    expect(() => Title.of("a".repeat(121))).toThrow(InvalidTitleError);
  });

  it("counts the trimmed length, not the raw length", () => {
    const wrapped = "  " + "a".repeat(120) + "  ";
    expect(Title.of(wrapped).value).toBe("a".repeat(120));
  });

  it("compares by value (equal)", () => {
    expect(Title.of("foo").equals(Title.of("foo"))).toBe(true);
  });

  it("compares by value (different content)", () => {
    expect(Title.of("foo").equals(Title.of("bar"))).toBe(false);
  });

  it("compares case-sensitively", () => {
    expect(Title.of("Foo").equals(Title.of("foo"))).toBe(false);
  });

  it("equality is reflexive on a single instance", () => {
    const t = Title.of("X");
    expect(t.equals(t)).toBe(true);
  });

  it("toString returns the value", () => {
    expect(String(Title.of("Revenue North"))).toBe("Revenue North");
  });
});
