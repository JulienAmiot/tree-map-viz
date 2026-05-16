import type { TreeCodecV4 } from "../../application/ports/TreeCodecV4.js";
import type { Clock } from "../../domain/capabilities/Clock.js";
import type { BusinessScoreCardV4 } from "../../domain/cards/BusinessScoreCardV4.js";
import { BusinessScoreNode } from "../../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../../domain/nodes/ComputedNode.js";
import type { Node } from "../../domain/nodes/Node.js";
import { StrictRangeNode } from "../../domain/nodes/StrictRangeNode.js";
import { TextNodeV4 } from "../../domain/nodes/TextNodeV4.js";
import { Tree } from "../../domain/Tree.js";
import { v4TreeFromV3Root } from "../../domain/v3Bridge/v4TreeFromV3Root.js";
import type { V3ToV4Options } from "../../domain/v3Bridge/v4NodeFromV3.js";
import type { LenientRange, StrictRange } from "../../domain/values/Range.js";

import { decode as decodeV3 } from "./jsonCodec.js";

/**
 * §17.105 + §17.106a — `TreeCodecV4` adapter. Decode still composes the
 * v3 codec with the §17.81 / §17.88 bridge (carries the §17.99c
 * polymorphic resolution + §17.99b disabled migration + §17.100.5 cards
 * sidecar build). Encode is the §17.106a v4-native walker landed here.
 *
 * **§17.106 split into 106a + 106b** (operator decision 2026-05-16 after
 * the single-strand B+D+E plan hit the §17.53 300-`new_lines` ceiling at
 * 688 actual lines): 106a ships the encoder + the v4-native wire shape,
 * with decode UNTOUCHED on the §17.105 composition path. 106b rewrites
 * decode to walk the v4-native wire shape directly (the only path that
 * can round-trip the round-7 `ComputedNode` + `StrictRangeNode` kinds —
 * the v3 codec rejects unknown nodeTypes, so the v4-only kinds emitted
 * here cannot decode through the composition shim).
 *
 * **Round-trip status between 106a and 106b**: BROKEN for any tree
 * containing a `ComputedNode` or `StrictRangeNode` — `encode` produces
 * v4-native JSON with `kind: "ComputedNodeV4"` / `kind: "StrictRangeNodeV4"`,
 * which `decode` cannot parse (the v3 codec throws `JsonDecodeError` at
 * `/nodeType`). Trees that contain ONLY `TextNodeV4` /
 * `BusinessScoreNode` / `ComputedBusinessScoreNode` round-trip
 * successfully because the encoder emits the v4-native `kind` strings
 * for those too AND `decode` rejects them too — so round-trip works
 * ONLY through 106b. **§17.107 LocalStorageBoardCollectionRepositoryV4
 * MUST wait for 106b** to land before its save→load cycle can work.
 *
 * **Wire schema "v4.0"** — top-level `{ schemaVersion, root, cards[] }`
 * envelope; per-kind node shape:
 *  - `TextNodeV4` → `{ kind, id, title, weight, history, disabled?, children }`
 *  - `BusinessScoreNode` → adds `description, unit?, range, objective, history`
 *  - `ComputedBusinessScoreNode` → BSN minus `history`, plus `computationKind`
 *    (no history because `addValue` throws per §17.94 D5 — audit-only)
 *  - `ComputedNode` → `{ kind, id, title, weight, description,
 *    computationKind, disabled?, children }` (no range/objective/history)
 *  - `StrictRangeNode` → `{ kind: "StrictRangeNodeV4", …, range, history }`
 *
 * `range` serialises as `{ kind: "strict"|"lenient", min, max }` with
 * `null` for `±Infinity` (JSON has no Infinity literal). Comparator
 * NOT serialised — every numeric range today uses
 * `NumericComparator.INSTANCE`; 106b's decoder will hardcode it on
 * reconstruction. Cards sidecar emitted as flat `[{ nodeId, unit }, …]`
 * list to keep the wire JSON-friendly.
 */
export class JsonCodecV4EncodeError extends Error {
  constructor(reason: string) {
    super(`jsonCodecV4 encode error: ${reason}`);
    this.name = "JsonCodecV4EncodeError";
  }
}

const SCHEMA_VERSION = "v4.0";

export function createJsonCodecV4(
  clock: Clock,
  opts: V3ToV4Options = {},
): TreeCodecV4 {
  return {
    decode(text: string): Tree {
      const v3Root = decodeV3(text);
      return v4TreeFromV3Root(v3Root, clock, opts);
    },
    encode(tree: Tree): string {
      return JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        root: encodeNode(tree.root),
        cards: encodeCards(tree.cards),
      });
    },
  };
}

// — Encode walker (§17.106a) — //

function encodeNode(node: Node): Record<string, unknown> {
  if (node instanceof TextNodeV4) return encodeTextNode(node);
  if (node instanceof ComputedBusinessScoreNode) return encodeCBSN(node);
  if (node instanceof BusinessScoreNode) return encodeBSN(node);
  if (node instanceof ComputedNode) return encodeCN(node);
  if (node instanceof StrictRangeNode) return encodeStrictRangeNode(node);
  throw new JsonCodecV4EncodeError(`unsupported v4 Node subclass "${node.constructor.name}" (id="${node.id}")`);
}

function commonFields(node: TextNodeV4 | BusinessScoreNode<number> | ComputedNode<unknown> | StrictRangeNode<number>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: node.id,
    title: node.title,
    weight: node.weight.value,
    children: node.children.map(encodeNode),
  };
  if (node.disabled) out.disabled = true;
  return out;
}

function encodeTextNode(node: TextNodeV4): Record<string, unknown> {
  return {
    kind: "TextNodeV4",
    ...commonFields(node),
    history: node.entries().map((tv) => ({ value: tv.value, at: tv.asOf.moment.toISOString() })),
  };
}

function encodeBSN(node: BusinessScoreNode<number>): Record<string, unknown> {
  const wire: Record<string, unknown> = {
    kind: "BusinessScoreNode",
    ...commonFields(node),
    description: node.getDescription(),
    range: encodeRange(node.range, "lenient"),
    objective: { value: node.objective.value, at: node.objective.at.moment.toISOString() },
    history: node.entries().map((tv) => ({ value: tv.value, at: tv.asOf.moment.toISOString() })),
  };
  if (node.unit.length > 0) wire.unit = node.unit;
  return wire;
}

function encodeCBSN(node: ComputedBusinessScoreNode<number>): Record<string, unknown> {
  const wire: Record<string, unknown> = {
    kind: "ComputedBusinessScoreNode",
    ...commonFields(node),
    description: node.getDescription(),
    range: encodeRange(node.range, "lenient"),
    objective: { value: node.objective.value, at: node.objective.at.moment.toISOString() },
    computationKind: node.computationKind.name,
  };
  if (node.unit.length > 0) wire.unit = node.unit;
  return wire;
}

function encodeCN(node: ComputedNode<unknown>): Record<string, unknown> {
  return {
    kind: "ComputedNode",
    ...commonFields(node),
    description: node.getDescription(),
    computationKind: node.computationKind.name,
  };
}

function encodeStrictRangeNode(node: StrictRangeNode<number>): Record<string, unknown> {
  return {
    kind: "StrictRangeNodeV4",
    ...commonFields(node),
    description: node.getDescription(),
    range: encodeRange(node.range, "strict"),
    history: node.entries().map((tv) => ({ value: tv.value, at: tv.asOf.moment.toISOString() })),
  };
}

function encodeRange(
  range: LenientRange<number> | StrictRange<number>,
  kind: "lenient" | "strict",
): Record<string, unknown> {
  return {
    kind,
    min: Number.isFinite(range.minimalValue) ? range.minimalValue : null,
    max: Number.isFinite(range.maximalValue) ? range.maximalValue : null,
  };
}

function encodeCards(cards: ReadonlyMap<string, BusinessScoreCardV4<unknown>>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const [nodeId, card] of cards) {
    out.push({ nodeId, unit: card.getUnit().value });
  }
  return out;
}
