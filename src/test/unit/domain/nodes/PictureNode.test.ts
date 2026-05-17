import { describe, expect, it } from "vitest";

import { Node } from "../../../../domain/nodes/Node.js";
import { PictureNode } from "../../../../domain/nodes/PictureNode.js";
import { ValueNode } from "../../../../domain/nodes/ValueNode.js";
import { Weight } from "../../../../domain/values/Weight.js";

const make = (url = "https://example.com/cat.jpg"): PictureNode =>
  new PictureNode("p", "Cat", Weight.of(1), url);

describe("PictureNode (§17.119 — picture-typed node carrying a single image URL)", () => {
  describe("inheritance chain", () => {
    it("extends ValueNode<string> → Node (NOT HistorizableValueNode — pictures are snapshots, not timelines)", () => {
      const n = make();
      expect(n).toBeInstanceOf(ValueNode);
      expect(n).toBeInstanceOf(Node);
    });
  });

  describe("getValue() — returns the image URL verbatim", () => {
    it("returns the URL passed to the constructor (trimmed)", () => {
      const n = make("  https://example.com/cat.jpg  ");
      expect(n.getValue()).toBe("https://example.com/cat.jpg");
      expect(n.imageUrl).toBe("https://example.com/cat.jpg");
    });

    it("accepts any non-empty string (data:, blob:, https: all flow through unchanged)", () => {
      expect(make("data:image/png;base64,AAAA").getValue()).toBe(
        "data:image/png;base64,AAAA",
      );
      expect(make("blob:http://kiosk/x").getValue()).toBe("blob:http://kiosk/x");
      expect(make("https://kiosk/p.svg").getValue()).toBe(
        "https://kiosk/p.svg",
      );
    });
  });

  describe("imageUrl validation", () => {
    it("rejects an empty / whitespace-only URL", () => {
      expect(() => new PictureNode("p", "T", Weight.of(1), "")).toThrow(
        /cannot be empty/,
      );
      expect(() => new PictureNode("p", "T", Weight.of(1), "   ")).toThrow(
        /cannot be empty/,
      );
    });

    it("rejects a non-string URL (defensive type check at the seam)", () => {
      // JS callers from un-typed adapters can still pass numbers/null/undefined.
      // The class throws synchronously so the failure surfaces at the seam.
      expect(
        () =>
          new PictureNode(
            "p",
            "T",
            Weight.of(1),
            // @ts-expect-error -- intentionally wrong type at the seam
            42,
          ),
      ).toThrow(/must be a string/);
    });
  });

  describe("setImageUrl — atomic-replacement mutator", () => {
    it("swaps the URL with a validated trimmed string", () => {
      const n = make("https://a.example/x.png");
      n.setImageUrl("  https://b.example/y.png  ");
      expect(n.imageUrl).toBe("https://b.example/y.png");
      expect(n.getValue()).toBe("https://b.example/y.png");
    });

    it("throws on an empty replacement and leaves the prior URL intact", () => {
      const n = make("https://a.example/x.png");
      expect(() => n.setImageUrl("")).toThrow(/cannot be empty/);
      expect(n.imageUrl).toBe("https://a.example/x.png");
    });
  });

  describe("getDescription — inherits the empty _description slot (no inline alt-text today)", () => {
    it("returns '' by default", () => {
      expect(make().getDescription()).toBe("");
    });

    it("setDescription roundtrips for callers that want a future alt-text seam", () => {
      const n = make();
      n.setDescription("a cat sitting on a keyboard");
      expect(n.getDescription()).toBe("a cat sitting on a keyboard");
      // Description does NOT shadow getValue (unlike TextNode's override).
      expect(n.getValue()).toBe("https://example.com/cat.jpg");
    });
  });

  describe("Node surface (title / weight / parent / children) inherited verbatim", () => {
    it("exposes title and weight from the constructor", () => {
      const n = make();
      expect(n.title).toBe("Cat");
      expect(n.weight.value).toBe(1);
    });

    it("supports setTitle / setWeight for the edit-service path", () => {
      const n = make();
      n.setTitle("Other cat");
      n.setWeight(Weight.of(2));
      expect(n.title).toBe("Other cat");
      expect(n.weight.value).toBe(2);
    });

    it("supports attach / detach via the Node base class", () => {
      const parent = make("https://a/x");
      const child = new PictureNode("p2", "Other", Weight.of(1), "https://b/y");
      parent.attach(child);
      expect(parent.children).toHaveLength(1);
      expect(child.parent).toBe(parent);
      parent.detach(child);
      expect(parent.children).toHaveLength(0);
      expect(child.parent).toBeNull();
    });
  });
});
