import type { Clock } from "../domain/capabilities/Clock.js";
import { BusinessScoreCard } from "../domain/cards/BusinessScoreCard.js";
import { ComputationKind } from "../domain/computation/ComputationKind.js";
import { BusinessScoreNode } from "../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../domain/nodes/ComputedNode.js";
import { StrictRangeNode } from "../domain/nodes/StrictRangeNode.js";
import { TextNode } from "../domain/nodes/TextNode.js";
import { Tree, type CardRegistry } from "../domain/Tree.js";
import { NumericComparator } from "../domain/values/Comparator.js";
import { Objective } from "../domain/values/Objective.js";
import { LenientRange, StrictRange } from "../domain/values/Range.js";
import { Timestamp } from "../domain/values/Timestamp.js";
import { Unit } from "../domain/values/Unit.js";
import { Weight } from "../domain/values/Weight.js";

/**
 * §17.108 — v4 successor to v3's `buildSampleTree` in `sampleData.ts`. Same
 * "demo tree for development" role: a hand-built fixture exercising every
 * concrete node kind the v4 class diagram declares, plus the round-7 D2
 * Computed* additions (§17.97 `ComputedNode<T>` + §17.98
 * `ComputedBusinessScoreNode<T>`) and the §17.100.5 `BusinessScoreCard`
 * sidecar so the §17.91 / §17.104b view-model mapper can render every
 * branch end-to-end without any v3 → v4 adaptation step.
 *
 * Strictly additive — `main.ts` still loads from `LocalStorageBoardCollection`
 * + the v3 bridge at runtime, so this fixture is unreachable from the
 * production bundle (tree-shaken until §17.110 cutover wires v4 paths).
 * The v3 `sampleData.buildSampleTree` stays live verbatim and retires at
 * the §17.112 Phase F deletion strand.
 *
 * Shape: 1 root TextNode → 2 children (1 CBSN aggregator + 1 ComputedNode
 * count), CBSN branches into 2 BSN leaves carrying history + objective +
 * unit, ComputedNode branches into a StrictRangeNode + a TextNode (two
 * heterogeneous "events" the CountComputation tallies). One BSN gets a
 * matching `BusinessScoreCard` entry in the returned tree's
 * `CardRegistry` so the §17.100.5 card-based unit precedence is exercised
 * (the BSN's `unit` slot is set to a sentinel `"BSN-fallback"` the card
 * overrides with the v4 `Unit` value; the §17.91 mapper reads the card
 * first per the §17.100.5 contract).
 *
 * Deterministic timestamps: `clock` injected by the caller so the fixture
 * is reproducible under a fixed-time test clock and under the production
 * `SystemClock` (history `asOf` entries use frozen ISO moments — only the
 * computed-node strategy result varies with real Date.now if the caller
 * passes `SystemClock`).
 */
export function buildSampleTree(clock: Clock): Tree {
  const targetDate = Timestamp.of(new Date("2026-12-31T00:00:00Z"));
  const t1 = Timestamp.of(new Date("2026-04-22T18:25:43.511Z"));
  const t2 = Timestamp.of(new Date("2026-04-23T18:25:43.511Z"));
  const lenient = LenientRange.of(
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    NumericComparator.INSTANCE,
  );

  const root = new TextNode("org", "Organization", Weight.of(2), clock);
  root.addValue(t2, "Organization");

  const health = new ComputedBusinessScoreNode<number>(
    "health", "Health", Weight.of(3), "Aggregate score", clock, lenient,
    { objective: Objective.of(110, targetDate), initialKind: ComputationKind.WEIGHTED_AVERAGE, unit: "%" },
  );
  root.attach(health);

  const sales = new BusinessScoreNode<number>(
    "sales", "Sales", Weight.of(3), "Revenue vs plan", clock, lenient,
    { objective: Objective.of(110, targetDate), unit: "BSN-fallback" },
  );
  sales.addValue(t1, 95);
  sales.addValue(t2, 104);
  health.attach(sales);

  const ops = new BusinessScoreNode<number>(
    "ops", "Operations", Weight.of(1), "Cost and throughput", clock, lenient,
    { objective: Objective.of(100, targetDate), unit: "%" },
  );
  ops.addValue(t2, 98);
  health.attach(ops);

  const activity = new ComputedNode<number>(
    "activity", "Activity", Weight.of(1), "Live events count", clock, ComputationKind.COUNT,
  );
  root.attach(activity);

  const saturation = new StrictRangeNode<number>(
    "cpu", "CPU saturation", Weight.of(1), "0-100 utilisation %", clock,
    StrictRange.of(0, 100, NumericComparator.INSTANCE),
  );
  saturation.addValue(t2, 70);
  activity.attach(saturation);

  const note = new TextNode("note", "Quarterly note", Weight.of(1), clock);
  note.addValue(t2, "Q2 stable");
  activity.attach(note);

  const cards: CardRegistry = new Map([
    ["sales", new BusinessScoreCard(sales, Unit.percent())],
  ]);

  return new Tree(root, cards);
}
