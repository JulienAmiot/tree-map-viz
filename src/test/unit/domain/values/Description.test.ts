import { describe, expect, it } from "vitest";

import { Description, InvalidDescriptionError } from "../../../../domain/values/Description.js";

describe("Description", () => {
  it("accepts a non-empty string and exposes its value", () => {
    expect(Description.of("North-region revenue").value).toBe("North-region revenue");
  });

  it("accepts an empty string", () => {
    expect(Description.of("").value).toBe("");
  });

  it("treats an all-whitespace string as empty", () => {
    expect(Description.of("   \t\n  ").value).toBe("");
  });

  it("trims surrounding whitespace", () => {
    expect(Description.of("  Hello  ").value).toBe("Hello");
  });

  it("preserves internal whitespace and newlines", () => {
    expect(Description.of("Line one\nLine two").value).toBe("Line one\nLine two");
  });

  it("accepts the maximum length (280 chars)", () => {
    const max = "a".repeat(280);
    expect(Description.of(max).value).toBe(max);
  });

  it("rejects a string longer than 280 chars", () => {
    expect(() => Description.of("a".repeat(281))).toThrow(InvalidDescriptionError);
  });

  it("counts the trimmed length, not the raw length", () => {
    const wrapped = "  " + "a".repeat(280) + "  ";
    expect(Description.of(wrapped).value).toBe("a".repeat(280));
  });

  it("compares by value (equal)", () => {
    expect(Description.of("foo").equals(Description.of("foo"))).toBe(true);
  });

  it("compares by value (different)", () => {
    expect(Description.of("foo").equals(Description.of("bar"))).toBe(false);
  });

  it("two empty descriptions are equal", () => {
    expect(Description.of("").equals(Description.of("   "))).toBe(true);
  });

  it("isEmpty returns true for empty values", () => {
    expect(Description.of("").isEmpty()).toBe(true);
    expect(Description.of("   ").isEmpty()).toBe(true);
  });

  it("isEmpty returns false for non-empty values", () => {
    expect(Description.of("X").isEmpty()).toBe(false);
  });

  it("toString returns the value", () => {
    expect(String(Description.of("Some text"))).toBe("Some text");
    expect(String(Description.of(""))).toBe("");
  });
});
