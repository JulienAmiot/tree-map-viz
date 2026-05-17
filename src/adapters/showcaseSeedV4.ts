import type { BoardV4 } from "../application/ports/BoardCollectionRepositoryV4.js";
import type { Clock } from "../domain/capabilities/Clock.js";
import { BusinessScoreCardV4 } from "../domain/cards/BusinessScoreCardV4.js";
import { ComputationKind } from "../domain/computation/ComputationKind.js";
import { BusinessScoreNode } from "../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../domain/nodes/ComputedNode.js";
import { StrictRangeNode } from "../domain/nodes/StrictRangeNode.js";
import { TextNodeV4 } from "../domain/nodes/TextNodeV4.js";
import { Tree } from "../domain/Tree.js";
import { NumericComparator } from "../domain/values/Comparator.js";
import { Objective } from "../domain/values/Objective.js";
import { LenientRange, StrictRange } from "../domain/values/Range.js";
import { Timestamp } from "../domain/values/Timestamp.js";
import { Unit } from "../domain/values/Unit.js";
import { Weight } from "../domain/values/Weight.js";

/**
 * §17.109 — v4 successor to v3's §17.21 `buildShowcaseTree` /
 * `buildShowcaseBoard`. Same role: the rich demo tree that lands on a
 * fresh kiosk boot, designed to exercise every visible UI branch in
 * one focused view. Same stable IDs as the v3 showcase (so e2e
 * scenarios targeting `engineering` / `sales` / `bench` continue to
 * resolve), same markdown + history content, same gradient-spanning
 * date distribution.
 *
 * **Beyond the v3 showcase**: a Round-7 sub-section under `activity`
 * exercises the §17.97 `ComputedNode<T>` aggregator + the §17.77
 * `StrictRangeNode<T>` SLO leaf — neither has a v3 analogue, so the
 * §17.81 v3-bridge produces neither even on a `computed: true` source.
 * Lands them first-class so a fresh kiosk boot demonstrates every v4
 * node kind including the round-7 D2 additions.
 *
 * **Cards sidecar** is populated for every BSN/CBSN that carries a
 * non-empty unit (mirrors the §17.100.5 `v4TreeFromV3Root.buildCardsFromV3`
 * contract — the visual layer reads unit from the card first, falls
 * back to the §17.91 `BusinessScoreNode.unit` slot when the entry is
 * absent). The Round-7 `ComputedNode` deliberately has no card +
 * empty unit (it counts events; "events" don't have a display unit).
 *
 * Strictly additive — `main.ts` still loads v3 paths; reachability
 * arrives at the §17.110 cutover or via a future operator-facing "load
 * showcase v4" debug action. The v3 `showcaseSeed.ts` stays live
 * verbatim and retires at §17.112+ Phase F deletion.
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const SHOWCASE_BOARD_ID_V4 = "showcase-board-v4";
export const SHOWCASE_BOARD_NAME_V4 = "Showcase v4";

function lenient(): LenientRange<number> {
  return LenientRange.of(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, NumericComparator.INSTANCE);
}

function startOfUtcHour(d: Date): Date {
  const r = new Date(d.getTime());
  r.setUTCMinutes(0, 0, 0);
  return r;
}

export function buildShowcaseTreeV4(clock: Clock, now: Date = new Date()): Tree {
  const todayDate = startOfUtcHour(now);
  const today = Timestamp.of(todayDate);
  const days = (n: number): Timestamp =>
    Timestamp.of(new Date(todayDate.getTime() - n * MS_PER_DAY));
  const targetDate = Timestamp.of(
    new Date(Date.UTC(todayDate.getUTCFullYear(), 11, 31, 23, 59, 59)),
  );
  const cards = new Map<string, BusinessScoreCardV4<unknown>>();

  const root = new TextNodeV4("showcase-root", "Quarterly OKRs", Weight.of(1), clock);
  root.addValue(days(45), "Q1 closed strong: revenue *up* 18 %, NPS at `42`.");
  root.addValue(today, [
    "## Q2 status", "",
    "On track \u2014 watch the **Sales** pipeline.", "",
    "- Engineering shipping on plan",
    "- Product NPS recovering",
    "- Sales win-rate above target",
  ].join("\n"));

  const eng = new ComputedBusinessScoreNode<number>(
    "engineering", "Engineering", Weight.of(2), "Delivery + quality KPIs", clock, lenient(),
    { objective: Objective.of(100, targetDate), initialKind: ComputationKind.WEIGHTED_AVERAGE, unit: "%" },
  );
  cards.set("engineering", new BusinessScoreCardV4(eng, Unit.percent()));
  const engVelocity = new BusinessScoreNode<number>(
    "eng-velocity", "Velocity", Weight.of(2), "Story points shipped per sprint", clock, lenient(),
    { objective: Objective.of(90, targetDate), unit: "pts" },
  );
  engVelocity.addValue(days(30), 70);
  engVelocity.addValue(days(14), 82);
  cards.set("eng-velocity", new BusinessScoreCardV4(engVelocity, Unit.of("pts")));
  eng.attach(engVelocity);
  const engReview = new BusinessScoreNode<number>(
    "eng-review-sla", "Code review SLA", Weight.of(1), "% of PRs reviewed within 24 h", clock, lenient(),
    { objective: Objective.of(95, targetDate), unit: "%" },
  );
  engReview.addValue(days(14), 91);
  engReview.addValue(days(2), 96);
  cards.set("eng-review-sla", new BusinessScoreCardV4(engReview, Unit.percent()));
  eng.attach(engReview);
  const engCoverage = new BusinessScoreNode<number>(
    "eng-coverage", "Test coverage", Weight.of(1), "Branch coverage across all packages", clock, lenient(),
    { objective: Objective.of(85, targetDate), unit: "%" },
  );
  engCoverage.addValue(today, 78);
  cards.set("eng-coverage", new BusinessScoreCardV4(engCoverage, Unit.percent()));
  eng.attach(engCoverage);
  const engNotes = new TextNodeV4("eng-notes", "Eng notes", Weight.of(1), clock);
  engNotes.addValue(today, "Backend rewrite in flight \u2014 **due end of quarter**. Cut over via `feature-flag-v2`.");
  eng.attach(engNotes);
  root.attach(eng);

  const product = new BusinessScoreNode<number>(
    "product", "Product", Weight.of(2), "NPS + active-user trend", clock, lenient(),
    { objective: Objective.of(50, targetDate), unit: "NPS" },
  );
  product.addValue(days(120), 28);
  product.addValue(days(60), 35);
  product.addValue(today, 42);
  cards.set("product", new BusinessScoreCardV4(product, Unit.of("NPS")));
  root.attach(product);

  const sales = new ComputedBusinessScoreNode<number>(
    "sales", "Sales", Weight.of(2), "Pipeline + win-rate roll-up", clock, lenient(),
    { objective: Objective.of(110, targetDate), initialKind: ComputationKind.WEIGHTED_AVERAGE, unit: "%" },
  );
  cards.set("sales", new BusinessScoreCardV4(sales, Unit.percent()));
  const salesPipeline = new BusinessScoreNode<number>(
    "sales-pipeline", "Pipeline", Weight.of(3), "Qualified opportunities ($M)", clock, lenient(),
    { objective: Objective.of(12, targetDate), unit: "$M" },
  );
  salesPipeline.addValue(days(90), 8.4);
  salesPipeline.addValue(days(45), 9.1);
  cards.set("sales-pipeline", new BusinessScoreCardV4(salesPipeline, Unit.of("$M")));
  sales.attach(salesPipeline);
  const salesWinrate = new BusinessScoreNode<number>(
    "sales-winrate", "Win rate", Weight.of(2), "Closed-won / qualified", clock, lenient(),
    { objective: Objective.of(35, targetDate), unit: "%" },
  );
  salesWinrate.addValue(today, 31);
  cards.set("sales-winrate", new BusinessScoreCardV4(salesWinrate, Unit.percent()));
  sales.attach(salesWinrate);
  const salesLost = new BusinessScoreNode<number>(
    "sales-lost", "Lost deals", Weight.of(1), "Audit trail \u2014 not a roll-up KPI", clock, lenient(),
    { objective: Objective.of(5, targetDate), unit: "count" },
  );
  salesLost.addValue(days(30), 4);
  salesLost.addValue(today, 6);
  salesLost.setDisabled(true);
  cards.set("sales-lost", new BusinessScoreCardV4(salesLost, Unit.of("count")));
  sales.attach(salesLost);
  root.attach(sales);

  const operations = new TextNodeV4("operations", "Operations", Weight.of(1), clock);
  operations.addValue(days(21), [
    "Cloud migration **paused**; vendor renegotiation in progress.", "",
    "Next steps:",
    "1. Re-baseline the contract terms",
    "2. Re-run the cost projection",
    "3. Decision review at the next ops sync",
  ].join("\n"));
  root.attach(operations);

  const bench = new ComputedBusinessScoreNode<number>(
    "bench", "Bench", Weight.of(1), "Reserved for next quarter", clock, lenient(),
    { objective: Objective.of(100, targetDate), initialKind: ComputationKind.WEIGHTED_AVERAGE, unit: "%" },
  );
  cards.set("bench", new BusinessScoreCardV4(bench, Unit.percent()));
  root.attach(bench);

  const activity = new ComputedNode<number>(
    "activity", "Activity", Weight.of(1), "Heterogeneous events — counted, not averaged", clock, ComputationKind.COUNT,
  );
  const cpu = new StrictRangeNode<number>(
    "cpu-saturation", "CPU saturation", Weight.of(1), "0-100 utilisation %", clock,
    StrictRange.of(0, 100, NumericComparator.INSTANCE),
  );
  cpu.addValue(today, 70);
  activity.attach(cpu);
  const incidentNote = new TextNodeV4("activity-incident", "Latest incident", Weight.of(1), clock);
  incidentNote.addValue(days(3), "Disk-pressure alert on `db-primary` \u2014 mitigated.");
  activity.attach(incidentNote);
  root.attach(activity);

  return new Tree(root, cards);
}

export function buildShowcaseBoardV4(clock: Clock, now: Date = new Date()): BoardV4 {
  return {
    id: SHOWCASE_BOARD_ID_V4,
    name: SHOWCASE_BOARD_NAME_V4,
    tree: buildShowcaseTreeV4(clock, now),
  };
}
