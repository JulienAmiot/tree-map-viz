import { BusinessScoreCard } from "../domain/BusinessScoreCard.js";
import { Node } from "../domain/Node.js";

/** Demo tree for development and tests; replace with a real adapter behind a port when loading from an API. */
export function buildSampleTree(): Node {
  const now = new Date("2026-04-23T12:00:00Z");

  const deep = new BusinessScoreCard(
    "deep-1",
    "North region",
    "Trailing Q",
    72,
    "%",
    now,
    new Date("2026-05-01"),
    50,
    90,
    [],
  );

  const sales = new BusinessScoreCard(
    "sales",
    "Sales",
    "Revenue vs plan",
    104,
    "%",
    now,
    new Date("2026-04-30"),
    95,
    110,
    [deep],
  );

  const ops = new Node("ops", "Operations", "Cost and throughput", 98, "%", now, []);

  const product = new Node("product", "Product", "Discovery and delivery", null, "", now, [
    new Node("p-backlog", "Backlog health", "Ready stories", 42, "pts", now, []),
    new Node("p-nps", "NPS", "Last 90 days", 38, "", now, []),
  ]);

  return new Node(
    "org",
    "Organization",
    "Tap a branch to zoom into that node and its children.",
    null,
    "",
    now,
    [sales, ops, product],
  );
}
