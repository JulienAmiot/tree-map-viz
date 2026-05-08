import { describe, expect, it } from "vitest";

import { dateAgeColor } from "../../../../../adapters/ui/views/dateAgeColor.js";
import {
  mapFocusedToViewModel,
  mapNodeToViewModel,
  ViewModelMappingError,
} from "../../../../../adapters/ui/views/viewModelMapper.js";
import { BusinessScoreCard } from "../../../../../domain/nodes/BusinessScoreCard.js";
import { BusinessScoreCardNode } from "../../../../../domain/nodes/BusinessScoreCardNode.js";
import { TextCard } from "../../../../../domain/nodes/TextCard.js";
import { TextNode } from "../../../../../domain/nodes/TextNode.js";
import { TreeNode } from "../../../../../domain/nodes/TreeNode.js";
import { Description } from "../../../../../domain/values/Description.js";
import { NodeIdentity } from "../../../../../domain/values/NodeIdentity.js";
import { Objective } from "../../../../../domain/values/Objective.js";
import { Timestamp } from "../../../../../domain/values/Timestamp.js";
import { TimestampedValue } from "../../../../../domain/values/TimestampedValue.js";
import { Title } from "../../../../../domain/values/Title.js";
import { Unit } from "../../../../../domain/values/Unit.js";
import { Weight } from "../../../../../domain/values/Weight.js";

const targetDate = Timestamp.of(new Date("2026-12-31T00:00:00.000Z"));

function identityOf(title: string, description: string): NodeIdentity {
  return NodeIdentity.of(Title.of(title), Description.of(description));
}

/** Default seed date for TextNode helpers; arbitrary but deterministic. */
const DEFAULT_TEXT_DATE = new Date("2026-04-23T18:25:43.511Z");

function makeText(
  id: string,
  title: string,
  description = "",
  history: { value: string; date: Date }[] = [{ value: title, date: DEFAULT_TEXT_DATE }],
): TextNode {
  const card = TextCard.of(
    history.map((e) => TimestampedValue.of(e.value, e.date)),
  );
  return new TextNode(id, identityOf(title, description), Weight.of(1), card);
}

function makeBsc(opts: {
  id: string;
  title: string;
  description?: string;
  computed: boolean;
  eligible: boolean;
  history: { value: number; iso: string }[];
  weight?: number;
}): BusinessScoreCardNode<number> {
  const card = BusinessScoreCard.of(
    Unit.percent(),
    Objective.of(0, 100, targetDate),
    opts.history.map((e) => TimestampedValue.of(e.value, new Date(e.iso))),
  );
  return new BusinessScoreCardNode<number>(
    opts.id,
    identityOf(opts.title, opts.description ?? ""),
    Weight.of(opts.weight ?? 1),
    card,
    opts.computed,
    opts.eligible,
  );
}

describe("mapNodeToViewModel", () => {
  it("maps a TextNode to a TextNodeViewModel with the latest history entry as `value` (\u00a717.14)", () => {
    const node = makeText("t1", "Quarterly review", "Top-level scorecard", [
      { value: "older", date: new Date("2026-04-22T00:00:00.000Z") },
      { value: "newest", date: DEFAULT_TEXT_DATE },
    ]);
    const vm = mapNodeToViewModel(node);

    // SPEC §17.15 — TextNode VM intentionally omits `description`.
    expect(vm).toEqual({
      kind: "TextNode",
      id: "t1",
      title: "Quarterly review",
      value: {
        text: "newest",
        dateIso: DEFAULT_TEXT_DATE.toISOString(),
        // SPEC §17.21 — mapper bakes the per-tile dateColor.
        dateColor: dateAgeColor(DEFAULT_TEXT_DATE.toISOString()),
      },
    });
    expect(vm).not.toHaveProperty("description");
  });

  it("falls back to an empty value when the TextNode's history is empty (graceful degradation)", () => {
    const node = makeText("t-empty", "Empty", "", []);
    const vm = mapNodeToViewModel(node);
    if (vm.kind !== "TextNode") throw new Error("expected TextNode VM");
    expect(vm.value).toEqual({ text: "", dateIso: "", dateColor: "" });
  });

  it("maps computed=false BSC to recordedValue VM with the latest TimestampedValue", () => {
    const node = makeBsc({
      id: "b1",
      title: "Sales",
      description: "Revenue",
      computed: false,
      eligible: true,
      history: [
        { value: 95, iso: "2026-04-22T18:25:43.511Z" },
        { value: 104, iso: "2026-04-23T18:25:43.511Z" },
      ],
    });

    const vm = mapNodeToViewModel(node);

    if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC VM");
    expect(vm.id).toBe("b1");
    expect(vm.title).toBe("Sales");
    expect(vm.description).toBe("Revenue");
    expect(vm.value).toEqual({
      kind: "recordedValue",
      value: 104,
      unit: "%",
      dateIso: "2026-04-23T18:25:43.511Z",
    });
    // SPEC §17.18 — top-level dateIso mirrors the recorded value's date.
    expect(vm.dateIso).toBe("2026-04-23T18:25:43.511Z");
    // SPEC §17.21 — mapper bakes the per-tile dateColor next to dateIso.
    expect(vm.dateColor).toBe(dateAgeColor("2026-04-23T18:25:43.511Z"));
    // SPEC §17.40 — objective info baked. Target = 100, current = 104 →
    // overachiever → green. With only 2 history entries on an upward
    // trend (95 → 104) the regression extrapolated to year-end far
    // exceeds 100 → no deadline-risk warning.
    expect(vm.objective.targetValue).toBe(100);
    expect(vm.objective.targetDateIso).toBe(targetDate.moment.toISOString());
    expect(vm.objective.unit).toBe("%");
    expect(vm.objective.valueColor).toBe("rgb(22, 163, 74)");
    expect(vm.objective.warningColor).toBe("");
  });

  it("sets vm.dateIso to the most recent eligible child's date for a computed BSC (\u00a717.18)", () => {
    const parent = makeBsc({
      id: "p-dates",
      title: "Group",
      computed: true,
      eligible: false,
      history: [{ value: 0, iso: "2026-01-01T00:00:00.000Z" }],
    });
    parent.attach(
      makeBsc({
        id: "older",
        title: "Older",
        computed: false,
        eligible: true,
        history: [{ value: 50, iso: "2026-03-01T00:00:00.000Z" }],
      }),
    );
    parent.attach(
      makeBsc({
        id: "newer",
        title: "Newer",
        computed: false,
        eligible: true,
        history: [{ value: 70, iso: "2026-04-15T00:00:00.000Z" }],
      }),
    );

    const vm = mapNodeToViewModel(parent);
    if (vm.kind !== "BusinessScoreCardNode") {
      throw new Error("expected BSC VM");
    }
    expect(vm.dateIso).toBe(new Date("2026-04-15T00:00:00.000Z").toISOString());
  });

  it("recurses through nested computed BSCs to find the most recent date (\u00a717.18)", () => {
    const grandparent = makeBsc({
      id: "gp",
      title: "GP",
      computed: true,
      eligible: false,
      history: [{ value: 0, iso: "2026-01-01T00:00:00.000Z" }],
    });
    const parent = makeBsc({
      id: "p",
      title: "P",
      computed: true,
      eligible: true,
      history: [{ value: 0, iso: "2026-01-01T00:00:00.000Z" }],
    });
    parent.attach(
      makeBsc({
        id: "leaf-old",
        title: "Old",
        computed: false,
        eligible: true,
        history: [{ value: 10, iso: "2026-02-01T00:00:00.000Z" }],
      }),
    );
    parent.attach(
      makeBsc({
        id: "leaf-new",
        title: "New",
        computed: false,
        eligible: true,
        history: [{ value: 20, iso: "2026-04-29T00:00:00.000Z" }],
      }),
    );
    grandparent.attach(parent);

    const vm = mapNodeToViewModel(grandparent);
    if (vm.kind !== "BusinessScoreCardNode") {
      throw new Error("expected BSC VM");
    }
    expect(vm.dateIso).toBe(new Date("2026-04-29T00:00:00.000Z").toISOString());
  });

  it("vm.dateIso is empty when a computed BSC has no children with dates (\u00a717.18)", () => {
    const parent = makeBsc({
      id: "p-empty",
      title: "Empty",
      computed: true,
      eligible: false,
      history: [{ value: 0, iso: "2026-01-01T00:00:00.000Z" }],
    });
    // Attach a TextNode with empty history → no contributing date.
    parent.attach(makeText("t-empty", "leaf", "", []));

    const vm = mapNodeToViewModel(parent);
    if (vm.kind !== "BusinessScoreCardNode") {
      throw new Error("expected BSC VM");
    }
    expect(vm.dateIso).toBe("");
  });

  it("maps computed=true with eligible children to a weighted-mean computedMean VM", () => {
    const parent = makeBsc({
      id: "p",
      title: "Group",
      computed: true,
      eligible: false,
      history: [{ value: 0, iso: "2026-04-23T00:00:00.000Z" }],
    });
    parent.attach(
      makeBsc({
        id: "c1",
        title: "C1",
        computed: false,
        eligible: true,
        history: [{ value: 80, iso: "2026-04-23T00:00:00.000Z" }],
        weight: 3,
      }),
    );
    parent.attach(
      makeBsc({
        id: "c2",
        title: "C2",
        computed: false,
        eligible: true,
        history: [{ value: 40, iso: "2026-04-23T00:00:00.000Z" }],
        weight: 1,
      }),
    );

    const vm = mapNodeToViewModel(parent);

    expect(vm.kind).toBe("BusinessScoreCardNode");
    if (vm.kind !== "BusinessScoreCardNode") return;
    expect(vm.value).toEqual({
      kind: "computedMean",
      mean: (80 * 3 + 40 * 1) / (3 + 1),
      unit: "%",
    });
  });

  it("maps computed=true with zero eligible children to childrenCount VM", () => {
    const parent = makeBsc({
      id: "p2",
      title: "Group",
      computed: true,
      eligible: false,
      history: [{ value: 0, iso: "2026-04-23T00:00:00.000Z" }],
    });
    parent.attach(makeText("t1", "leaf 1"));
    parent.attach(makeText("t2", "leaf 2"));
    parent.attach(makeText("t3", "leaf 3"));

    const vm = mapNodeToViewModel(parent);

    if (vm.kind !== "BusinessScoreCardNode") {
      throw new Error("expected BusinessScoreCardNode VM");
    }
    expect(vm.value).toEqual({ kind: "childrenCount", n: 3 });
  });

  it("maps computed=true with zero children to childrenCount n=0", () => {
    const parent = makeBsc({
      id: "p3",
      title: "Empty",
      computed: true,
      eligible: false,
      history: [{ value: 0, iso: "2026-04-23T00:00:00.000Z" }],
    });

    const vm = mapNodeToViewModel(parent);
    if (vm.kind !== "BusinessScoreCardNode") {
      throw new Error("expected BusinessScoreCardNode VM");
    }
    expect(vm.value).toEqual({ kind: "childrenCount", n: 0 });
  });

  it("throws on unsupported TreeNode subclass", () => {
    class Mystery extends TreeNode<number> {
      currentValue(): never {
        throw new Error("nope");
      }
    }
    const node = new Mystery("m", identityOf("m", ""), Weight.of(1));
    expect(() => mapNodeToViewModel(node)).toThrow(ViewModelMappingError);
  });

  // -- SPEC §17.40 — objective-progress baking ---------------------------

  it("\u00a717.40 — bakes red valueColor when current value sits at the minimum (ascending)", () => {
    const node = makeBsc({
      id: "b-low",
      title: "NPS",
      computed: false,
      eligible: true,
      history: [{ value: 0, iso: "2026-04-23T00:00:00.000Z" }],
    });
    const vm = mapNodeToViewModel(node);
    if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    // Objective is min=0, target=100; value=0 → fraction 0 → red.
    expect(vm.objective.valueColor).toBe("rgb(220, 38, 38)");
  });

  it("\u00a717.40 — bakes green valueColor when current value reaches the target (ascending)", () => {
    const node = makeBsc({
      id: "b-hit",
      title: "NPS",
      computed: false,
      eligible: true,
      history: [{ value: 100, iso: "2026-04-23T00:00:00.000Z" }],
    });
    const vm = mapNodeToViewModel(node);
    if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    expect(vm.objective.valueColor).toBe("rgb(22, 163, 74)");
  });

  it("\u00a717.40 — direction-agnostic: descending objective (target < min) reads off the same fraction", () => {
    // Custom-build a BSC with min=100, target=20 (e.g. *reduce errors*).
    const card = BusinessScoreCard.of(
      Unit.percent(),
      Objective.of(100, 20, targetDate),
      [TimestampedValue.of(20, new Date("2026-04-23T00:00:00.000Z"))],
    );
    const node = new BusinessScoreCardNode<number>(
      "b-desc",
      identityOf("Errors", ""),
      Weight.of(1),
      card,
      false,
      true,
    );
    const vm = mapNodeToViewModel(node);
    if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    // Current = target = 20 → green for a descending objective too.
    expect(vm.objective.valueColor).toBe("rgb(22, 163, 74)");
    expect(vm.objective.targetValue).toBe(20);
  });

  it("\u00a717.44 — bakes a non-empty warningColor when the regression-extrapolated value falls short of target", () => {
    // First value 0 on 2026-01-01, then 10 on 2026-07-02. Target 100 by
    // 2026-12-31. Trend ≈ 10 / 182 days; extrapolated to year-end ≈ 20
    // — far short of 100 → warning fires; deviation high → red end of
    // the yellow → orange → red ramp.
    const card = BusinessScoreCard.of(
      Unit.percent(),
      Objective.of(0, 100, Timestamp.of(new Date("2026-12-31T00:00:00.000Z"))),
      [
        TimestampedValue.of(0, new Date("2026-01-01T00:00:00.000Z")),
        TimestampedValue.of(10, new Date("2026-07-02T00:00:00.000Z")),
      ],
    );
    const node = new BusinessScoreCardNode<number>(
      "b-late",
      identityOf("NPS", ""),
      Weight.of(1),
      card,
      false,
      true,
    );

    const vm = mapNodeToViewModel(node, {
      now: new Date("2026-07-02T00:00:00.000Z"),
    });
    if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    expect(vm.objective.warningColor).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });

  it("\u00a717.44 — leaves warningColor empty when the regression catches up by the deadline", () => {
    // First 0 on 2026-01-01, then 80 on 2026-04-30. Trend extrapolated
    // to year-end far exceeds 100 → no warning even though current
    // (80) is below target.
    const card = BusinessScoreCard.of(
      Unit.percent(),
      Objective.of(0, 100, Timestamp.of(new Date("2026-12-31T00:00:00.000Z"))),
      [
        TimestampedValue.of(0, new Date("2026-01-01T00:00:00.000Z")),
        TimestampedValue.of(80, new Date("2026-04-30T00:00:00.000Z")),
      ],
    );
    const node = new BusinessScoreCardNode<number>(
      "b-trend-ok",
      identityOf("NPS", ""),
      Weight.of(1),
      card,
      false,
      true,
    );

    const vm = mapNodeToViewModel(node, {
      now: new Date("2026-05-02T00:00:00.000Z"),
    });
    if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    expect(vm.objective.warningColor).toBe("");
  });

  it("\u00a717.44 — leaves warningColor empty with a single history entry (no trend)", () => {
    const node = makeBsc({
      id: "b-one",
      title: "Solo",
      computed: false,
      eligible: true,
      history: [{ value: 10, iso: "2026-04-30T00:00:00.000Z" }],
    });
    const vm = mapNodeToViewModel(node, {
      now: new Date("2026-05-02T00:00:00.000Z"),
    });
    if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    expect(vm.objective.warningColor).toBe("");
  });

  it("\u00a717.44 — leaves warningColor empty for a computedMean BSC (rule restricted to recordedValue)", () => {
    const parent = makeBsc({
      id: "p",
      title: "Group",
      computed: true,
      eligible: false,
      history: [
        { value: 0, iso: "2026-01-01T00:00:00.000Z" },
        { value: 5, iso: "2026-04-30T00:00:00.000Z" },
      ],
    });
    parent.attach(
      makeBsc({
        id: "leaf",
        title: "Leaf",
        computed: false,
        eligible: true,
        history: [{ value: 10, iso: "2026-07-02T00:00:00.000Z" }],
      }),
    );

    const vm = mapNodeToViewModel(parent, {
      now: new Date("2026-07-02T00:00:00.000Z"),
    });
    if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    // The parent's own history is 0 → 5 (off-track if the rule applied),
    // but the value branch is computedMean — §17.40 / §17.44 restrict
    // the warning to recordedValue, so suppressed.
    expect(vm.objective.warningColor).toBe("");
    // valueColor still reflects the mean's position on the gradient.
    expect(vm.objective.valueColor).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });

  it("\u00a717.44 — leaves warningColor empty once the deadline has passed", () => {
    const card = BusinessScoreCard.of(
      Unit.percent(),
      Objective.of(0, 100, Timestamp.of(new Date("2026-06-30T00:00:00.000Z"))),
      [
        TimestampedValue.of(0, new Date("2026-01-01T00:00:00.000Z")),
        TimestampedValue.of(20, new Date("2026-05-30T00:00:00.000Z")),
      ],
    );
    const node = new BusinessScoreCardNode<number>(
      "b-past",
      identityOf("Past", ""),
      Weight.of(1),
      card,
      false,
      true,
    );
    const vm = mapNodeToViewModel(node, {
      now: new Date("2026-09-15T00:00:00.000Z"),
    });
    if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    expect(vm.objective.warningColor).toBe("");
  });

  it("\u00a717.44 — bakes a non-empty warningColor for an overachiever whose recent slope reverses past the target", () => {
    // Currently above target (130) but trending down (130 → 110 in 4
    // months). Extrapolated to year-end ≈ 60, well below 100. The
    // §17.40 / §17.44 rule (operator opted-in) still fires the warning.
    const card = BusinessScoreCard.of(
      Unit.percent(),
      Objective.of(0, 100, Timestamp.of(new Date("2026-12-31T00:00:00.000Z"))),
      [
        TimestampedValue.of(130, new Date("2026-01-01T00:00:00.000Z")),
        TimestampedValue.of(110, new Date("2026-04-30T00:00:00.000Z")),
      ],
    );
    const node = new BusinessScoreCardNode<number>(
      "b-falling",
      identityOf("Falling", ""),
      Weight.of(1),
      card,
      false,
      true,
    );
    const vm = mapNodeToViewModel(node, {
      now: new Date("2026-05-02T00:00:00.000Z"),
    });
    if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    expect(vm.objective.warningColor).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });

  it("\u00a717.44 — produces a redder warningColor for a larger deviation, yellower for a smaller one", () => {
    // Two BSCs side-by-side, same objective; different trajectories.
    // Big-shortfall BSC: 0 → 5 over 4 months (slope ≈ 5/119d;
    // predicted at year-end ≈ 15 of 100, shortfall ≈ 0.85 → red end).
    // Small-shortfall BSC: 0 → 30 over 4 months (slope ≈ 30/119d;
    // predicted ≈ 92 of 100, shortfall ≈ 0.08 → yellow end). Pinning
    // the green-channel ordering distinguishes the ramp's tilt
    // without depending on exact RGB triplets (the regression math
    // has rounding inside it).
    const targetDate = Timestamp.of(new Date("2026-12-31T00:00:00.000Z"));
    const now = new Date("2026-05-02T00:00:00.000Z");
    const big = new BusinessScoreCardNode<number>(
      "big",
      identityOf("Big", ""),
      Weight.of(1),
      BusinessScoreCard.of(Unit.percent(), Objective.of(0, 100, targetDate), [
        TimestampedValue.of(0, new Date("2026-01-01T00:00:00.000Z")),
        TimestampedValue.of(5, new Date("2026-04-30T00:00:00.000Z")),
      ]),
      false,
      true,
    );
    const small = new BusinessScoreCardNode<number>(
      "small",
      identityOf("Small", ""),
      Weight.of(1),
      BusinessScoreCard.of(Unit.percent(), Objective.of(0, 100, targetDate), [
        TimestampedValue.of(0, new Date("2026-01-01T00:00:00.000Z")),
        TimestampedValue.of(30, new Date("2026-04-30T00:00:00.000Z")),
      ]),
      false,
      true,
    );
    const bigVm = mapNodeToViewModel(big, { now });
    const smallVm = mapNodeToViewModel(small, { now });
    if (bigVm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    if (smallVm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    const bigMatch = bigVm.objective.warningColor.match(
      /^rgb\((\d+), (\d+), (\d+)\)$/,
    );
    const smallMatch = smallVm.objective.warningColor.match(
      /^rgb\((\d+), (\d+), (\d+)\)$/,
    );
    expect(bigMatch).not.toBeNull();
    expect(smallMatch).not.toBeNull();
    // Yellow ⇒ high green; red ⇒ low green. The bigger deviation
    // therefore reads with a SMALLER green channel.
    expect(Number(bigMatch![2])).toBeLessThan(Number(smallMatch![2]));
  });

  it("\u00a717.40 — empty childrenCount (n=0) gets empty valueColor (no number to grade) and empty warningColor", () => {
    const parent = makeBsc({
      id: "empty",
      title: "Empty",
      computed: true,
      eligible: false,
      history: [{ value: 0, iso: "2026-04-23T00:00:00.000Z" }],
    });
    const vm = mapNodeToViewModel(parent);
    if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    expect(vm.value).toEqual({ kind: "childrenCount", n: 0 });
    expect(vm.objective.valueColor).toBe("");
    expect(vm.objective.warningColor).toBe("");
    expect(vm.objective.trendArrow).toBeNull();
  });

  it("\u00a717.41 — bakes trendArrow=up-right for a recordedValue BSC progressing on track", () => {
    // First 0 on 2026-01-01, then 50 on 2026-07-02. Target 100 by
    // 2026-12-31 → progressRate ≈ 1 (perfectly on track) → up-right.
    const card = BusinessScoreCard.of(
      Unit.percent(),
      Objective.of(0, 100, Timestamp.of(new Date("2026-12-31T00:00:00.000Z"))),
      [
        TimestampedValue.of(0, new Date("2026-01-01T00:00:00.000Z")),
        TimestampedValue.of(50, new Date("2026-07-02T00:00:00.000Z")),
      ],
    );
    const node = new BusinessScoreCardNode<number>(
      "b-on-track",
      identityOf("On Track", ""),
      Weight.of(1),
      card,
      false,
      true,
    );
    const vm = mapNodeToViewModel(node, {
      now: new Date("2026-07-02T00:00:00.000Z"),
    });
    if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    expect(vm.objective.trendArrow).toBe("up-right");
  });

  it("\u00a717.41 — bakes trendArrow=up for a BSC progressing well ahead of schedule", () => {
    // First 0 on 2026-01-01, then 100 on 2026-07-02 → already at
    // target halfway through → progressRate ≈ 2 → up.
    const card = BusinessScoreCard.of(
      Unit.percent(),
      Objective.of(0, 100, Timestamp.of(new Date("2026-12-31T00:00:00.000Z"))),
      [
        TimestampedValue.of(0, new Date("2026-01-01T00:00:00.000Z")),
        TimestampedValue.of(100, new Date("2026-07-02T00:00:00.000Z")),
      ],
    );
    const node = new BusinessScoreCardNode<number>(
      "b-ahead",
      identityOf("Ahead", ""),
      Weight.of(1),
      card,
      false,
      true,
    );
    const vm = mapNodeToViewModel(node);
    if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    expect(vm.objective.trendArrow).toBe("up");
  });

  it("\u00a717.41 — bakes trendArrow=down for a BSC regressing significantly", () => {
    // First 100 on 2026-01-01, then 0 on 2026-07-02. Target 100 by
    // 2026-12-31 → slope ≈ -100 / 181 days; required ≈ 100 / 365 days
    // → progressRate ≈ -2 → "down" (< -1.5).
    const card = BusinessScoreCard.of(
      Unit.percent(),
      Objective.of(0, 100, Timestamp.of(new Date("2026-12-31T00:00:00.000Z"))),
      [
        TimestampedValue.of(100, new Date("2026-01-01T00:00:00.000Z")),
        TimestampedValue.of(0, new Date("2026-07-02T00:00:00.000Z")),
      ],
    );
    const node = new BusinessScoreCardNode<number>(
      "b-falling",
      identityOf("Falling", ""),
      Weight.of(1),
      card,
      false,
      true,
    );
    const vm = mapNodeToViewModel(node);
    if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    expect(vm.objective.trendArrow).toBe("down");
  });

  it("\u00a717.41 — bakes trendArrow=null for a single-history BSC (no defined trend)", () => {
    const node = makeBsc({
      id: "b-one",
      title: "Solo",
      computed: false,
      eligible: true,
      history: [{ value: 10, iso: "2026-04-30T00:00:00.000Z" }],
    });
    const vm = mapNodeToViewModel(node);
    if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    expect(vm.objective.trendArrow).toBeNull();
  });

  it("\u00a717.41 — bakes trendArrow=null for a computedMean BSC (rule restricted to recordedValue)", () => {
    const parent = makeBsc({
      id: "p",
      title: "Group",
      computed: true,
      eligible: false,
      history: [
        { value: 0, iso: "2026-01-01T00:00:00.000Z" },
        { value: 50, iso: "2026-04-30T00:00:00.000Z" },
      ],
    });
    parent.attach(
      makeBsc({
        id: "leaf",
        title: "Leaf",
        computed: false,
        eligible: true,
        history: [{ value: 10, iso: "2026-07-02T00:00:00.000Z" }],
      }),
    );
    const vm = mapNodeToViewModel(parent);
    if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    // Even though the parent's own history has a usable trend, the
    // value branch is computedMean -- §17.41 restricts the arrow to
    // recordedValue (same data-source restriction as warningColor).
    expect(vm.value.kind).toBe("computedMean");
    expect(vm.objective.trendArrow).toBeNull();
  });

  it("\u00a717.41 — direction-agnostic: a BSC dropping toward a descending target gets an up-arrow bucket (progress!)", () => {
    // Target=20 (down from min=100). Value drops 100 → 50 by halfway,
    // progressRate ≈ 1.25 → up-right.
    const card = BusinessScoreCard.of(
      Unit.percent(),
      Objective.of(100, 20, Timestamp.of(new Date("2026-12-31T00:00:00.000Z"))),
      [
        TimestampedValue.of(100, new Date("2026-01-01T00:00:00.000Z")),
        TimestampedValue.of(50, new Date("2026-07-02T00:00:00.000Z")),
      ],
    );
    const node = new BusinessScoreCardNode<number>(
      "b-desc",
      identityOf("Errors", ""),
      Weight.of(1),
      card,
      false,
      true,
    );
    const vm = mapNodeToViewModel(node);
    if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
    expect(vm.objective.trendArrow).toBe("up-right");
  });
});

describe("mapFocusedToViewModel", () => {
  it("translates the focused snapshot 1:1 and appends a plus slot when capacity allows", () => {
    const center = makeText("center", "Org");
    const c1 = makeText("c1", "Sales");
    const c2 = makeText("c2", "Ops");

    const vm = mapFocusedToViewModel(center, [c1, c2]);

    expect(vm.center.id).toBe("center");
    expect(vm.children).toHaveLength(3);
    expect(vm.children[0]).toEqual({
      slot: "node",
      weight: 1,
      vm: {
        kind: "TextNode",
        id: "c1",
        title: "Sales",
        value: {
          text: "Sales",
          dateIso: DEFAULT_TEXT_DATE.toISOString(),
          dateColor: dateAgeColor(DEFAULT_TEXT_DATE.toISOString()),
        },
      },
    });
    expect(vm.children[2]).toEqual({ slot: "plus", weight: 1, parentId: "center" });
  });

  it("omits the plus slot when the focused parent is at capacity (12 children)", () => {
    const center = makeText("c", "Org");
    const children = Array.from({ length: 12 }, (_, i) => makeText(`k${i}`, `K${i}`));
    children.forEach((c) => center.attach(c));

    const vm = mapFocusedToViewModel(center, [...center.children]);

    expect(vm.children).toHaveLength(12);
    expect(vm.children.every((s) => s.slot === "node")).toBe(true);
  });

  it("emits exactly one plus slot for an empty focused parent (only '+' tile, §12.3)", () => {
    const center = makeText("c", "Org");

    const vm = mapFocusedToViewModel(center, []);

    expect(vm.children).toHaveLength(1);
    expect(vm.children[0]).toEqual({ slot: "plus", weight: 1, parentId: "c" });
  });

  it("propagates each child's domain weight to its slot (§3 / §4 — drives squarify)", () => {
    const center = makeText("center", "Org");
    const heavy = new TextNode(
      "heavy",
      identityOf("Heavy", ""),
      Weight.of(7),
      TextCard.of(),
    );
    const light = new TextNode(
      "light",
      identityOf("Light", ""),
      Weight.of(2),
      TextCard.of(),
    );

    const vm = mapFocusedToViewModel(center, [heavy, light]);

    expect(vm.children[0]?.weight).toBe(7);
    expect(vm.children[1]?.weight).toBe(2);
  });

  it("propagates options.now to every node's baked dateColor (\u00a717.42)", () => {
    // §17.42 retired the per-board fresh-date colour the §17.21
    // mapper carried. The mapper now needs only `now` to compute the
    // tile's age-gradient timestamp colour; both endpoints are
    // hard-coded inside `dateAgeColor` (bright off-white at age 0,
    // dark-grey at age >= 30 days). The test asserts that the
    // shared `now` reaches every node's VM consistently — the
    // gradient maths itself is covered by dateAgeColor.test.ts.
    const now = new Date("2026-04-30T12:00:00.000Z");
    const center = makeText("c", "Org", "", [
      { value: "Org", date: new Date("2026-04-30T12:00:00.000Z") },
    ]);
    const child = makeText("k", "Child", "", [
      { value: "Child", date: new Date("2026-04-30T12:00:00.000Z") },
    ]);

    const vm = mapFocusedToViewModel(center, [child], { now });

    if (vm.center.kind !== "TextNode") throw new Error("centre is TextNode");
    expect(vm.center.value.dateColor).toBe("rgb(245, 245, 245)");
    const first = vm.children[0];
    if (!first || first.slot !== "node") throw new Error("expected node slot");
    if (first.vm.kind !== "TextNode") throw new Error("expected TextNode VM");
    expect(first.vm.value.dateColor).toBe("rgb(245, 245, 245)");
  });

  it("plus slot weight is fixed at 1 even when children have heavier weights (§4 — '+' tile = 1)", () => {
    const center = makeText("center", "Org");
    const heavy = new TextNode(
      "heavy",
      identityOf("Heavy", ""),
      Weight.of(9),
      TextCard.of(),
    );

    const vm = mapFocusedToViewModel(center, [heavy]);

    const plus = vm.children.find((s) => s.slot === "plus");
    expect(plus?.weight).toBe(1);
  });
});
