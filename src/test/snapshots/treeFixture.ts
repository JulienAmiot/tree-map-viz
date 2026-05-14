/**
 * Canonical wire-shape fixtures for the §17.85 schema snapshot guard.
 *
 * Two builders ship from this module:
 *   - {@link buildSnapshotTree} — a 3-node tree (TextNode root + 2 BSC
 *     children: one recorded + one computed) that exercises every wire
 *     branch the §17.85 byte-equality test guards against.
 *   - {@link buildSnapshotEnvelope} — a 1-board collection snapshot
 *     wrapping the tree, exercising every field of the LocalStorage
 *     repository's wire envelope.
 *
 * Every field is hard-coded (ids, ISO dates, weights, values). The
 * snapshot files in this folder are the byte-string forms of these
 * fixtures; changing any field below changes the snapshot files,
 * which trips the {@link bin/check-version-bump.mjs} CI guard
 * unless `package.json#version`'s major component is also bumped.
 *
 * Design notes — what the fixture covers vs what it deliberately doesn't:
 *   - **Covered**: TextNode with seeded history; BusinessScoreCardNode
 *     `recorded` (`computed=false`); BusinessScoreCardNode `computed`
 *     (`computed=true`, eligible-for-parent flag set both ways);
 *     non-default `Objective.targetDate`; `Unit` round-trip; weight
 *     value object round-trip.
 *   - **NOT covered**: deeper recursion than 1 level (the codec is
 *     recursive by construction — extra depth would not exercise new
 *     code); the codec's open-ended `targetDate` sentinel (omitted
 *     `targetDate` on the wire) — covered by the existing
 *     `jsonCodec.test.ts`, and not part of this snapshot's scope; the
 *     legacy `freshDateColor` field — tolerated on decode but never
 *     emitted on encode, so it cannot appear in a snapshot.
 *
 * If you change any field, regenerate the snapshot files via
 * `npm run snapshot:update` AND bump `package.json#version`'s major
 * (per §17.82 + §17.85).
 */

import type { BoardCollectionSnapshot } from "../../application/ports/BoardCollectionRepository.js";
import { BusinessScoreCard } from "../../domain/nodes/BusinessScoreCard.js";
import { BusinessScoreCardNode } from "../../domain/nodes/BusinessScoreCardNode.js";
import { TextCard } from "../../domain/nodes/TextCard.js";
import { TextNode } from "../../domain/nodes/TextNode.js";
import type { TreeNode } from "../../domain/nodes/TreeNode.js";
import { Description } from "../../domain/values/Description.js";
import { NodeIdentity } from "../../domain/values/NodeIdentity.js";
import { Objective } from "../../domain/values/Objective.js";
import { Timestamp } from "../../domain/values/Timestamp.js";
import { TimestampedValue } from "../../domain/values/TimestampedValue.js";
import { Title } from "../../domain/values/Title.js";
import { Unit } from "../../domain/values/Unit.js";
import { Weight } from "../../domain/values/Weight.js";

/** Frozen ISO timestamps. Anchoring the fixture to a fixed moment keeps the snapshot deterministic. */
const ROOT_ENTRY_DATE_ISO = "2026-05-10T00:00:00.000Z";
const RECORDED_FIRST_DATE_ISO = "2026-04-22T18:25:43.511Z";
const RECORDED_SECOND_DATE_ISO = "2026-04-23T18:25:43.511Z";
const TARGET_DATE_ISO = "2026-12-31T23:59:59.999Z";

function ts(iso: string): Timestamp {
  return Timestamp.of(new Date(Date.parse(iso)));
}

/**
 * Builds the canonical 3-node tree:
 *   root  (TextNode "root", history=["hello" @ 2026-05-10])
 *   ├── a (BusinessScoreCardNode, computed=false, eligible=true,
 *   │      objective 0 → 100 by 2026-12-31, two recorded values)
 *   └── b (BusinessScoreCardNode, computed=true,  eligible=false,
 *          empty history — exercises the "computed parent decoration"
 *          branch of the codec round-trip).
 */
export function buildSnapshotTree(): TreeNode<unknown> {
  const root = new TextNode(
    "root",
    NodeIdentity.of(Title.of("Snapshot root"), Description.of("")),
    Weight.of(1),
    TextCard.of([TimestampedValue.of("hello", ts(ROOT_ENTRY_DATE_ISO))]),
  );

  const recordedObjective = Objective.of(0, 100, ts(TARGET_DATE_ISO));
  const recordedCard = BusinessScoreCard.of(Unit.of("%"), recordedObjective, [
    TimestampedValue.of(42, ts(RECORDED_FIRST_DATE_ISO)),
    TimestampedValue.of(64, ts(RECORDED_SECOND_DATE_ISO)),
  ]);
  const recorded = new BusinessScoreCardNode<number>(
    "a",
    NodeIdentity.of(Title.of("Recorded score"), Description.of("Hand-entered measurement")),
    Weight.of(2),
    recordedCard,
    false,
    true,
  );

  const computedObjective = Objective.of(0, 100, ts(TARGET_DATE_ISO));
  const computedCard = BusinessScoreCard.of(Unit.of("%"), computedObjective, []);
  const computed = new BusinessScoreCardNode<number>(
    "b",
    NodeIdentity.of(Title.of("Computed score"), Description.of("")),
    Weight.of(1),
    computedCard,
    true,
    false,
  );

  root.attach(recorded);
  root.attach(computed);
  return root;
}

/**
 * Builds the canonical envelope wrapping {@link buildSnapshotTree}.
 * One board, deterministic id, deterministic name. Mirrors the
 * `BoardCollectionRepository.save()` payload byte-for-byte.
 */
export function buildSnapshotEnvelope(): BoardCollectionSnapshot {
  return {
    currentBoardId: "board1",
    boards: [
      {
        id: "board1",
        name: "Snapshot board",
        tree: buildSnapshotTree(),
      },
    ],
  };
}
