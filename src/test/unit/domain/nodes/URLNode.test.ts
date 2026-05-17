import { describe, expect, it } from "vitest";

import { Node } from "../../../../domain/nodes/Node.js";
import { URLNode } from "../../../../domain/nodes/URLNode.js";
import { ValueNode } from "../../../../domain/nodes/ValueNode.js";
import { Weight } from "../../../../domain/values/Weight.js";

const make = (url = "https://example.com/docs"): URLNode =>
  new URLNode("u", "Docs", Weight.of(1), url);

describe("URLNode (§17.120 — URL-typed node carrying a single URL rendered as a QR code)", () => {
  describe("inheritance chain", () => {
    it("extends ValueNode<string> → Node (NOT HistorizableValueNode — URLs are snapshots, not timelines)", () => {
      const n = make();
      expect(n).toBeInstanceOf(ValueNode);
      expect(n).toBeInstanceOf(Node);
    });
  });

  describe("URL storage — per the operator's §17.120 contract, the URL lives in the inherited description slot", () => {
    it("the constructor seeds _description with the (trimmed) URL", () => {
      const n = make("  https://example.com/docs  ");
      expect(n.getDescription()).toBe("https://example.com/docs");
    });

    it("getValue() and url getter both return the description (the URL IS the description)", () => {
      const n = make("https://kiosk.local/page");
      expect(n.getValue()).toBe("https://kiosk.local/page");
      expect(n.url).toBe("https://kiosk.local/page");
      // SPEC §17.120 — getValue / url / getDescription are three views
      // of the same string slot on URLNode.
      expect(n.getValue()).toBe(n.getDescription());
      expect(n.url).toBe(n.getDescription());
    });
  });

  describe("getValue() — returns the URL verbatim", () => {
    it("accepts any non-empty string (mailto:, tel:, custom schemes, plain text all flow through unchanged)", () => {
      // SPEC §17.120 — the domain stays loose about the URL shape; the
      // qrcode library accepts arbitrary text. The view layer surfaces
      // a warning glyph only when QR generation itself throws.
      expect(make("mailto:ops@example.com").getValue()).toBe(
        "mailto:ops@example.com",
      );
      expect(make("tel:+33-1-23-45-67-89").getValue()).toBe(
        "tel:+33-1-23-45-67-89",
      );
      expect(make("custom-scheme://payload").getValue()).toBe(
        "custom-scheme://payload",
      );
      // Even a plain-text payload — the QR encodes whatever the
      // operator pastes; scanners surface non-URL payloads as text.
      expect(make("just some text").getValue()).toBe("just some text");
    });
  });

  describe("url validation", () => {
    it("rejects an empty / whitespace-only URL", () => {
      expect(() => new URLNode("u", "T", Weight.of(1), "")).toThrow(
        /cannot be empty/,
      );
      expect(() => new URLNode("u", "T", Weight.of(1), "   ")).toThrow(
        /cannot be empty/,
      );
    });

    it("rejects a non-string URL (defensive type check at the seam)", () => {
      // Mirrors PictureNode.test.ts — JS callers from un-typed adapters
      // can still pass numbers / null / undefined. The class throws
      // synchronously so the failure surfaces at the seam, not at QR-
      // render time.
      expect(
        () =>
          new URLNode(
            "u",
            "T",
            Weight.of(1),
            // @ts-expect-error -- intentionally wrong type at the seam
            42,
          ),
      ).toThrow(/must be a string/);
    });
  });

  describe("setUrl — atomic-replacement mutator", () => {
    it("swaps the URL with a validated trimmed string", () => {
      const n = make("https://a.example/x");
      n.setUrl("  https://b.example/y  ");
      expect(n.url).toBe("https://b.example/y");
      expect(n.getValue()).toBe("https://b.example/y");
      // SPEC §17.120 — the description slot mirrors the new URL too
      // (one storage slot, three projections).
      expect(n.getDescription()).toBe("https://b.example/y");
    });

    it("throws on an empty replacement and leaves the prior URL intact", () => {
      const n = make("https://a.example/x");
      expect(() => n.setUrl("")).toThrow(/cannot be empty/);
      expect(n.url).toBe("https://a.example/x");
      expect(n.getDescription()).toBe("https://a.example/x");
    });

    it("throws on a non-string replacement and leaves the prior URL intact", () => {
      const n = make("https://a.example/x");
      expect(() =>
        // @ts-expect-error -- intentionally wrong type at the seam
        n.setUrl(null),
      ).toThrow(/must be a string/);
      expect(n.url).toBe("https://a.example/x");
    });
  });

  describe("setDescription — direct description mutation also rewrites the URL projection", () => {
    // SPEC §17.120 — because the URL IS the description, calling
    // setDescription on a URLNode is observationally equivalent to
    // setUrl, MINUS the validator. We document the corner intentionally:
    // EditNodeService should always call setUrl (which trips the
    // validator); setDescription stays available for direct codec /
    // domain-internal callers that have already validated the input.
    it("setDescription updates url and getValue too (same slot)", () => {
      const n = make();
      n.setDescription("https://changed.example/z");
      expect(n.url).toBe("https://changed.example/z");
      expect(n.getValue()).toBe("https://changed.example/z");
    });

    it("setDescription bypasses the trim-non-empty validator (corner — internal use only)", () => {
      // Doc-only assertion: setDescription accepts the empty string;
      // EditNodeService MUST route URL edits through setUrl. The codec's
      // decode path also routes through `new URLNode(...)` which trips
      // the constructor's validator, so the only way to land an empty
      // description on a URLNode in practice is a domain-internal
      // bypass — and that would surface immediately when the view tries
      // to render an empty QR.
      const n = make();
      n.setDescription("");
      expect(n.getDescription()).toBe("");
      expect(n.url).toBe("");
    });
  });

  describe("Node surface (title / weight / parent / children) inherited verbatim", () => {
    it("exposes title and weight from the constructor", () => {
      const n = make();
      expect(n.title).toBe("Docs");
      expect(n.weight.value).toBe(1);
    });

    it("supports setTitle / setWeight for the edit-service path", () => {
      const n = make();
      n.setTitle("Bug tracker");
      n.setWeight(Weight.of(2));
      expect(n.title).toBe("Bug tracker");
      expect(n.weight.value).toBe(2);
    });

    it("supports attach / detach via the Node base class", () => {
      const parent = make("https://a/x");
      const child = new URLNode("u2", "Other", Weight.of(1), "https://b/y");
      parent.attach(child);
      expect(parent.children).toHaveLength(1);
      expect(child.parent).toBe(parent);
      parent.detach(child);
      expect(parent.children).toHaveLength(0);
      expect(child.parent).toBeNull();
    });

    it("inherits the disabled flag from ValueNode (§17.99a default false)", () => {
      const n = make();
      expect(n.disabled).toBe(false);
      n.setDisabled(true);
      expect(n.disabled).toBe(true);
      n.setDisabled(false);
      expect(n.disabled).toBe(false);
    });
  });
});
