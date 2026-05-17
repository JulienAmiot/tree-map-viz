import { describe, expect, it } from "vitest";

import type { Clock } from "../../../../domain/capabilities/Clock.js";
import { BusinessScoreCard } from "../../../../domain/cards/BusinessScoreCard.js";
import { Card } from "../../../../domain/cards/Card.js";
import { StrictRangeCard } from "../../../../domain/cards/StrictRangeCard.js";
import { TextCard } from "../../../../domain/cards/TextCard.js";
import { BusinessScoreNode } from "../../../../domain/nodes/BusinessScoreNode.js";
import { StrictRangeNode } from "../../../../domain/nodes/StrictRangeNode.js";
import { TextNode } from "../../../../domain/nodes/TextNode.js";
import { NumericComparator } from "../../../../domain/values/Comparator.js";
import { Objective } from "../../../../domain/values/Objective.js";
import { LenientRange, StrictRange } from "../../../../domain/values/Range.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { Unit } from "../../../../domain/values/Unit.js";
import { Weight } from "../../../../domain/values/Weight.js";

const T = (iso: string): Timestamp => Timestamp.of(new Date(iso));
const clk = (iso: string): Clock => ({ now: () => T(iso) });
const weight = Weight.of(1);
const fixedClock = clk("2026-05-10T12:00:00Z");

const buildText = (): TextNode => new TextNode("t-1", "Title", weight, fixedClock);
const buildBSN = (): BusinessScoreNode<number> =>
  new BusinessScoreNode<number>(
    "b-1",
    "Sales",
    weight,
    "desc",
    fixedClock,
    LenientRange.of(0, 100, NumericComparator.INSTANCE),
    { objective: Objective.of(80, T("2026-12-31T00:00:00Z")) },
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
      const card = new TextCard(txt);
      expect(card).toBeInstanceOf(Card);
      expect(card.node).toBe(txt);
      expect(card.getNode()).toBe(txt);
    });
  });

  describe("TextCard extends Card<TextNode>", () => {
    it("hosts a TextNode reference-equal to the constructor argument", () => {
      const node = buildText();
      const card = new TextCard(node);
      expect(card).toBeInstanceOf(TextCard);
      expect(card).toBeInstanceOf(Card);
      expect(card.getNode()).toBe(node);
      expect(card.getNode()).toBeInstanceOf(TextNode);
    });
  });

  describe("BusinessScoreCard<T> extends Card<BusinessScoreNode<T>>", () => {
    it("hosts a BusinessScoreNode<T> + unit Unit VO accessible via getNode() and getUnit() (§17.100.5)", () => {
      const node = buildBSN();
      const unit = Unit.of("%");
      const card = new BusinessScoreCard<number>(node, unit);
      expect(card).toBeInstanceOf(BusinessScoreCard);
      expect(card).toBeInstanceOf(Card);
      expect(card.getNode()).toBe(node);
      expect(card.getNode()).toBeInstanceOf(BusinessScoreNode);
      expect(card.getNode().objective.value).toBe(80);
      expect(card.unit).toBe(unit);
      expect(card.getUnit()).toBe(unit);
      expect(card.getUnit().value).toBe("%");
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
