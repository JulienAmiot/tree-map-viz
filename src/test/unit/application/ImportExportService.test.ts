import { beforeEach, describe, expect, it, vi } from "vitest";

import { ImportExportService } from "../../../application/ImportExportService.js";
import type { TreeCodec } from "../../../application/ports/TreeCodec.js";
import { TextNode } from "../../../domain/nodes/TextNode.js";
import type { TreeNode } from "../../../domain/nodes/TreeNode.js";
import { Description } from "../../../domain/values/Description.js";
import { NodeIdentity } from "../../../domain/values/NodeIdentity.js";
import { Title } from "../../../domain/values/Title.js";
import { Weight } from "../../../domain/values/Weight.js";

// ----- helpers --------------------------------------------------------------

function tn(idStr: string, title = "X"): TextNode {
  return new TextNode(
    idStr,
    NodeIdentity.of(Title.of(title), Description.of("")),
    Weight.of(1),
  );
}

/**
 * In-memory TreeCodec used by the tests. The encoded form is `JSON.stringify({id})`
 * which is enough to assert that the right tree was passed in / out.
 */
function inMemoryCodec(decodeMap: Record<string, TreeNode<unknown>>): TreeCodec {
  return {
    encode: vi.fn((tree: TreeNode<unknown>) => JSON.stringify({ id: tree.id })),
    decode: vi.fn((text: string) => {
      let payload: { id: string };
      try {
        payload = JSON.parse(text) as { id: string };
      } catch {
        throw new Error("malformed JSON");
      }
      const found = decodeMap[payload.id];
      if (!found) {
        throw new Error(`unknown tree id "${payload.id}"`);
      }
      return found;
    }),
  };
}

// ----- tests ----------------------------------------------------------------

describe("ImportExportService", () => {
  let currentTree: TreeNode<unknown>;
  let getCurrentTree: () => TreeNode<unknown>;
  let replaceCurrentTree: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    currentTree = tn("current-root");
    getCurrentTree = () => currentTree;
    replaceCurrentTree = vi.fn(async (tree: TreeNode<unknown>) => {
      currentTree = tree;
    });
  });

  describe("exportCurrentTree", () => {
    it("returns the codec's encoding of the current tree", () => {
      const codec = inMemoryCodec({});
      const svc = new ImportExportService(codec, getCurrentTree, replaceCurrentTree);

      const out = svc.exportCurrentTree();

      expect(out).toBe(JSON.stringify({ id: "current-root" }));
      expect(codec.encode).toHaveBeenCalledTimes(1);
      expect(codec.encode).toHaveBeenCalledWith(currentTree);
    });

    it("re-reads the current tree on every export call (no caching)", () => {
      const codec = inMemoryCodec({});
      const svc = new ImportExportService(codec, getCurrentTree, replaceCurrentTree);

      svc.exportCurrentTree();
      currentTree = tn("after-rotation");
      const out2 = svc.exportCurrentTree();

      expect(out2).toBe(JSON.stringify({ id: "after-rotation" }));
    });
  });

  describe("importIntoCurrentBoard — validate first, replace second", () => {
    it("decodes valid JSON and replaces the current tree", async () => {
      const incoming = tn("imported-root");
      const codec = inMemoryCodec({ "imported-root": incoming });
      const svc = new ImportExportService(codec, getCurrentTree, replaceCurrentTree);

      const r = await svc.importIntoCurrentBoard(JSON.stringify({ id: "imported-root" }));

      expect(r).toEqual({ ok: true });
      expect(codec.decode).toHaveBeenCalledTimes(1);
      expect(replaceCurrentTree).toHaveBeenCalledTimes(1);
      expect(replaceCurrentTree).toHaveBeenCalledWith(incoming);
      expect(currentTree).toBe(incoming);
    });

    it("rejects malformed JSON without calling the replace callback", async () => {
      const codec = inMemoryCodec({});
      const svc = new ImportExportService(codec, getCurrentTree, replaceCurrentTree);

      const r = await svc.importIntoCurrentBoard("not-actually-json{");

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toMatch(/malformed json/i);
      }
      expect(replaceCurrentTree).not.toHaveBeenCalled();
      expect(currentTree.id).toBe("current-root");
    });

    it("rejects structurally invalid input (decoder throws) without replacing", async () => {
      const codec = inMemoryCodec({}); // empty decode map → unknown ids throw
      const svc = new ImportExportService(codec, getCurrentTree, replaceCurrentTree);

      const r = await svc.importIntoCurrentBoard(JSON.stringify({ id: "stranger" }));

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toMatch(/unknown tree id/i);
      }
      expect(replaceCurrentTree).not.toHaveBeenCalled();
      expect(currentTree.id).toBe("current-root");
    });

    it("decode is called BEFORE replace (validate-first ordering)", async () => {
      const order: string[] = [];
      const codec: TreeCodec = {
        encode: vi.fn(),
        decode: vi.fn((_text: string) => {
          order.push("decode");
          return tn("imported");
        }),
      };
      replaceCurrentTree = vi.fn(async () => {
        order.push("replace");
      });
      const svc = new ImportExportService(codec, getCurrentTree, replaceCurrentTree);

      await svc.importIntoCurrentBoard("{}");

      expect(order).toEqual(["decode", "replace"]);
    });

    it("surfaces a replace error as ok:false (decoded tree is discarded)", async () => {
      const incoming = tn("imported-root");
      const codec = inMemoryCodec({ "imported-root": incoming });
      replaceCurrentTree = vi.fn().mockRejectedValue(new Error("Storage full"));
      const svc = new ImportExportService(codec, getCurrentTree, replaceCurrentTree);

      const r = await svc.importIntoCurrentBoard(JSON.stringify({ id: "imported-root" }));

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toMatch(/storage full/i);
      }
    });
  });

  describe("round-trip", () => {
    it("export then import preserves the tree (round-trip via codec)", async () => {
      const sourceTree = tn("rt-tree");
      currentTree = sourceTree;
      const codec = inMemoryCodec({ "rt-tree": sourceTree });
      const svc = new ImportExportService(codec, getCurrentTree, replaceCurrentTree);

      const exported = svc.exportCurrentTree();
      currentTree = tn("scratch");
      const r = await svc.importIntoCurrentBoard(exported);

      expect(r.ok).toBe(true);
      expect(currentTree).toBe(sourceTree);
    });
  });
});
