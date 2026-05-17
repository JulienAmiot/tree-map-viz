import { describe, expect, it } from "vitest";

import type { Clock } from "../../../../domain/capabilities/Clock.js";
import {
  currentValueDateIso,
  mostRecentChildDateIso,
} from "../../../../domain/aggregation/currentValueDate.js";
import { BusinessScoreNode } from "../../../../domain/nodes/BusinessScoreNode.js";
import { TextNodeV4 } from "../../../../domain/nodes/TextNodeV4.js";
import { NumericComparator } from "../../../../domain/values/Comparator.js";
import { Objective } from "../../../../domain/values/Objective.js";
import { LenientRange } from "../../../../domain/values/Range.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { Weight } from "../../../../domain/values/Weight.js";

const T = (iso: string): Timestamp => Timestamp.of(new Date(iso));
const clock: Clock = { now: () => T("2026-05-11T10:00:00Z") };
const w = Weight.of(1);
const lenient = (): LenientRange<number> =>
  LenientRange.of(
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    NumericComparator.INSTANCE,
  );
const obj = (): Objective<number> => Objective.of(100, T("2026-12-31T00:00:00Z"));

const buildBSC = (
  id: string,
  history: [string, number][] = [],
): BusinessScoreNode<number> => {
  const node = new BusinessScoreNode<number>(id, id, w, "", clock, lenient(), { objective: obj() });
  for (const [iso, v] of history) node.addValue(T(iso), v);
  return node;
};

const buildText = (id: string, history: [string, string][] = []): TextNodeV4 => {
  const node = new TextNodeV4(id, id, w, clock);
  for (const [iso, v] of history) node.addValue(T(iso), v);
  return node;
};

describe("currentValueDateIso (§17.89 — Phase B.1: v4-aware date helper, structural rule)", () => {
  it("leaf TextNodeV4: returns most-recent entry's asOf as ISO", () => {
    const text = buildText("t", [
      ["2026-01-01T00:00:00Z", "Q1"],
      ["2026-04-01T00:00:00Z", "Q2"],
    ]);
    expect(currentValueDateIso(text)).toBe("2026-04-01T00:00:00.000Z");
  });

  it("leaf BSC with history: returns its latest asOf as ISO", () => {
    const bsc = buildBSC("b", [
      ["2026-02-01T00:00:00Z", 20],
      ["2026-05-01T00:00:00Z", 50],
    ]);
    expect(currentValueDateIso(bsc)).toBe("2026-05-01T00:00:00.000Z");
  });

  it("leaf BSC with empty history: returns null", () => {
    expect(currentValueDateIso(buildBSC("empty"))).toBeNull();
  });

  it("leaf TextNodeV4 with empty history: returns null", () => {
    expect(currentValueDateIso(buildText("empty"))).toBeNull();
  });

  it("parent BSC: returns the most recent date amongst its children's currentValueDateIso", () => {
    const parent = buildBSC("p");
    parent.attach(buildBSC("c1", [["2026-01-01T00:00:00Z", 10]]));
    parent.attach(buildBSC("c2", [["2026-06-15T00:00:00Z", 20]]));
    parent.attach(buildBSC("c3", [["2026-03-10T00:00:00Z", 30]]));
    expect(currentValueDateIso(parent)).toBe("2026-06-15T00:00:00.000Z");
  });

  it("parent BSC recurses through grandchildren — most-recent observation anywhere underneath wins", () => {
    const root = buildBSC("root");
    const middle = buildBSC("middle");
    middle.attach(buildBSC("g1", [["2026-08-01T00:00:00Z", 10]]));
    middle.attach(buildBSC("g2", [["2026-02-01T00:00:00Z", 20]]));
    root.attach(middle);
    root.attach(buildBSC("sibling", [["2026-04-01T00:00:00Z", 99]]));
    expect(currentValueDateIso(root)).toBe("2026-08-01T00:00:00.000Z");
  });

  it("parent BSC with TextNodeV4 children: text children's dates also count toward the most-recent", () => {
    const parent = buildBSC("p");
    parent.attach(buildBSC("num", [["2026-01-01T00:00:00Z", 10]]));
    parent.attach(buildText("note", [["2026-09-01T00:00:00Z", "later note"]]));
    expect(currentValueDateIso(parent)).toBe("2026-09-01T00:00:00.000Z");
  });

  it("parent BSC with all-empty children subtree: returns null", () => {
    const parent = buildBSC("p");
    parent.attach(buildBSC("a"));
    parent.attach(buildBSC("b"));
    expect(currentValueDateIso(parent)).toBeNull();
  });

  it("mostRecentChildDateIso exported separately for direct view-layer use", () => {
    const parent = buildBSC("p");
    parent.attach(buildBSC("c1", [["2026-01-01T00:00:00Z", 1]]));
    parent.attach(buildBSC("c2", [["2026-07-01T00:00:00Z", 2]]));
    expect(mostRecentChildDateIso(parent)).toBe("2026-07-01T00:00:00.000Z");
  });

  it("mostRecentChildDateIso on a node with no children returns null", () => {
    expect(mostRecentChildDateIso(buildBSC("leaf"))).toBeNull();
  });
});
