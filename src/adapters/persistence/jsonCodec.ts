/**
 * JSON codec for the persistence wire format described in SPEC §6.
 *
 * The wire shape comes from `examples/test.json`. The decoder folds wire fields
 * into Option B value objects/aggregates:
 *   - `targetValue` + `minimalValue` + `unit` + `targetDate?` → `Objective<T>` + `Unit`
 *   - `historizedValues[]` → `BusinessScoreCard<T>.historizedValues`
 *
 * Open-ended objectives. SPEC §3 makes `Objective.targetDate` mandatory (Date),
 * but `examples/test.json` (the canonical wire fixture) omits the field. The
 * codec resolves this with a single sentinel: `9999-12-31T23:59:59.999Z`. On
 * decode the sentinel is synthesized when `targetDate` is absent; on encode it
 * is omitted, so round-trip on the fixture is structurally preserved without
 * weakening the domain.
 *
 * Errors carry an RFC-6901-style JSON pointer to the offending node/field.
 */

import { BusinessScoreCard } from "../../domain/nodes/BusinessScoreCard.js";
import { BusinessScoreCardNode } from "../../domain/nodes/BusinessScoreCardNode.js";
import { TextCard } from "../../domain/nodes/TextCard.js";
import { TextNode } from "../../domain/nodes/TextNode.js";
import { TreeNode } from "../../domain/nodes/TreeNode.js";
import { Description } from "../../domain/values/Description.js";
import { NodeIdentity } from "../../domain/values/NodeIdentity.js";
import { Objective } from "../../domain/values/Objective.js";
import { Timestamp } from "../../domain/values/Timestamp.js";
import { TimestampedValue } from "../../domain/values/TimestampedValue.js";
import { Title } from "../../domain/values/Title.js";
import { Unit } from "../../domain/values/Unit.js";
import { Weight } from "../../domain/values/Weight.js";

/** Sentinel ISO date used when the wire omits `targetDate` (open-ended objective). */
const OPEN_ENDED_TARGET_DATE_ISO = "9999-12-31T23:59:59.999Z";
const OPEN_ENDED_TARGET_DATE_MS = Date.parse(OPEN_ENDED_TARGET_DATE_ISO);

export class JsonDecodeError extends Error {
  constructor(
    readonly pointer: string,
    reason: string,
  ) {
    super(`JSON decode error at ${pointer}: ${reason}`);
    this.name = "JsonDecodeError";
  }
}

/** Wire-shape types are kept narrow on purpose: anything outside is rejected with a pointer. */
type WireBusinessScoreCard = {
  nodeType: "BusinessScoreCard";
  id: string;
  title: string;
  description: string;
  weight: number;
  unit: string;
  targetValue: number;
  minimalValue: number;
  targetDate?: string;
  historizedValues: { value: number; date: string }[];
  computed: boolean;
  eligibleForParentComputation: boolean;
  childrenNodes: WireNode[];
};

type WireTextNode = {
  nodeType: "TextNode";
  id: string;
  title: string;
  description: string;
  weight: number;
  // SPEC §17.14 — TextNode now carries a `TimestampedValue<string>` history
  // exactly like `BusinessScoreCard` carries a `TimestampedValue<number>`
  // history. Optional on decode for backward compat with pre-§17.14 wire
  // payloads (treated as an empty `TextCard`); always emitted on encode.
  historizedValues?: { value: string; date: string }[];
  childrenNodes: WireNode[];
};

type WireNode = WireBusinessScoreCard | WireTextNode;

export function decode(text: string): TreeNode<unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new JsonDecodeError("/", `not valid JSON: ${(err as Error).message}`);
  }
  return decodeNode(parsed, "/");
}

export function encode(node: TreeNode<unknown>): string {
  return JSON.stringify(encodeNode(node));
}

function decodeNode(raw: unknown, pointer: string): TreeNode<unknown> {
  const obj = requireObject(raw, pointer);
  const nodeType = requireString(obj, "nodeType", pointer);
  switch (nodeType) {
    case "BusinessScoreCard":
      return decodeBusinessScoreCardNode(obj, pointer);
    case "TextNode":
      return decodeTextNode(obj, pointer);
    default:
      throw new JsonDecodeError(joinPointer(pointer, "nodeType"), `unknown nodeType "${nodeType}"`);
  }
}

function decodeBusinessScoreCardNode(
  obj: Record<string, unknown>,
  pointer: string,
): BusinessScoreCardNode<number> {
  const id = requireString(obj, "id", pointer);
  const title = Title.of(requireString(obj, "title", pointer));
  const description = Description.of(requireString(obj, "description", pointer));
  const weight = Weight.of(requireNumber(obj, "weight", pointer));
  const unit = Unit.of(requireString(obj, "unit", pointer));
  const targetValue = requireNumber(obj, "targetValue", pointer);
  const minimalValue = requireNumber(obj, "minimalValue", pointer);
  const targetDate = decodeTargetDate(obj, pointer);

  const historyRaw = requireArray(obj, "historizedValues", pointer);
  const historyPointer = joinPointer(pointer, "historizedValues");
  const history = historyRaw.map((entry, i) =>
    decodeTimestampedValue(entry, joinPointer(historyPointer, String(i))),
  );

  const computed = requireBoolean(obj, "computed", pointer);
  const eligible = requireBoolean(obj, "eligibleForParentComputation", pointer);

  const objective = Objective.of(minimalValue, targetValue, Timestamp.of(targetDate));
  const card = BusinessScoreCard.of(unit, objective, history);
  const node = new BusinessScoreCardNode<number>(
    id,
    NodeIdentity.of(title, description),
    weight,
    card,
    computed,
    eligible,
  );

  attachChildren(node, obj, pointer);
  return node;
}

function decodeTextNode(obj: Record<string, unknown>, pointer: string): TextNode {
  const id = requireString(obj, "id", pointer);
  const title = Title.of(requireString(obj, "title", pointer));
  const description = Description.of(requireString(obj, "description", pointer));
  const weight = Weight.of(requireNumber(obj, "weight", pointer));
  // `historizedValues` is optional on decode (pre-§17.14 wire payloads
  // omitted it); when absent the node decodes with an empty `TextCard`,
  // which is consistent with `currentValue()` throwing `EmptyHistoryError`
  // — the view layer maps that to an empty value area gracefully.
  const historyRaw = obj["historizedValues"];
  let history: ReturnType<typeof decodeTextTimestampedValue>[] = [];
  if (historyRaw !== undefined) {
    if (!Array.isArray(historyRaw)) {
      throw new JsonDecodeError(
        joinPointer(pointer, "historizedValues"),
        `expected array, got ${typeOf(historyRaw)}`,
      );
    }
    const historyPointer = joinPointer(pointer, "historizedValues");
    history = historyRaw.map((entry, i) =>
      decodeTextTimestampedValue(entry, joinPointer(historyPointer, String(i))),
    );
  }
  const card = TextCard.of(history);
  const node = new TextNode(id, NodeIdentity.of(title, description), weight, card);
  attachChildren(node, obj, pointer);
  return node;
}

function decodeTextTimestampedValue(
  raw: unknown,
  pointer: string,
): TimestampedValue<string> {
  const obj = requireObject(raw, pointer);
  const value = requireString(obj, "value", pointer);
  const dateString = requireString(obj, "date", pointer);
  const ms = Date.parse(dateString);
  if (Number.isNaN(ms)) {
    throw new JsonDecodeError(
      joinPointer(pointer, "date"),
      `not a valid ISO-8601 date: "${dateString}"`,
    );
  }
  return TimestampedValue.of(value, new Date(ms));
}

function attachChildren(
  parent: TreeNode<unknown>,
  obj: Record<string, unknown>,
  pointer: string,
): void {
  const childrenRaw = requireArray(obj, "childrenNodes", pointer);
  const childrenPointer = joinPointer(pointer, "childrenNodes");
  childrenRaw.forEach((childRaw, i) => {
    const child = decodeNode(childRaw, joinPointer(childrenPointer, String(i)));
    parent.attach(child);
  });
}

function decodeTargetDate(obj: Record<string, unknown>, pointer: string): Date {
  const raw = obj["targetDate"];
  if (raw === undefined) {
    return new Date(OPEN_ENDED_TARGET_DATE_MS);
  }
  if (typeof raw !== "string") {
    throw new JsonDecodeError(joinPointer(pointer, "targetDate"), `expected string, got ${typeOf(raw)}`);
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    throw new JsonDecodeError(joinPointer(pointer, "targetDate"), `not a valid ISO-8601 date: "${raw}"`);
  }
  return new Date(ms);
}

function decodeTimestampedValue(raw: unknown, pointer: string): TimestampedValue<number> {
  const obj = requireObject(raw, pointer);
  const value = requireNumber(obj, "value", pointer);
  const dateString = requireString(obj, "date", pointer);
  const ms = Date.parse(dateString);
  if (Number.isNaN(ms)) {
    throw new JsonDecodeError(joinPointer(pointer, "date"), `not a valid ISO-8601 date: "${dateString}"`);
  }
  return TimestampedValue.of(value, new Date(ms));
}

function encodeNode(node: TreeNode<unknown>): WireNode {
  if (node instanceof BusinessScoreCardNode) {
    return encodeBusinessScoreCardNode(node);
  }
  if (node instanceof TextNode) {
    return encodeTextNode(node);
  }
  // Defensive: unreachable for current Option B node kinds.
  throw new Error(`encode: unsupported TreeNode subclass "${node.constructor.name}"`);
}

function encodeBusinessScoreCardNode(node: BusinessScoreCardNode<unknown>): WireBusinessScoreCard {
  const targetDateMs = node.card.objective.targetDate.getTime();
  const wire: WireBusinessScoreCard = {
    nodeType: "BusinessScoreCard",
    id: node.id,
    title: node.identity.title.value,
    description: node.identity.description.value,
    targetValue: node.card.objective.targetValue as number,
    minimalValue: node.card.objective.initialValue as number,
    unit: node.card.unit.value,
    historizedValues: node.card.history().map((tv) => ({
      value: tv.value as number,
      date: tv.asOf.toISOString(),
    })),
    computed: node.computed,
    eligibleForParentComputation: node.eligibleForParentComputation,
    weight: node.weight.value,
    childrenNodes: node.children.map(encodeNode),
  };
  if (targetDateMs !== OPEN_ENDED_TARGET_DATE_MS) {
    wire.targetDate = node.card.objective.targetDate.toISOString();
  }
  return wire;
}

function encodeTextNode(node: TextNode): WireTextNode {
  return {
    nodeType: "TextNode",
    id: node.id,
    title: node.identity.title.value,
    description: node.identity.description.value,
    weight: node.weight.value,
    historizedValues: node.card.history().map((tv) => ({
      value: tv.value,
      date: tv.asOf.toISOString(),
    })),
    childrenNodes: node.children.map(encodeNode),
  };
}

// — Pointer + type-guard helpers — //

function requireObject(raw: unknown, pointer: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new JsonDecodeError(pointer, `expected object, got ${typeOf(raw)}`);
  }
  return raw as Record<string, unknown>;
}

function requireString(obj: Record<string, unknown>, key: string, parent: string): string {
  const v = obj[key];
  if (typeof v !== "string") {
    throw new JsonDecodeError(joinPointer(parent, key), `expected string, got ${typeOf(v)}`);
  }
  return v;
}

function requireNumber(obj: Record<string, unknown>, key: string, parent: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new JsonDecodeError(joinPointer(parent, key), `expected finite number, got ${typeOf(v)}`);
  }
  return v;
}

function requireBoolean(obj: Record<string, unknown>, key: string, parent: string): boolean {
  const v = obj[key];
  if (typeof v !== "boolean") {
    throw new JsonDecodeError(joinPointer(parent, key), `expected boolean, got ${typeOf(v)}`);
  }
  return v;
}

function requireArray(obj: Record<string, unknown>, key: string, parent: string): unknown[] {
  const v = obj[key];
  if (!Array.isArray(v)) {
    throw new JsonDecodeError(joinPointer(parent, key), `expected array, got ${typeOf(v)}`);
  }
  return v;
}

/**
 * Join an RFC-6901-style pointer with a child token. Special chars in the token
 * are escaped (`~` → `~0`, `/` → `~1`). Root pointer is `"/"` for readability.
 */
function joinPointer(parent: string, token: string): string {
  const escaped = token.replace(/~/g, "~0").replace(/\//g, "~1");
  if (parent === "/" || parent === "") {
    return `/${escaped}`;
  }
  return `${parent}/${escaped}`;
}

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}
