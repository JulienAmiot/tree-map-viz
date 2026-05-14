import { describe, expect, it } from "vitest";

import type { Clock } from "../../../../domain/capabilities/Clock.js";
import { BusinessScoreCardV4 } from "../../../../domain/cards/BusinessScoreCardV4.js";
import { Card } from "../../../../domain/cards/Card.js";
import { StrictRangeCard } from "../../../../domain/cards/StrictRangeCard.js";
import { TextCardV4 } from "../../../../domain/cards/TextCardV4.js";
import { BusinessScoreNode } from "../../../../domain/nodes/BusinessScoreNode.js";
import { StrictRangeNode } from "../../../../domain/nodes/StrictRangeNode.js";
import { TextNodeV4 } from "../../../../domain/nodes/TextNodeV4.js";
import { NumericComparator } from "../../../../domain/values/Comparator.js";
import { ObjectiveV4 } from "../../../../domain/values/ObjectiveV4.js";
import { LenientRange, StrictRange } from "../../../../domain/values/Range.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { Weight } from "../../../../domain/values/Weight.js";

const T = (iso: string): Timestamp => Timestamp.of(new Date(iso));
const clk = (iso: string): Clock => ({ now: () => T(iso) });
const weight = Weight.of(1);
const fixedClock = clk("2026-05-10T12:00:00Z");

const buildText = (): TextNodeV4 => new TextNodeV4("t-1", "Title", weight, fixedClock);
const buildBSN = (): BusinessScoreNode<number> =>
  new BusinessScoreNode<number>(
    "b-1",
    "Sales",
    weight,
    "desc",
    fixedClock,
    LenientRange.of(0, 100, NumericComparator.INSTANCE),
    { objective: ObjectiveV4.of(80, T("2026-12-31T00:00:00Z")) },
  );
const buildSRN = (): StrictRangeNode<number> =>
  new StrictRangeNode<number>(
    "s-1",
    "Latency",
    weight,
    "ms",
    fixedClock,
    StrictRange.of(0, 100, NumericComparator.INSTANCE),
  );

describe("Card hierarchy (§17.78 — v4 part 14: visual cards hosting v4 nodes)", () => {
  describe("abstract Card<N extends Node>", () => {
    it("can only be instantiated through a concrete subclass; node + getNode() expose the hosted node", () => {
      const txt = buildText();
      const card = new TextCardV4(txt);
      expect(card).toBeInstanceOf(Card);
      expect(card.node).toBe(txt);
      expect(card.getNode()).toBe(txt);
    });
  });

  describe("TextCardV4 extends Card<TextNodeV4>", () => {
    it("hosts a TextNodeV4 reference-equal to the constructor argument", () => {
      const node = buildText();
      const card = new TextCardV4(node);
      expect(card).toBeInstanceOf(TextCardV4);
      expect(card).toBeInstanceOf(Card);
      expect(card.getNode()).toBe(node);
      expect(card.getNode()).toBeInstanceOf(TextNodeV4);
    });
  });

  describe("BusinessScoreCardV4<T> extends Card<BusinessScoreNode<T>>", () => {
    it("hosts a BusinessScoreNode<T> with full inherited surface accessible through getNode()", () => {
      const node = buildBSN();
      const card = new BusinessScoreCardV4<number>(node);
      expect(card).toBeInstanceOf(BusinessScoreCardV4);
      expect(card).toBeInstanceOf(Card);
      expect(card.getNode()).toBe(node);
      expect(card.getNode()).toBeInstanceOf(BusinessScoreNode);
      expect(card.getNode().objective.value).toBe(80);
    });
  });

  describe("StrictRangeCard<T> extends Card<StrictRangeNode<T>>", () => {
    it("hosts a StrictRangeNode<T> with the strict range accessible through getNode()", () => {
      const node = buildSRN();
      const card = new StrictRangeCard<number>(node);
      expect(card).toBeInstanceOf(StrictRangeCard);
      expect(card).toBeInstanceOf(Card);
      expect(card.getNode()).toBe(node);
      expect(card.getNode()).toBeInstanceOf(StrictRangeNode);
      expect(card.getNode().range.minimalValue).toBe(0);
      expect(card.getNode().range.maximalValue).toBe(100);
    });
  });
});
