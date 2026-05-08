/**
 * `buildShowcaseSeed()` — the rich demo tree that lands on a fresh kiosk
 * boot (SPEC §17.21).
 *
 * Designed to exercise every visible UI branch in one focused view:
 *
 *  - **TextNode root** with a non-empty history → text body + corner
 *    timestamp coloured by the §17.42 fixed white → dark-grey age
 *    gradient. The root's current value uses §17.27 markdown
 *    (heading + bullets + bold) so the kiosk landing tile shows what
 *    the markdown rendering looks like at a glance.
 *  - **Five direct children** mixing TextNode + BusinessScoreCard, all
 *    three `computedValue` branches, and an `eligibleForParentComputation
 *    = false` BSC under the computed-mean branch:
 *
 *      Engineering        — BSC, computed=true, eligible children → Σ mean.
 *      Product            — BSC, computed=false, recorded value (today).
 *      Sales              — BSC, computed=true, mix of eligible / non-eligible
 *                           children (the eligible-only mean differs from
 *                           a naive average — exercises §3 weighting).
 *      Operations         — TextNode with a status update from ~3 weeks ago
 *                           (mid-gradient on the date-age colour). Uses
 *                           §17.27 markdown (paragraph + ordered list
 *                           + inline code) to round out the demo.
 *      Bench              — BSC, computed=true, NO children → empty value
 *                           area + no timestamp (§13.2 + §17.18).
 *
 *  - **Histories** span today → ~120 days back so the date-age gradient
 *    is visually rich at a glance:
 *      • today           → fresh end of the gradient.
 *      • 14 days         → ~8% along.
 *      • 30 days         → ~17% along.
 *      • 90 days         → 50% along.
 *      • 120 days        → 67% along.
 *
 * The tree's IDs are **stable** (slug-based, not random) so e2e
 * scenarios can target known nodes without seeding their own fixture.
 *
 * Lives under `adapters/` because it depends on domain construction
 * primitives + `BoardCollectionRepository`'s `Board` shape; both
 * imports are fine for adapter-layer code per §14.1.
 */

import type { Board } from "../application/ports/BoardCollectionRepository.js";
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Board id for the showcase seed; stable so the URL is stable across refreshes. */
export const SHOWCASE_BOARD_ID = "showcase-board";
export const SHOWCASE_BOARD_NAME = "Showcase";

/**
 * Build the showcase tree. Takes an explicit `now` so e2e fixtures can
 * pin deterministic timestamps; production callers omit it.
 */
export function buildShowcaseTree(now: Date = new Date()): TextNode {
  const todayDate = startOfUtcHour(now);
  // SPEC §17.60 / §17.61 — both `Objective.of(..., targetDate)` and
  // `TimestampedValue.of(value, asOf)` take a `Timestamp`. Convert
  // here once so the 30+ factory call sites below stay readable as
  // `..., today)` / `..., days(n))`.
  const today = Timestamp.of(todayDate);
  const days = (n: number): Timestamp =>
    Timestamp.of(new Date(todayDate.getTime() - n * MS_PER_DAY));
  const targetDate = Timestamp.of(
    new Date(Date.UTC(todayDate.getUTCFullYear(), 11, 31, 23, 59, 59)),
  );

  const root = new TextNode(
    "showcase-root",
    identity("Quarterly OKRs", "Top-level board for the quarter"),
    Weight.of(1),
    // SPEC §17.27 — landing tile demos the markdown subset (heading
    // + bold + unordered list) so a fresh kiosk boot shows what
    // text-node values can carry.
    TextCard.of([
      TimestampedValue.of(
        [
          "## Q2 status",
          "",
          "On track \u2014 watch the **Sales** pipeline.",
          "",
          "- Engineering shipping on plan",
          "- Product NPS recovering",
          "- Sales win-rate above target",
        ].join("\n"),
        today,
      ),
      TimestampedValue.of(
        "Q1 closed strong: revenue *up* 18 %, NPS at `42`.",
        days(45),
      ),
    ]),
  );

  // Engineering — computed=true with eligible children → Σ mean.
  const engineering = new BusinessScoreCardNode<number>(
    "engineering",
    identity("Engineering", "Delivery + quality KPIs"),
    Weight.of(2),
    BusinessScoreCard.of(
      Unit.percent(),
      Objective.of(80, 100, targetDate),
      // The card itself carries a recorded history too, but `computed=true`
      // means the displayed value comes from the children's mean instead;
      // the recorded points stay around as historical context.
      [
        TimestampedValue.of(82, days(60)),
        TimestampedValue.of(88, days(30)),
      ],
    ),
    true,
    true,
  );
  engineering.attach(
    new BusinessScoreCardNode<number>(
      "eng-velocity",
      identity("Velocity", "Story points shipped per sprint"),
      Weight.of(2),
      BusinessScoreCard.of(
        Unit.of("pts"),
        Objective.of(60, 90, targetDate),
        [
          TimestampedValue.of(70, days(30)),
          TimestampedValue.of(82, days(14)),
        ],
      ),
      false,
      true,
    ),
  );
  engineering.attach(
    new BusinessScoreCardNode<number>(
      "eng-review-sla",
      identity("Code review SLA", "% of PRs reviewed within 24 h"),
      Weight.of(1),
      BusinessScoreCard.of(
        Unit.percent(),
        Objective.of(75, 95, targetDate),
        [
          TimestampedValue.of(91, days(14)),
          TimestampedValue.of(96, days(2)),
        ],
      ),
      false,
      true,
    ),
  );
  engineering.attach(
    new BusinessScoreCardNode<number>(
      "eng-coverage",
      identity("Test coverage", "Branch coverage across all packages"),
      Weight.of(1),
      BusinessScoreCard.of(
        Unit.percent(),
        Objective.of(70, 85, targetDate),
        [TimestampedValue.of(78, today)],
      ),
      false,
      true,
    ),
  );
  engineering.attach(
    new TextNode(
      "eng-notes",
      identity("Eng notes", ""),
      Weight.of(1),
      // SPEC §17.27 — paragraph + bold + inline `code` mix.
      TextCard.of([
        TimestampedValue.of(
          "Backend rewrite in flight \u2014 **due end of quarter**. Cut over via `feature-flag-v2`.",
          today,
        ),
      ]),
    ),
  );
  root.attach(engineering);

  // Product — computed=false → recorded value, fresh date.
  root.attach(
    new BusinessScoreCardNode<number>(
      "product",
      identity("Product", "NPS + active-user trend"),
      Weight.of(2),
      BusinessScoreCard.of(
        Unit.of("NPS"),
        Objective.of(20, 50, targetDate),
        [
          TimestampedValue.of(28, days(120)),
          TimestampedValue.of(35, days(60)),
          TimestampedValue.of(42, today),
        ],
      ),
      false,
      true,
    ),
  );

  // Sales — computed=true with mixed eligibility.
  const sales = new BusinessScoreCardNode<number>(
    "sales",
    identity("Sales", "Pipeline + win-rate roll-up"),
    Weight.of(2),
    BusinessScoreCard.of(
      Unit.percent(),
      Objective.of(60, 110, targetDate),
      [TimestampedValue.of(95, days(60))],
    ),
    true,
    true,
  );
  sales.attach(
    new BusinessScoreCardNode<number>(
      "sales-pipeline",
      identity("Pipeline", "Qualified opportunities ($M)"),
      Weight.of(3),
      BusinessScoreCard.of(
        Unit.of("$M"),
        Objective.of(5, 12, targetDate),
        [
          TimestampedValue.of(8.4, days(90)),
          TimestampedValue.of(9.1, days(45)),
        ],
      ),
      false,
      true,
    ),
  );
  sales.attach(
    new BusinessScoreCardNode<number>(
      "sales-winrate",
      identity("Win rate", "Closed-won / qualified"),
      Weight.of(2),
      BusinessScoreCard.of(
        Unit.percent(),
        Objective.of(20, 35, targetDate),
        [TimestampedValue.of(31, today)],
      ),
      false,
      true,
    ),
  );
  // eligibleForParentComputation = false → does NOT contribute to the
  // Sales mean above, but is still rendered as a tile.
  sales.attach(
    new BusinessScoreCardNode<number>(
      "sales-lost",
      identity("Lost deals", "Audit trail \u2014 not a roll-up KPI"),
      Weight.of(1),
      BusinessScoreCard.of(
        Unit.of("count"),
        Objective.of(0, 5, targetDate),
        [
          TimestampedValue.of(4, days(30)),
          TimestampedValue.of(6, today),
        ],
      ),
      false,
      false,
    ),
  );
  root.attach(sales);

  // Operations — TextNode with mid-gradient date.
  root.attach(
    new TextNode(
      "operations",
      identity("Operations", ""),
      Weight.of(1),
      // SPEC §17.27 — paragraph + ordered list to round out the demo:
      // every block-level branch of the markdown renderer is exercised
      // somewhere across the showcase tree (heading + ul on the root,
      // ol here, plain inline elsewhere).
      TextCard.of([
        TimestampedValue.of(
          [
            "Cloud migration **paused**; vendor renegotiation in progress.",
            "",
            "Next steps:",
            "1. Re-baseline the contract terms",
            "2. Re-run the cost projection",
            "3. Decision review at the next ops sync",
          ].join("\n"),
          days(21),
        ),
      ]),
    ),
  );

  // Bench — computed=true, NO children → empty value area, no timestamp.
  root.attach(
    new BusinessScoreCardNode<number>(
      "bench",
      identity("Bench", "Reserved for next quarter"),
      Weight.of(1),
      BusinessScoreCard.of(
        Unit.percent(),
        Objective.of(0, 100, targetDate),
        [],
      ),
      true,
      true,
    ),
  );

  return root;
}

/**
 * Convenience: build the showcase as a {@link Board}, ready to drop
 * into a {@link BoardCollectionSnapshot}.
 */
export function buildShowcaseBoard(now: Date = new Date()): Board {
  return {
    id: SHOWCASE_BOARD_ID,
    name: SHOWCASE_BOARD_NAME,
    tree: buildShowcaseTree(now),
  };
}

function identity(title: string, description: string): NodeIdentity {
  return NodeIdentity.of(Title.of(title), Description.of(description));
}

/**
 * Round `d` down to the start of its UTC hour (zero-out minutes /
 * seconds / ms). Stabilises generated dates against the current clock
 * so the showcase doesn't churn the gradient on every refresh — the
 * bucket only ticks forward once an hour, which is plenty fresh for a
 * kiosk. UTC (not local) so the JSON fixture is timezone-independent.
 */
function startOfUtcHour(d: Date): Date {
  const r = new Date(d.getTime());
  r.setUTCMinutes(0, 0, 0);
  return r;
}
