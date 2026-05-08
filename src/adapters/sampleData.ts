import { BusinessScoreCard } from "../domain/nodes/BusinessScoreCard.js";
import { BusinessScoreCardNode } from "../domain/nodes/BusinessScoreCardNode.js";
import { TextCard } from "../domain/nodes/TextCard.js";
import { TextNode } from "../domain/nodes/TextNode.js";
import { Description } from "../domain/values/Description.js";
import { NodeIdentity } from "../domain/values/NodeIdentity.js";
import { Objective } from "../domain/values/Objective.js";
import { Timestamp } from "../domain/values/Timestamp.js";
import { TimestampedValue } from "../domain/values/TimestampedValue.js";
import { Title } from "../domain/values/Title.js";
import { Unit } from "../domain/values/Unit.js";
import { Weight } from "../domain/values/Weight.js";

function makeIdentity(title: string, description: string): NodeIdentity {
  return NodeIdentity.of(Title.of(title), Description.of(description));
}

/**
 * Demo tree for development (Option B model).
 * Replace with a real adapter behind a port when loading from an API.
 */
export function buildSampleTree(): TextNode {
  // SPEC §17.60 / §17.61 — `Objective.of(..., targetDate)` and
  // `TimestampedValue.of(value, asOf)` both take a `Timestamp`.
  const targetDate = Timestamp.of(new Date("2026-12-31T00:00:00Z"));
  const t1 = Timestamp.of(new Date("2026-04-22T18:25:43.511Z"));
  const t2 = Timestamp.of(new Date("2026-04-23T18:25:43.511Z"));

  const rootCard = TextCard.of([
    TimestampedValue.of("Organization", t2),
  ]);
  const root = new TextNode(
    "org",
    makeIdentity("Organization", "Top"),
    Weight.of(2),
    rootCard,
  );

  const salesCard = BusinessScoreCard.of(
    Unit.percent(),
    Objective.of(95, 110, targetDate),
    [TimestampedValue.of(95, t1), TimestampedValue.of(104, t2)],
  );
  const sales = new BusinessScoreCardNode(
    "sales",
    makeIdentity("Sales", "Revenue vs plan"),
    Weight.of(3),
    salesCard,
    false,
    true,
  );
  root.attach(sales);

  const opsCard = BusinessScoreCard.of(
    Unit.percent(),
    Objective.of(85, 100, targetDate),
    [TimestampedValue.of(98, t2)],
  );
  const ops = new BusinessScoreCardNode(
    "ops",
    makeIdentity("Operations", "Cost and throughput"),
    Weight.of(1),
    opsCard,
    false,
    true,
  );
  root.attach(ops);

  return root;
}
