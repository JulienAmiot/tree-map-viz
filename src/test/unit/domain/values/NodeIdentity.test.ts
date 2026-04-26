import { describe, expect, it } from "vitest";

import { Description } from "../../../../domain/values/Description.js";
import { NodeIdentity } from "../../../../domain/values/NodeIdentity.js";
import { Title } from "../../../../domain/values/Title.js";

describe("NodeIdentity", () => {
  const titleA = Title.of("North");
  const titleB = Title.of("South");
  const descA = Description.of("Northern region");
  const descB = Description.of("Southern region");

  it("exposes its title and description", () => {
    const id = NodeIdentity.of(titleA, descA);
    expect(id.title.equals(titleA)).toBe(true);
    expect(id.description.equals(descA)).toBe(true);
  });

  it("two identities with the same components are equal", () => {
    const a = NodeIdentity.of(titleA, descA);
    const b = NodeIdentity.of(Title.of("North"), Description.of("Northern region"));
    expect(a.equals(b)).toBe(true);
  });

  it("two identities with different titles are not equal", () => {
    const a = NodeIdentity.of(titleA, descA);
    const b = NodeIdentity.of(titleB, descA);
    expect(a.equals(b)).toBe(false);
  });

  it("two identities with different descriptions are not equal", () => {
    const a = NodeIdentity.of(titleA, descA);
    const b = NodeIdentity.of(titleA, descB);
    expect(a.equals(b)).toBe(false);
  });

  it("equality is reflexive on a single instance", () => {
    const id = NodeIdentity.of(titleA, descA);
    expect(id.equals(id)).toBe(true);
  });

  it("an empty description is a valid component", () => {
    const id = NodeIdentity.of(titleA, Description.of(""));
    expect(id.description.isEmpty()).toBe(true);
  });
});
