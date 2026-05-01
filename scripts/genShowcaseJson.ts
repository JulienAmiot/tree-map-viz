/**
 * Regenerate `examples/showcase.json` from the programmatic showcase
 * tree (SPEC §17.21). The pinned `now` keeps the JSON deterministic;
 * bump it (or leave it) when the showcase content changes.
 *
 * Run with:
 *
 *     npx tsx scripts/genShowcaseJson.ts
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { encode } from "../src/adapters/persistence/jsonCodec.js";
import { buildShowcaseTree } from "../src/adapters/showcaseSeed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Pinned "now" for the fixture — keeps JSON output reproducible. */
const PINNED_NOW = new Date("2026-05-01T12:00:00.000Z");

const tree = buildShowcaseTree(PINNED_NOW);
const wire = JSON.parse(encode(tree)) as unknown;
const pretty = JSON.stringify(wire, null, "\t");

const outPath = join(__dirname, "..", "examples", "showcase.json");
writeFileSync(outPath, pretty + "\n", "utf8");

console.log(`Wrote ${outPath}`);
