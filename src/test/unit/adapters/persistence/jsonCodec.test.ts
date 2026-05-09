import { describe, expect, it } from "vitest";

import { decode, encode, JsonDecodeError } from "../../../../adapters/persistence/jsonCodec.js";
import { BusinessScoreCardNode } from "../../../../domain/nodes/BusinessScoreCardNode.js";
import { TextNode } from "../../../../domain/nodes/TextNode.js";
import sampleJson from "../../../../../examples/test.json" with { type: "json" };

describe("jsonCodec", () => {
  describe("decode (BusinessScoreCard wire \u2192 BusinessScoreCardNode)", () => {
    it("decodes the example fixture root into a BusinessScoreCardNode with the wire's id, title, weight, flags", () => {
      const tree = decode(JSON.stringify(sampleJson));
      expect(tree).toBeInstanceOf(BusinessScoreCardNode);
      const root = tree as BusinessScoreCardNode<number>;
      expect(root.id).toBe("UUID1");
      expect(root.identity.title.value).toBe("UUID1 Title");
      expect(root.identity.description.value).toBe("UUID1 description");
      expect(root.weight.value).toBe(1);
      expect(root.computed).toBe(true);
      expect(root.eligibleForParentComputation).toBe(false);
    });

    it("folds targetValue, minimalValue, and unit into the Objective + Unit aggregate", () => {
      const tree = decode(JSON.stringify(sampleJson)) as BusinessScoreCardNode<number>;
      expect(tree.card.unit.value).toBe("%");
      expect(tree.card.objective.targetValue).toBe(100);
      expect(tree.card.objective.initialValue).toBe(0);
    });

    it("parses historizedValues with ISO-8601 dates into TimestampedValue<number> sorted by date asc", () => {
      const tree = decode(JSON.stringify(sampleJson)) as BusinessScoreCardNode<number>;
      const history = tree.card.history();
      expect(history).toHaveLength(2);
      expect(history[0]!.value).toBe(100);
      expect(history[0]!.asOf.moment.toISOString()).toBe("2026-04-22T18:25:43.511Z");
      expect(history[1]!.asOf.moment.toISOString()).toBe("2026-04-23T18:25:43.511Z");
    });

    it("recursively decodes childrenNodes and re-attaches them under their parent", () => {
      const root = decode(JSON.stringify(sampleJson)) as BusinessScoreCardNode<number>;
      expect(root.children).toHaveLength(3);
      const [uuid2, uuid3, uuid4] = root.children;
      expect(uuid2!.id).toBe("UUID2");
      expect(uuid3!.id).toBe("UUID3");
      expect(uuid4!.id).toBe("UUID4");
      expect(uuid2!.parent).toBe(root);
      expect(uuid2!.children).toHaveLength(2);
      expect(uuid2!.children[0]!.id).toBe("UUID5");
      expect(uuid2!.children[0]!.parent).toBe(uuid2);
    });
  });

  describe("decode (TextNode wire \u2192 TextNode)", () => {
    it("decodes a TextNode wire entry into a TextNode instance (no history → empty TextCard)", () => {
      const wire = {
        nodeType: "TextNode",
        id: "txt-1",
        title: "Notes",
        description: "free-form group",
        weight: 1,
        childrenNodes: [],
      };
      const tree = decode(JSON.stringify(wire));
      expect(tree).toBeInstanceOf(TextNode);
      expect(tree.id).toBe("txt-1");
      expect(tree.identity.title.value).toBe("Notes");
      expect(tree.weight.value).toBe(1);
      expect(tree.children).toHaveLength(0);
      expect((tree as TextNode).card.history()).toHaveLength(0);
    });

    it("decodes the TextNode `historizedValues` array into TimestampedValue<string> sorted by date asc (\u00a717.14)", () => {
      const wire = {
        nodeType: "TextNode",
        id: "txt-2",
        title: "Notes",
        description: "",
        weight: 1,
        historizedValues: [
          { value: "newer", date: "2026-04-23T00:00:00.000Z" },
          { value: "older", date: "2026-04-22T00:00:00.000Z" },
        ],
        childrenNodes: [],
      };
      const tree = decode(JSON.stringify(wire)) as TextNode;
      const history = tree.card.history();
      expect(history).toHaveLength(2);
      expect(history[0]!.value).toBe("older");
      expect(history[0]!.asOf.moment.toISOString()).toBe("2026-04-22T00:00:00.000Z");
      expect(history[1]!.value).toBe("newer");
      expect(tree.currentValue().value).toBe("newer");
    });

    it("rejects a TextNode wire whose `historizedValues` entry has an unparseable date", () => {
      const wire = {
        nodeType: "TextNode",
        id: "txt-3",
        title: "T",
        description: "",
        weight: 1,
        historizedValues: [{ value: "v", date: "not-a-date" }],
        childrenNodes: [],
      };
      try {
        decode(JSON.stringify(wire));
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(JsonDecodeError);
        expect((err as JsonDecodeError).pointer).toBe("/historizedValues/0/date");
      }
    });

    it("emits the `historizedValues` field on encode (round-trip preserves the TextCard)", () => {
      const wire = {
        nodeType: "TextNode",
        id: "txt-4",
        title: "Round-trip",
        description: "",
        weight: 1,
        historizedValues: [
          { value: "first", date: "2026-04-22T00:00:00.000Z" },
          { value: "second", date: "2026-04-23T00:00:00.000Z" },
        ],
        childrenNodes: [],
      };
      const tree = decode(JSON.stringify(wire));
      const reparsed = JSON.parse(encode(tree));
      expect(reparsed).toEqual(wire);
    });
  });

  describe("decode error handling (JSON-pointer)", () => {
    it("throws JsonDecodeError with pointer '/' when the input is not valid JSON", () => {
      expect(() => decode("{not valid json")).toThrow(JsonDecodeError);
      try {
        decode("{not valid json");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(JsonDecodeError);
        expect((err as JsonDecodeError).pointer).toBe("/");
      }
    });

    it("throws with a pointer to the first missing required field", () => {
      const wire = { nodeType: "BusinessScoreCard", title: "x", description: "y" };
      try {
        decode(JSON.stringify(wire));
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(JsonDecodeError);
        expect((err as JsonDecodeError).pointer).toMatch(/^\/(id|.*)/);
      }
    });

    it("throws with a nested pointer when a child node is malformed", () => {
      const wire = {
        nodeType: "BusinessScoreCard",
        id: "root",
        title: "r",
        description: "",
        weight: 1,
        unit: "%",
        targetValue: 100,
        minimalValue: 0,
        historizedValues: [],
        computed: false,
        eligibleForParentComputation: true,
        childrenNodes: [
          {
            nodeType: "BusinessScoreCard",
            id: 42,
            title: "child",
            description: "",
            weight: 1,
            unit: "%",
            targetValue: 100,
            minimalValue: 0,
            historizedValues: [],
            computed: false,
            eligibleForParentComputation: true,
            childrenNodes: [],
          },
        ],
      };
      try {
        decode(JSON.stringify(wire));
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(JsonDecodeError);
        expect((err as JsonDecodeError).pointer).toBe("/childrenNodes/0/id");
      }
    });

    it("throws with a pointer when a field has the wrong type", () => {
      const wire = {
        nodeType: "BusinessScoreCard",
        id: "root",
        title: "r",
        description: "",
        weight: "not-a-number",
        unit: "%",
        targetValue: 100,
        minimalValue: 0,
        historizedValues: [],
        computed: false,
        eligibleForParentComputation: true,
        childrenNodes: [],
      };
      try {
        decode(JSON.stringify(wire));
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(JsonDecodeError);
        expect((err as JsonDecodeError).pointer).toBe("/weight");
      }
    });

    it("throws with a pointer when nodeType is unknown", () => {
      const wire = { nodeType: "UnknownKind", id: "x", title: "y", description: "", weight: 1, childrenNodes: [] };
      try {
        decode(JSON.stringify(wire));
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(JsonDecodeError);
        expect((err as JsonDecodeError).pointer).toBe("/nodeType");
      }
    });

    it("throws with a pointer when a historized entry's date is not parseable", () => {
      const wire = {
        nodeType: "BusinessScoreCard",
        id: "root",
        title: "r",
        description: "",
        weight: 1,
        unit: "%",
        targetValue: 100,
        minimalValue: 0,
        historizedValues: [{ value: 1, date: "not-a-date" }],
        computed: false,
        eligibleForParentComputation: true,
        childrenNodes: [],
      };
      try {
        decode(JSON.stringify(wire));
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(JsonDecodeError);
        expect((err as JsonDecodeError).pointer).toBe("/historizedValues/0/date");
      }
    });
  });

  describe("encode (TreeNode \u2192 wire)", () => {
    it("emits the BusinessScoreCard wire shape for a BusinessScoreCardNode", () => {
      const tree = decode(JSON.stringify(sampleJson));
      const text = encode(tree);
      const reparsed = JSON.parse(text);
      expect(reparsed).toMatchObject({
        nodeType: "BusinessScoreCard",
        id: "UUID1",
        title: "UUID1 Title",
        weight: 1,
        unit: "%",
        targetValue: 100,
        minimalValue: 0,
        computed: true,
        eligibleForParentComputation: false,
      });
      expect(reparsed.childrenNodes).toHaveLength(3);
    });

    it("omits targetDate when the Objective is open-ended (sentinel)", () => {
      const tree = decode(JSON.stringify(sampleJson));
      const reparsed = JSON.parse(encode(tree));
      expect(reparsed).not.toHaveProperty("targetDate");
    });
  });

  describe("round-trip on examples/test.json (SPEC \u00a712.2)", () => {
    it("decode \u2192 encode \u2192 parse is structurally equal to the original wire object", () => {
      const original = JSON.parse(JSON.stringify(sampleJson));
      const tree = decode(JSON.stringify(sampleJson));
      const reparsed = JSON.parse(encode(tree));
      expect(reparsed).toEqual(original);
    });

    it("encode \u2192 decode \u2192 encode is idempotent (stable text shape)", () => {
      const tree = decode(JSON.stringify(sampleJson));
      const once = encode(tree);
      const twice = encode(decode(once));
      expect(JSON.parse(once)).toEqual(JSON.parse(twice));
    });
  });
});
