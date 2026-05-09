import { describe, expect, it } from "vitest";

import { TextCard } from "../../../../domain/nodes/TextCard.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { TimestampedValue } from "../../../../domain/values/TimestampedValue.js";

const t1 = Timestamp.of(new Date("2026-04-22T00:00:00.000Z"));
const t2 = Timestamp.of(new Date("2026-04-23T00:00:00.000Z"));
const t3 = Timestamp.of(new Date("2026-04-24T00:00:00.000Z"));

describe("TextCard", () => {
  it("of() with no arguments produces an empty history", () => {
    const card = TextCard.of();
    expect(card.history()).toHaveLength(0);
  });

  it("of() sorts the supplied entries ascending by date (so latest is .at(-1))", () => {
    const card = TextCard.of([
      TimestampedValue.of("c", t3),
      TimestampedValue.of("a", t1),
      TimestampedValue.of("b", t2),
    ]);
    const h = card.history();
    expect(h.map((tv) => tv.value)).toEqual(["a", "b", "c"]);
      expect(h.at(-1)!.asOf.toISOString()).toBe(t3.moment.toISOString());
  });

  it("history() returns a frozen copy (defensive — callers cannot mutate the aggregate)", () => {
    const card = TextCard.of([TimestampedValue.of("x", t1)]);
    const h = card.history();
    expect(Object.isFrozen(h)).toBe(true);
  });

  it("addRecorded() inserts at the right index to keep the array sorted by date", () => {
    const card = TextCard.of([
      TimestampedValue.of("a", t1),
      TimestampedValue.of("c", t3),
    ]);
    card.addRecorded(TimestampedValue.of("b", t2));
    expect(card.history().map((tv) => tv.value)).toEqual(["a", "b", "c"]);
  });

  it("addRecorded() with a date later than all existing entries appends at the tail", () => {
    const card = TextCard.of([TimestampedValue.of("a", t1)]);
    card.addRecorded(TimestampedValue.of("z", t3));
    const h = card.history();
    expect(h.at(-1)!.value).toBe("z");
  });
});
