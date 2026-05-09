import { describe, expect, it } from "vitest";

import {
  currentValueDateIso,
  mostRecentChildDateIso,
} from "../../../../domain/aggregation/currentValueDate.js";
import { BusinessScoreCard } from "../../../../domain/nodes/BusinessScoreCard.js";
import { BusinessScoreCardNode } from "../../../../domain/nodes/BusinessScoreCardNode.js";
import { TextCard } from "../../../../domain/nodes/TextCard.js";
import { TextNode } from "../../../../domain/nodes/TextNode.js";
import { Description } from "../../../../domain/values/Description.js";
import { NodeIdentity } from "../../../../domain/values/NodeIdentity.js";
import { Objective } from "../../../../domain/values/Objective.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { TimestampedValue } from "../../../../domain/values/TimestampedValue.js";
import { Title } from "../../../../domain/values/Title.js";
import { Unit } from "../../../../domain/values/Unit.js";
import { Weight } from "../../../../domain/values/Weight.js";

const identity = NodeIdentity.of(Title.of("X"), Description.of(""));
const farFuture = Objective.of(0, 100, Timestamp.of(new Date("2030-12-31T00:00:00Z")));

function isoDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

function bsc(
  id: string,
  computed: boolean,
  eligible: boolean,
  history: { value: number; iso: string }[],
): BusinessScoreCardNode<number> {
  const card = BusinessScoreCard.of(
    Unit.percent(),
    farFuture,
    history.map((e) => TimestampedValue.of(e.value, Timestamp.of(isoDate(e.iso)))),
  );
  return new BusinessScoreCardNode<number>(
    id,
    identity,
    Weight.of(1),
    card,
    computed,
    eligible,
  );
}

function text(
  id: string,
  history: { value: string; iso: string }[],
): TextNode {
  const card = TextCard.of(
    history.map((e) => TimestampedValue.of(e.value, Timestamp.of(isoDate(e.iso)))),
  );
  return new TextNode(id, identity, Weight.of(1), card);
}

describe("currentValueDateIso (\u00a717.18)", () => {
  it("returns the latest history entry's ISO date for a recorded BSC", () => {
    const node = bsc("b", false, false, [
      { value: 1, iso: "2026-04-01" },
      { value: 2, iso: "2026-04-15" },
    ]);
    expect(currentValueDateIso(node)).toBe(isoDate("2026-04-15").toISOString());
  });

  it("returns null for a recorded BSC with empty history", () => {
    const node = bsc("b", false, false, []);
    expect(currentValueDateIso(node)).toBeNull();
  });

  it("returns the latest history entry's ISO date for a TextNode", () => {
    const node = text("t", [
      { value: "older", iso: "2026-04-01" },
      { value: "newer", iso: "2026-04-22" },
    ]);
    expect(currentValueDateIso(node)).toBe(isoDate("2026-04-22").toISOString());
  });

  it("returns null for a TextNode with empty history", () => {
    expect(currentValueDateIso(text("t", []))).toBeNull();
  });

  it("returns the most recent child date for a computed BSC", () => {
    const parent = bsc("p", true, false, [{ value: 0, iso: "2026-01-01" }]);
    parent.attach(bsc("c1", false, true, [{ value: 50, iso: "2026-03-15" }]));
    parent.attach(bsc("c2", false, true, [{ value: 70, iso: "2026-04-20" }]));
    parent.attach(bsc("c3", false, true, [{ value: 90, iso: "2026-02-01" }]));

    expect(currentValueDateIso(parent)).toBe(
      isoDate("2026-04-20").toISOString(),
    );
  });

  it("recurses through nested computed BSCs", () => {
    const root = bsc("root", true, false, [{ value: 0, iso: "2026-01-01" }]);
    const mid = bsc("mid", true, true, [{ value: 0, iso: "2026-01-01" }]);
    mid.attach(bsc("leaf-old", false, true, [{ value: 1, iso: "2026-02-10" }]));
    mid.attach(bsc("leaf-new", false, true, [{ value: 2, iso: "2026-04-29" }]));
    root.attach(mid);
    root.attach(bsc("sibling", false, true, [{ value: 3, iso: "2026-03-15" }]));

    expect(currentValueDateIso(root)).toBe(isoDate("2026-04-29").toISOString());
  });

  it("considers TextNode children for a computed BSC's date", () => {
    const parent = bsc("p", true, false, [{ value: 0, iso: "2026-01-01" }]);
    parent.attach(text("t1", [{ value: "x", iso: "2026-04-25" }]));
    parent.attach(bsc("b1", false, true, [{ value: 1, iso: "2026-04-10" }]));

    // The TextNode is more recent than the BSC sibling, even though it's
    // not "eligible" for the weighted-mean computation. Per §17.18 we
    // surface the most-recent-anywhere-underneath date.
    expect(currentValueDateIso(parent)).toBe(
      isoDate("2026-04-25").toISOString(),
    );
  });

  it("returns null for a computed BSC with no children with dates", () => {
    const parent = bsc("p", true, false, [{ value: 0, iso: "2026-01-01" }]);
    parent.attach(text("t-empty", []));
    expect(currentValueDateIso(parent)).toBeNull();
  });

  it("mostRecentChildDateIso returns null for a leaf with no children", () => {
    const node = bsc("leaf", false, false, [{ value: 1, iso: "2026-04-01" }]);
    expect(mostRecentChildDateIso(node)).toBeNull();
  });
});
