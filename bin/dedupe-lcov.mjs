#!/usr/bin/env node
/**
 * Strip Vitest/c8 (empty-report) blocks from `coverage/lcov.info`.
 *
 * **Why** — Vitest's `v8` coverage provider sometimes emits TWO `SF:`
 * blocks for the same source file: one with the real per-line hit
 * data (e.g. `LH:13, LF:13` = 100 % covered) and a stray
 * `FN:1,(empty-report)` block that re-declares every source line as
 * `DA:N,0` (zero hits). SonarQube's `genericcoverage` ingester does
 * NOT take the union — it overlays the second SF block on top of the
 * first, so the spurious zero-hit lines drag the file's coverage
 * down to ~0 %. On files that are flagged as **new code** (period
 * just opened, e.g. after a rename) this trivially flunks the
 * `new_coverage >= 80 %` gate condition even though the file is
 * fully covered by the unit suite.
 *
 * **Trigger** — observed on §17.114b (rename strand): every renamed
 * card / node file gained an `(empty-report)` block right after its
 * real coverage block, so `BusinessScoreCard.ts` reported 8 of 9
 * "new lines" uncovered when in reality every executable line is
 * hit by `src/test/unit/domain/cards/Card.test.ts`. The dedup fix
 * preserves the real block intact and drops the empty one entirely.
 * Same shape as the upstream Vitest issues for v8 + multi-spec runs.
 *
 * **Contract** — read `coverage/lcov.info` (or the path passed as
 * the first CLI arg), drop any `SF:` block whose body contains a
 * `FN:<line>,(empty-report)` marker, write the cleaned content back
 * to the same path. Idempotent — re-running on already-deduped lcov
 * is a no-op. Exit 0 always (best-effort cleanup; missing file is
 * not an error so the script can sit safely in front of any sonar
 * invocation).
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve(process.argv[2] ?? "coverage/lcov.info");
if (!existsSync(target)) {
  console.log(`[dedupe-lcov] ${target} missing — nothing to clean`);
  process.exit(0);
}

const original = readFileSync(target, "utf8");

const blocks = original.split(/(?<=^end_of_record\r?\n)/m);
let droppedCount = 0;
const kept = [];
for (const block of blocks) {
  if (/^FN:\d+,\(empty-report\)\s*$/m.test(block)) {
    droppedCount += 1;
    continue;
  }
  kept.push(block);
}

if (droppedCount === 0) {
  console.log(`[dedupe-lcov] no (empty-report) blocks found — file untouched`);
  process.exit(0);
}

writeFileSync(target, kept.join(""), "utf8");
console.log(`[dedupe-lcov] dropped ${droppedCount} (empty-report) block(s) from ${target}`);
