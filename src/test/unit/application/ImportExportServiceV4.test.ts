import { beforeEach, describe, expect, it, vi } from "vitest";

import { ImportExportServiceV4 } from "../../../application/ImportExportServiceV4.js";
import type { TreeCodecV4 } from "../../../application/ports/TreeCodecV4.js";
import type { Clock } from "../../../domain/capabilities/Clock.js";
import { TextNodeV4 } from "../../../domain/nodes/TextNodeV4.js";
import { Tree } from "../../../domain/Tree.js";
import { Timestamp } from "../../../domain/values/Timestamp.js";
import { Weight } from "../../../domain/values/Weight.js";

const clock: Clock = { now: () => Timestamp.of(new Date("2026-05-16T16:00:00Z")) };
const freshTree = (rootId: string): Tree => new Tree(new TextNodeV4(rootId, "Root", Weight.of(1), clock));

const inMemoryCodec = (decodeMap: Record<string, Tree>): TreeCodecV4 => ({
  encode: vi.fn((tree: Tree) => JSON.stringify({ id: tree.root.id })),
  decode: vi.fn((text: string) => {
    let payload: { id: string };
    try { payload = JSON.parse(text) as { id: string }; }
    catch { throw new Error("malformed JSON"); }
    const found = decodeMap[payload.id];
    if (!found) throw new Error(`unknown tree id "${payload.id}"`);
    return found;
  }),
});

describe("ImportExportServiceV4 (§17.103 — type-only successor; validate-before-replace preserved)", () => {
  let currentTree: Tree;
  let getCurrentTree: () => Tree;
  let replaceCurrentTree: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    currentTree = freshTree("current-root");
    getCurrentTree = () => currentTree;
    replaceCurrentTree = vi.fn(async (tree: Tree) => { currentTree = tree; });
  });

  it("exportCurrentTree — returns codec encoding; re-reads tree on every call (no caching)", () => {
    const codec = inMemoryCodec({});
    const svc = new ImportExportServiceV4(codec, getCurrentTree, replaceCurrentTree);

    const out1 = svc.exportCurrentTree();
    expect(out1).toBe(JSON.stringify({ id: "current-root" }));
    expect(codec.encode).toHaveBeenCalledTimes(1);

    currentTree = freshTree("after-rotation");
    const out2 = svc.exportCurrentTree();
    expect(out2).toBe(JSON.stringify({ id: "after-rotation" }));
    expect(codec.encode).toHaveBeenCalledTimes(2);
  });

  it("importIntoCurrentBoard — decodes valid JSON, replaces tree, calls decode BEFORE replace", async () => {
    const incoming = freshTree("imported-root");
    const codec = inMemoryCodec({ "imported-root": incoming });
    const order: string[] = [];
    (codec.decode as ReturnType<typeof vi.fn>).mockImplementation((text: string) => {
      order.push("decode");
      return inMemoryCodec({ "imported-root": incoming }).decode(text);
    });
    replaceCurrentTree = vi.fn(async (tree: Tree) => { order.push("replace"); currentTree = tree; });
    const svc = new ImportExportServiceV4(codec, getCurrentTree, replaceCurrentTree);

    const r = await svc.importIntoCurrentBoard(JSON.stringify({ id: "imported-root" }));
    expect(r.ok).toBe(true);
    expect(currentTree).toBe(incoming);
    expect(replaceCurrentTree).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["decode", "replace"]);
  });

  it("importIntoCurrentBoard — malformed JSON + unknown id + replace-throw all → { ok: false } without losing the current tree", async () => {
    const codec = inMemoryCodec({});
    const svc = new ImportExportServiceV4(codec, getCurrentTree, replaceCurrentTree);

    const malformed = await svc.importIntoCurrentBoard("not-actually-json{");
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.reason).toMatch(/malformed json/i);

    const unknownId = await svc.importIntoCurrentBoard(JSON.stringify({ id: "stranger" }));
    expect(unknownId.ok).toBe(false);
    if (!unknownId.ok) expect(unknownId.reason).toMatch(/unknown tree id/i);

    expect(replaceCurrentTree).not.toHaveBeenCalled();
    expect(currentTree.root.id).toBe("current-root");

    const incoming = freshTree("imported-root");
    const codec2 = inMemoryCodec({ "imported-root": incoming });
    const failing = vi.fn().mockRejectedValue(new Error("Storage full"));
    const svc2 = new ImportExportServiceV4(codec2, getCurrentTree, failing);
    const replaceErr = await svc2.importIntoCurrentBoard(JSON.stringify({ id: "imported-root" }));
    expect(replaceErr.ok).toBe(false);
    if (!replaceErr.ok) expect(replaceErr.reason).toMatch(/storage full/i);
    expect(currentTree.root.id).toBe("current-root");
  });

  it("round-trip — export then import preserves the tree reference through the codec", async () => {
    const sourceTree = freshTree("rt-tree");
    currentTree = sourceTree;
    const codec = inMemoryCodec({ "rt-tree": sourceTree });
    const svc = new ImportExportServiceV4(codec, getCurrentTree, replaceCurrentTree);

    const exported = svc.exportCurrentTree();
    currentTree = freshTree("scratch");
    const r = await svc.importIntoCurrentBoard(exported);

    expect(r.ok).toBe(true);
    expect(currentTree).toBe(sourceTree);
  });
});
