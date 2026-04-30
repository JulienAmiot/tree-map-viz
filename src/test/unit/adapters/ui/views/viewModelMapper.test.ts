import { describe, expect, it } from "vitest";

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
import { TimestampedValue } from "../../../../../domain/values/TimestampedValue.js";
import { Title } from "../../../../../domain/values/Title.js";
import { Unit } from "../../../../../domain/values/Unit.js";
import { Weight } from "../../../../../domain/values/Weight.js";

const targetDate = new Date("2026-12-31T00:00:00.000Z");

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

    expect(vm).toEqual({
      kind: "TextNode",
      id: "t1",
      title: "Quarterly review",
      description: "Top-level scorecard",
      value: {
        text: "newest",
        dateIso: DEFAULT_TEXT_DATE.toISOString(),
      },
    });
  });

  it("falls back to an empty value when the TextNode's history is empty (graceful degradation)", () => {
    const node = makeText("t-empty", "Empty", "", []);
    const vm = mapNodeToViewModel(node);
    if (vm.kind !== "TextNode") throw new Error("expected TextNode VM");
    expect(vm.value).toEqual({ text: "", dateIso: "" });
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

    expect(vm).toEqual({
      kind: "BusinessScoreCardNode",
      id: "b1",
      title: "Sales",
      description: "Revenue",
      value: {
        kind: "recordedValue",
        value: 104,
        unit: "%",
        dateIso: "2026-04-23T18:25:43.511Z",
      },
    });
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
        description: "",
        value: { text: "Sales", dateIso: DEFAULT_TEXT_DATE.toISOString() },
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
