import type { TreeCodecV4 } from "../../application/ports/TreeCodecV4.js";
import type { Clock } from "../../domain/capabilities/Clock.js";
import { BusinessScoreCardV4 } from "../../domain/cards/BusinessScoreCardV4.js";
import { ComputationKind } from "../../domain/computation/ComputationKind.js";
import { BusinessScoreNode } from "../../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../../domain/nodes/ComputedNode.js";
import type { Node } from "../../domain/nodes/Node.js";
import { StrictRangeNode } from "../../domain/nodes/StrictRangeNode.js";
import { TextNodeV4 } from "../../domain/nodes/TextNodeV4.js";
import type { ValueNode } from "../../domain/nodes/ValueNode.js";
import { Tree } from "../../domain/Tree.js";
import { NumericComparator } from "../../domain/values/Comparator.js";
import { ObjectiveV4 } from "../../domain/values/ObjectiveV4.js";
import { LenientRange, StrictRange } from "../../domain/values/Range.js";
import { Timestamp } from "../../domain/values/Timestamp.js";
import { Unit } from "../../domain/values/Unit.js";
import { Weight } from "../../domain/values/Weight.js";

/**
 * §17.106a + §17.106b — `TreeCodecV4` v4-native codec. Encode/decode
 * walk the "v4.0" wire (`{ schemaVersion, root, cards[] }`); per-kind
 * discriminant under `kind`; Computed* omit history (audit-only,
 * §17.94 D5); range uses `null` for `±Infinity`; comparator hardcoded
 * to `NumericComparator.INSTANCE`; cards sidecar resolved via DFS.
 * Legacy v3 migration relocated to §17.107 adapter.
 */
export class JsonCodecV4DecodeError extends Error {
  constructor(
    readonly pointer: string,
    reason: string,
  ) {
    super(`jsonCodecV4 decode error at ${pointer}: ${reason}`);
    this.name = "JsonCodecV4DecodeError";
  }
}

export class JsonCodecV4EncodeError extends Error {
  constructor(reason: string) {
    super(`jsonCodecV4 encode error: ${reason}`);
    this.name = "JsonCodecV4EncodeError";
  }
}

const SCHEMA_VERSION = "v4.0";

export function createJsonCodecV4(clock: Clock): TreeCodecV4 {
  return {
    decode(text: string): Tree {
      return decodeTree(text, clock);
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

function decodeTree(text: string, clock: Clock): Tree {
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch (err) { throw new JsonCodecV4DecodeError("/", `not valid JSON: ${(err as Error).message}`); }
  const env = requireObject(parsed, "/");
  if (env["schemaVersion"] !== SCHEMA_VERSION) throw new JsonCodecV4DecodeError("/schemaVersion", `expected "${SCHEMA_VERSION}", got ${JSON.stringify(env["schemaVersion"])}`);
  const root = decodeNode(env["root"], "/root", clock);
  return new Tree(root, decodeCards(requireArray(env, "cards", "/"), root, "/cards"));
}

function decodeNode(raw: unknown, p: string, clock: Clock): Node {
  const obj = requireObject(raw, p);
  const kind = requireString(obj, "kind", p);
  const id = requireString(obj, "id", p);
  const title = requireString(obj, "title", p);
  const w = Weight.of(requireNumber(obj, "weight", p));
  let node: ValueNode<unknown>;
  if (kind === "TextNodeV4") {
    const t = new TextNodeV4(id, title, w, clock);
    for (const h of decodeHistory(obj, p, "string")) t.addValue(h.at, h.value as string);
    node = t;
  } else if (kind === "BusinessScoreNode") {
    const bsn = buildBSN(id, title, w, obj, p, clock);
    for (const h of decodeHistory(obj, p, "number")) bsn.addValue(h.at, h.value as number);
    node = bsn;
  } else if (kind === "ComputedBusinessScoreNode") {
    node = buildCBSN(id, title, w, obj, p, clock);
  } else if (kind === "ComputedNode") {
    node = new ComputedNode<unknown>(id, title, w, requireString(obj, "description", p), clock, decodeComputationKind(obj, p));
  } else if (kind === "StrictRangeNodeV4") {
    const srn = new StrictRangeNode<number>(id, title, w, requireString(obj, "description", p), clock, decodeRange(obj, p, "strict", StrictRange.of));
    for (const h of decodeHistory(obj, p, "number")) srn.addValue(h.at, h.value as number);
    node = srn;
  } else {
    throw new JsonCodecV4DecodeError(joinPointer(p, "kind"), `unknown kind "${kind}"`);
  }
  if (obj["disabled"] === true) node.setDisabled(true);
  const cp = joinPointer(p, "children");
  requireArray(obj, "children", p).forEach((c, i) => node.attach(decodeNode(c, joinPointer(cp, String(i)), clock)));
  return node;
}

function buildBSN(id: string, title: string, w: Weight, obj: Record<string, unknown>, p: string, clock: Clock): BusinessScoreNode<number> {
  const unit = optionalString(obj, "unit");
  const objective = decodeObjective(obj, p);
  return new BusinessScoreNode<number>(id, title, w, requireString(obj, "description", p), clock, decodeRange(obj, p, "lenient", LenientRange.of),
    unit === undefined ? { objective } : { objective, unit });
}

function buildCBSN(id: string, title: string, w: Weight, obj: Record<string, unknown>, p: string, clock: Clock): ComputedBusinessScoreNode<number> {
  const unit = optionalString(obj, "unit");
  const objective = decodeObjective(obj, p);
  const initialKind = decodeComputationKind(obj, p);
  return new ComputedBusinessScoreNode<number>(id, title, w, requireString(obj, "description", p), clock, decodeRange(obj, p, "lenient", LenientRange.of),
    unit === undefined ? { objective, initialKind } : { objective, initialKind, unit });
}

function decodeHistory(obj: Record<string, unknown>, p: string, vt: "string" | "number"): { at: Timestamp; value: unknown }[] {
  const hp = joinPointer(p, "history");
  return requireArray(obj, "history", p).map((entry, i) => {
    const ep = joinPointer(hp, String(i));
    const e = requireObject(entry, ep);
    const at = decodeIsoTimestamp(requireString(e, "at", ep), joinPointer(ep, "at"));
    const v = e["value"];
    const vp = joinPointer(ep, "value");
    if (vt === "string" ? typeof v !== "string" : (typeof v !== "number" || !Number.isFinite(v))) {
      throw new JsonCodecV4DecodeError(vp, `expected ${vt === "string" ? "string" : "finite number"}, got ${typeOf(v)}`);
    }
    return { at, value: v };
  });
}

function decodeObjective(obj: Record<string, unknown>, p: string): ObjectiveV4<number> {
  const op = joinPointer(p, "objective");
  const raw = requireObject(obj["objective"], op);
  return ObjectiveV4.of(requireNumber(raw, "value", op), decodeIsoTimestamp(requireString(raw, "at", op), joinPointer(op, "at")));
}

function decodeRange<R>(obj: Record<string, unknown>, p: string, expected: "strict" | "lenient", ctor: (min: number, max: number, c: typeof NumericComparator.INSTANCE) => R): R {
  const rp = joinPointer(p, "range");
  const raw = requireObject(obj["range"], rp);
  const kind = requireString(raw, "kind", rp);
  if (kind !== expected) throw new JsonCodecV4DecodeError(joinPointer(rp, "kind"), `expected "${expected}", got "${kind}"`);
  return ctor(decodeBound(raw["min"], joinPointer(rp, "min"), Number.NEGATIVE_INFINITY), decodeBound(raw["max"], joinPointer(rp, "max"), Number.POSITIVE_INFINITY), NumericComparator.INSTANCE);
}

function decodeBound(raw: unknown, p: string, sentinel: number): number {
  if (raw === null) return sentinel;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  throw new JsonCodecV4DecodeError(p, `expected finite number or null, got ${typeOf(raw)}`);
}

function decodeComputationKind(obj: Record<string, unknown>, p: string): ComputationKind {
  const name = requireString(obj, "computationKind", p);
  const resolved = ComputationKind.fromName(name);
  if (resolved === undefined) throw new JsonCodecV4DecodeError(joinPointer(p, "computationKind"), `unknown ComputationKind name "${name}"`);
  return resolved;
}

function decodeCards(rawList: unknown[], root: Node, p: string): ReadonlyMap<string, BusinessScoreCardV4<unknown>> {
  const out = new Map<string, BusinessScoreCardV4<unknown>>();
  rawList.forEach((entry, i) => {
    const ip = joinPointer(p, String(i));
    const e = requireObject(entry, ip);
    const nodeId = requireString(e, "nodeId", ip);
    const node = findById(root, nodeId);
    if (!(node instanceof BusinessScoreNode)) throw new JsonCodecV4DecodeError(joinPointer(ip, "nodeId"), `no BusinessScoreNode (or subclass) found with id "${nodeId}"`);
    out.set(nodeId, new BusinessScoreCardV4(node, Unit.of(requireString(e, "unit", ip))));
  });
  return out;
}

function findById(node: Node, id: string): Node | undefined {
  if (node.id === id) return node;
  for (const child of node.children) {
    const hit = findById(child, id);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

function decodeIsoTimestamp(raw: string, p: string): Timestamp {
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) throw new JsonCodecV4DecodeError(p, `not a valid ISO-8601 date: "${raw}"`);
  return Timestamp.of(new Date(ms));
}

function requireObject(raw: unknown, p: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new JsonCodecV4DecodeError(p, `expected object, got ${typeOf(raw)}`);
  return raw as Record<string, unknown>;
}

function requireString(obj: Record<string, unknown>, key: string, parent: string): string {
  const v = obj[key];
  if (typeof v !== "string") throw new JsonCodecV4DecodeError(joinPointer(parent, key), `expected string, got ${typeOf(v)}`);
  return v;
}

function optionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function requireNumber(obj: Record<string, unknown>, key: string, parent: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new JsonCodecV4DecodeError(joinPointer(parent, key), `expected finite number, got ${typeOf(v)}`);
  return v;
}

function requireArray(obj: Record<string, unknown>, key: string, parent: string): unknown[] {
  const v = obj[key];
  if (!Array.isArray(v)) throw new JsonCodecV4DecodeError(joinPointer(parent, key), `expected array, got ${typeOf(v)}`);
  return v;
}

function joinPointer(parent: string, token: string): string {
  const escaped = token.replace(/~/g, "~0").replace(/\//g, "~1");
  return parent === "/" || parent === "" ? `/${escaped}` : `${parent}/${escaped}`;
}

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}
