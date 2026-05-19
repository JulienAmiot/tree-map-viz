import type { Board } from "../application/ports/BoardCollectionRepository.js";
import type { Clock } from "../domain/capabilities/Clock.js";
import { BusinessScoreCard } from "../domain/cards/BusinessScoreCard.js";
import { ComputationKind } from "../domain/computation/ComputationKind.js";
import { BusinessScoreNode } from "../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../domain/nodes/ComputedNode.js";
import { PictureNode } from "../domain/nodes/PictureNode.js";
import { StrictRangeNode } from "../domain/nodes/StrictRangeNode.js";
import { TextNode } from "../domain/nodes/TextNode.js";
import { URLNode } from "../domain/nodes/URLNode.js";
import { WorkflowNode } from "../domain/nodes/WorkflowNode.js";
import { Tree } from "../domain/Tree.js";
import { NumericComparator } from "../domain/values/Comparator.js";
import { Objective } from "../domain/values/Objective.js";
import { LenientRange, StrictRange } from "../domain/values/Range.js";
import { Timestamp } from "../domain/values/Timestamp.js";
import { Unit } from "../domain/values/Unit.js";
import { Weight } from "../domain/values/Weight.js";
import { DEFAULT_WORKFLOW_STATUSES } from "../domain/values/WorkflowStatus.js";

/**
 * §17.122 — Data Platform Team Obeya showcase (v5).
 *
 * Successor to the §17.109 v4 "Quarterly OKRs" showcase: same role
 * (the rich demo tree that lands on a fresh kiosk boot, exercises
 * every visible UI branch in one focused view), redesigned as a
 * six-panel Lean obeya tailored to a Data Platform team so every
 * card kind shipped in rounds 7-9 (`ComputedNode`, `StrictRangeNode`,
 * `WorkflowNode`, `PictureNode`, `URLNode`) gets a first-class demo
 * surface alongside `TextNode` + `BusinessScoreNode` +
 * `ComputedBusinessScoreNode`.
 *
 * Layout — strictly six top-level panels under `showcase-root`,
 * with stable slugs the e2e fixtures rely on:
 *
 *   1. `reliability`  — ComputedBusinessScoreNode (WEIGHTED_AVERAGE)
 *      with 5 children: 4 BSN + 1 disabled BSN. Demos history-rich +
 *      above-objective KPIs and the disabled-leaf affordance.
 *   2. `ingestion`    — ComputedBusinessScoreNode (AVERAGE) with 4
 *      children: 3 BSN + 1 URLNode (Kafka dashboard QR code). Demos
 *      below-objective + above-objective + URL/QR rendering.
 *   3. `infra-cost`   — ComputedNode (SUM) with 4 children: 3 BSN
 *      cost lines + 1 PictureNode (cluster topology). Demos the
 *      SUM aggregation and the snapshot-leaf picture surface.
 *   4. `products`     — ComputedBusinessScoreNode (WEIGHTED_AVERAGE)
 *      with 3 children. Demos a deliberately compact panel.
 *   5. `team-health`  — ComputedBusinessScoreNode (WEIGHTED_AVERAGE)
 *      with 4 children including one StrictRangeNode (engagement
 *      pulse on 0-100). Demos the StrictRange leaf.
 *   6. `workflow`     — TextNode parent with 5 children: 4
 *      WorkflowNodes (one per PDCA status — `plan` / `do` / `check`
 *      / `act`) + 1 TextNode incident log. Demos every workflow
 *      status badge in a single panel.
 *
 * Distribution invariants (locked in `showcaseSeed.test.ts`):
 *
 *   - Every node kind appears at least once.
 *   - Child counts span {3, 4, 5} across panels (not uniform).
 *   - ≥ 1 node has multi-point history; ≥ 1 has a single point.
 *   - ≥ 1 BSN sits above its objective and ≥ 1 sits below.
 *   - Exactly one node is `setDisabled(true)` (slo-legacy-etl).
 *   - All four `DEFAULT_WORKFLOW_STATUSES` ids are referenced.
 *
 * The `cards` sidecar is populated for every BSN / CBSN with a
 * non-empty unit, mirroring §17.100.5. ComputedNode + StrictRangeNode
 * + WorkflowNode + PictureNode + URLNode have no card entry by
 * design (they aren't BSN-derived).
 *
 * `.cursor/rules/showcase-on-new-card-type.mdc` documents the
 * regeneration convention triggered by any new node kind landing in
 * `src/domain/nodes/`.
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const SHOWCASE_BOARD_ID = "showcase-board-v4";
export const SHOWCASE_BOARD_NAME = "Showcase";

const TOPOLOGY_SVG =
  "data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 360'>" +
  "<rect width='600' height='360' fill='%230f172a'/>" +
  "<g fill='none' stroke='%2360a5fa' stroke-width='2'>" +
  "<circle cx='120' cy='180' r='40'/><circle cx='300' cy='100' r='40'/>" +
  "<circle cx='300' cy='260' r='40'/><circle cx='480' cy='180' r='40'/>" +
  "<line x1='160' y1='180' x2='260' y2='100'/><line x1='160' y1='180' x2='260' y2='260'/>" +
  "<line x1='340' y1='100' x2='440' y2='180'/><line x1='340' y1='260' x2='440' y2='180'/>" +
  "</g>" +
  "<g fill='%23e2e8f0' font-family='sans-serif' font-size='14' text-anchor='middle'>" +
  "<text x='120' y='184'>ingest</text><text x='300' y='104'>stream</text>" +
  "<text x='300' y='264'>batch</text><text x='480' y='184'>serve</text>" +
  "</g>" +
  "<text x='300' y='340' fill='%2394a3b8' font-family='sans-serif' font-size='18' text-anchor='middle'>" +
  "Cluster Topology" +
  "</text></svg>";

function lenient(): LenientRange<number> {
  return LenientRange.of(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, NumericComparator.INSTANCE);
}

function startOfUtcHour(d: Date): Date {
  const r = new Date(d.getTime());
  r.setUTCMinutes(0, 0, 0);
  return r;
}

export function buildShowcaseTree(clock: Clock, now: Date = new Date()): Tree {
  const todayDate = startOfUtcHour(now);
  const today = Timestamp.of(todayDate);
  const days = (n: number): Timestamp =>
    Timestamp.of(new Date(todayDate.getTime() - n * MS_PER_DAY));
  const targetDate = Timestamp.of(
    new Date(Date.UTC(todayDate.getUTCFullYear(), 11, 31, 23, 59, 59)),
  );
  const cards = new Map<string, BusinessScoreCard<unknown>>();

  const root = new TextNode("showcase-root", "Data Platform Obeya", Weight.of(1), clock);
  root.addValue(days(45), "Q1 wrap-up: ingestion *up* 75 %, freshness SLO **green**.");
  root.addValue(today, [
    "## Q2 status", "",
    "Reliability holding, ingestion above plan, cost trending up.", "",
    "- Reliability: uptime green, completeness amber",
    "- Ingestion: events/sec above plan, p99 latency over target",
    "- Cost: compute spend creeping; optimisation strand in PLAN",
    "- Products: NPS recovering, adoption up",
    "- Team: velocity above plan, on-call load elevated",
  ].join("\n"));

  // Panel 1 — reliability (5 children: 4 BSN + 1 disabled BSN)
  const reliability = new ComputedBusinessScoreNode<number>(
    "reliability", "Reliability & SLO", Weight.of(2), "Uptime + freshness + completeness roll-up", clock, lenient(),
    { objective: Objective.of(99, targetDate), initialKind: ComputationKind.WEIGHTED_AVERAGE, unit: "%" },
  );
  cards.set("reliability", new BusinessScoreCard(reliability, Unit.percent()));
  const sloUptime = new BusinessScoreNode<number>(
    "slo-uptime", "Pipeline uptime", Weight.of(3), "Rolling 28-day pipeline uptime", clock, lenient(),
    { objective: Objective.of(99.9, targetDate), unit: "%" },
  );
  sloUptime.addValue(days(30), 99.20);
  sloUptime.addValue(days(14), 99.65);
  sloUptime.addValue(today, 99.95);
  cards.set("slo-uptime", new BusinessScoreCard(sloUptime, Unit.percent()));
  reliability.attach(sloUptime);
  const sloFreshness = new BusinessScoreNode<number>(
    "slo-freshness", "Data freshness", Weight.of(2), "Median lag on critical datasets", clock, lenient(),
    { objective: Objective.of(5, targetDate), unit: "min" },
  );
  sloFreshness.addValue(today, 3.2);
  cards.set("slo-freshness", new BusinessScoreCard(sloFreshness, Unit.of("min")));
  reliability.attach(sloFreshness);
  const sloCompleteness = new BusinessScoreNode<number>(
    "slo-completeness", "Record completeness", Weight.of(2), "% of expected rows landed", clock, lenient(),
    { objective: Objective.of(98, targetDate), unit: "%" },
  );
  sloCompleteness.addValue(today, 96.4);
  cards.set("slo-completeness", new BusinessScoreCard(sloCompleteness, Unit.percent()));
  reliability.attach(sloCompleteness);
  const sloAlerts = new BusinessScoreNode<number>(
    "slo-alerts", "Pager alerts / week", Weight.of(1), "On-call pages tied to platform SLOs", clock, lenient(),
    { objective: Objective.of(3, targetDate), unit: "count" },
  );
  sloAlerts.addValue(days(14), 5);
  sloAlerts.addValue(today, 4);
  cards.set("slo-alerts", new BusinessScoreCard(sloAlerts, Unit.of("count")));
  reliability.attach(sloAlerts);
  const sloLegacy = new BusinessScoreNode<number>(
    "slo-legacy-etl", "Legacy ETL SLA", Weight.of(1), "Deprecated nightly batch — kept for audit", clock, lenient(),
    { objective: Objective.of(95, targetDate), unit: "%" },
  );
  sloLegacy.addValue(days(60), 88);
  sloLegacy.addValue(days(30), 91);
  sloLegacy.setDisabled(true);
  cards.set("slo-legacy-etl", new BusinessScoreCard(sloLegacy, Unit.percent()));
  reliability.attach(sloLegacy);
  root.attach(reliability);

  // Panel 2 — ingestion (4 children: 3 BSN + URLNode)
  const ingestion = new ComputedBusinessScoreNode<number>(
    "ingestion", "Ingestion", Weight.of(2), "Events/sec + success + latency", clock, lenient(),
    { objective: Objective.of(95, targetDate), initialKind: ComputationKind.AVERAGE, unit: "%" },
  );
  cards.set("ingestion", new BusinessScoreCard(ingestion, Unit.percent()));
  const ingestEvents = new BusinessScoreNode<number>(
    "ingest-events", "Events / sec", Weight.of(3), "Steady-state throughput on prod cluster", clock, lenient(),
    { objective: Objective.of(250, targetDate), unit: "k/s" },
  );
  ingestEvents.addValue(days(60), 180);
  ingestEvents.addValue(days(30), 240);
  ingestEvents.addValue(today, 315);
  cards.set("ingest-events", new BusinessScoreCard(ingestEvents, Unit.of("k/s")));
  ingestion.attach(ingestEvents);
  const ingestSuccess = new BusinessScoreNode<number>(
    "ingest-success", "Ingest success rate", Weight.of(2), "Accepted / submitted ratio", clock, lenient(),
    { objective: Objective.of(99.5, targetDate), unit: "%" },
  );
  ingestSuccess.addValue(today, 99.4);
  cards.set("ingest-success", new BusinessScoreCard(ingestSuccess, Unit.percent()));
  ingestion.attach(ingestSuccess);
  const ingestLatency = new BusinessScoreNode<number>(
    "ingest-latency-p99", "p99 latency", Weight.of(2), "End-to-end p99 from emit to query", clock, lenient(),
    { objective: Objective.of(500, targetDate), unit: "ms" },
  );
  ingestLatency.addValue(today, 820);
  cards.set("ingest-latency-p99", new BusinessScoreCard(ingestLatency, Unit.of("ms")));
  ingestion.attach(ingestLatency);
  const ingestDash = new URLNode(
    "ingest-kafka-dash", "Kafka dashboard", Weight.of(1),
    "https://kafka.data-platform.example.com/dashboard",
  );
  ingestion.attach(ingestDash);
  root.attach(ingestion);

  // Panel 3 — infra-cost (4 children: 3 BSN + PictureNode; SUM aggregation)
  const infraCost = new ComputedNode<number>(
    "infra-cost", "Infra & Cost", Weight.of(1), "Monthly spend roll-up across compute / storage / egress",
    clock, ComputationKind.SUM,
  );
  const costCompute = new BusinessScoreNode<number>(
    "cost-compute", "Compute spend", Weight.of(3), "EKS + Spark clusters, $k / month", clock, lenient(),
    { objective: Objective.of(50, targetDate), unit: "$k" },
  );
  costCompute.addValue(days(90), 42);
  costCompute.addValue(days(30), 48);
  costCompute.addValue(today, 55);
  cards.set("cost-compute", new BusinessScoreCard(costCompute, Unit.of("$k")));
  infraCost.attach(costCompute);
  const costStorage = new BusinessScoreNode<number>(
    "cost-storage", "Storage spend", Weight.of(2), "S3 + warehouse storage, $k / month", clock, lenient(),
    { objective: Objective.of(20, targetDate), unit: "$k" },
  );
  costStorage.addValue(today, 18);
  cards.set("cost-storage", new BusinessScoreCard(costStorage, Unit.of("$k")));
  infraCost.attach(costStorage);
  const costEgress = new BusinessScoreNode<number>(
    "cost-egress", "Egress spend", Weight.of(1), "Cross-region + internet egress, $k / month", clock, lenient(),
    { objective: Objective.of(10, targetDate), unit: "$k" },
  );
  costEgress.addValue(today, 7.5);
  cards.set("cost-egress", new BusinessScoreCard(costEgress, Unit.of("$k")));
  infraCost.attach(costEgress);
  const topology = new PictureNode(
    "infra-topology", "Cluster topology", Weight.of(1), TOPOLOGY_SVG,
  );
  infraCost.attach(topology);
  root.attach(infraCost);

  // Panel 4 — products (3 children: 3 BSN)
  const products = new ComputedBusinessScoreNode<number>(
    "products", "Data Products", Weight.of(1), "Adoption + NPS roll-up", clock, lenient(),
    { objective: Objective.of(80, targetDate), initialKind: ComputationKind.WEIGHTED_AVERAGE, unit: "NPS" },
  );
  cards.set("products", new BusinessScoreCard(products, Unit.of("NPS")));
  const prodDatasets = new BusinessScoreNode<number>(
    "prod-datasets", "Active datasets", Weight.of(1), "Datasets with at least one read this week", clock, lenient(),
    { objective: Objective.of(100, targetDate), unit: "count" },
  );
  prodDatasets.addValue(today, 87);
  cards.set("prod-datasets", new BusinessScoreCard(prodDatasets, Unit.of("count")));
  products.attach(prodDatasets);
  const prodAdoption = new BusinessScoreNode<number>(
    "prod-adoption", "Internal consumers", Weight.of(2), "Distinct teams reading platform data", clock, lenient(),
    { objective: Objective.of(80, targetDate), unit: "count" },
  );
  prodAdoption.addValue(days(120), 42);
  prodAdoption.addValue(days(60), 58);
  prodAdoption.addValue(today, 74);
  cards.set("prod-adoption", new BusinessScoreCard(prodAdoption, Unit.of("count")));
  products.attach(prodAdoption);
  const prodNps = new BusinessScoreNode<number>(
    "prod-nps", "Consumer NPS", Weight.of(2), "Quarterly platform-consumer survey", clock, lenient(),
    { objective: Objective.of(40, targetDate), unit: "NPS" },
  );
  prodNps.addValue(today, 38);
  cards.set("prod-nps", new BusinessScoreCard(prodNps, Unit.of("NPS")));
  products.attach(prodNps);
  root.attach(products);

  // Panel 5 — team-health (4 children: 3 BSN + 1 StrictRangeNode)
  const teamHealth = new ComputedBusinessScoreNode<number>(
    "team-health", "Team Health", Weight.of(1), "Velocity + review SLA + on-call + engagement",
    clock, lenient(),
    { objective: Objective.of(85, targetDate), initialKind: ComputationKind.WEIGHTED_AVERAGE, unit: "%" },
  );
  cards.set("team-health", new BusinessScoreCard(teamHealth, Unit.percent()));
  const teamVelocity = new BusinessScoreNode<number>(
    "team-velocity", "Sprint velocity", Weight.of(2), "Story points shipped per sprint", clock, lenient(),
    { objective: Objective.of(80, targetDate), unit: "pts" },
  );
  teamVelocity.addValue(days(30), 68);
  teamVelocity.addValue(days(14), 74);
  teamVelocity.addValue(today, 82);
  cards.set("team-velocity", new BusinessScoreCard(teamVelocity, Unit.of("pts")));
  teamHealth.attach(teamVelocity);
  const teamReview = new BusinessScoreNode<number>(
    "team-review-sla", "PR review SLA", Weight.of(2), "% of PRs reviewed within 24 h", clock, lenient(),
    { objective: Objective.of(90, targetDate), unit: "%" },
  );
  teamReview.addValue(today, 88);
  cards.set("team-review-sla", new BusinessScoreCard(teamReview, Unit.percent()));
  teamHealth.attach(teamReview);
  const teamOncall = new BusinessScoreNode<number>(
    "team-oncall-load", "On-call pages / week", Weight.of(1), "Pages received outside business hours", clock, lenient(),
    { objective: Objective.of(8, targetDate), unit: "count" },
  );
  teamOncall.addValue(today, 12);
  cards.set("team-oncall-load", new BusinessScoreCard(teamOncall, Unit.of("count")));
  teamHealth.attach(teamOncall);
  const teamPulse = new StrictRangeNode<number>(
    "team-engagement-pulse", "Engagement pulse", Weight.of(1), "Weekly pulse survey, 0-100", clock,
    StrictRange.of(0, 100, NumericComparator.INSTANCE),
  );
  teamPulse.addValue(today, 81);
  teamHealth.attach(teamPulse);
  root.attach(teamHealth);

  // Panel 6 — workflow (5 children: 4 WorkflowNodes covering every PDCA status + 1 TextNode)
  const workflow = new TextNode("workflow", "Roadmap & Incidents", Weight.of(1), clock);
  workflow.addValue(today, [
    "Active strands across the team — one tile per PDCA phase.",
    "Incident log below tracks the latest production event.",
  ].join("\n"));
  const wfDataMesh = new WorkflowNode(
    "wf-data-mesh", "Data mesh rollout", Weight.of(2), clock, "do",
  );
  wfDataMesh.addValue(today, "Domain ownership handover — *finance* + *growth* in progress, *infra* next.");
  workflow.attach(wfDataMesh);
  const wfQuality = new WorkflowNode(
    "wf-quality-program", "Data quality program", Weight.of(1), clock, "check",
  );
  wfQuality.addValue(today, "Validation rules deployed to **27** critical datasets; reviewing alert noise.");
  workflow.attach(wfQuality);
  const wfCost = new WorkflowNode(
    "wf-cost-optimization", "Q3 cost optimisation", Weight.of(1), clock, "plan",
  );
  wfCost.addValue(today, "Scoping reserved-capacity vs spot mix for batch workloads.");
  workflow.attach(wfCost);
  const wfPii = new WorkflowNode(
    "wf-pii-audit", "Quarterly PII audit", Weight.of(1), clock, "act",
  );
  wfPii.addValue(today, "Findings closed; rolling out classifier `v3` to remaining lakehouse buckets.");
  workflow.attach(wfPii);
  const incidentLog = new TextNode("wf-incident-log", "Latest incident", Weight.of(1), clock);
  incidentLog.addValue(days(3), [
    "Disk-pressure alert on `warehouse-primary` \u2014 mitigated in 22 min.", "",
    "Action items:",
    "1. Add storage forecasting to the freshness dashboard",
    "2. Re-baseline the autoscaler thresholds",
  ].join("\n"));
  workflow.attach(incidentLog);
  root.attach(workflow);

  return new Tree(root, cards);
}

export function buildShowcaseBoard(clock: Clock, now: Date = new Date()): Board {
  return {
    id: SHOWCASE_BOARD_ID,
    name: SHOWCASE_BOARD_NAME,
    tree: buildShowcaseTree(clock, now),
    // §17.117 — every Board carries a workflow-status table; the
    // showcase board adopts the PDCA defaults so the WorkflowNodes
    // attached to the `workflow` panel resolve their status badges
    // on a fresh kiosk boot without operator setup.
    workflowStatuses: DEFAULT_WORKFLOW_STATUSES,
  };
}
