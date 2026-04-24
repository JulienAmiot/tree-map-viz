import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Node } from "../../domain/Node.js";
import { BusinessScoreCard } from "../../domain/BusinessScoreCard.js";
import { NodeCard } from "./NodeCard.js";
import { colorForScorecardFigure } from "./scorecardFigureColor.js";

describe("NodeCard", () => {
  it("renders base node fields", () => {
    const n = new Node("a", "Title A", "Hello", 42, "kg", new Date("2026-01-01T12:00:00Z"), []);
    render(<NodeCard node={n} variant="center" />);
    expect(screen.getByText("Title A")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByLabelText("Figure")).toHaveTextContent(/42/);
  });

  it("renders BusinessScoreCard extra fields", () => {
    const b = new BusinessScoreCard(
      "b",
      "SC",
      "",
      10,
      "%",
      new Date("2026-01-01"),
      new Date("2026-02-01"),
      5,
      20,
      [],
    );
    render(<NodeCard node={b} variant="child" />);
    expect(screen.getByText("Score card")).toBeInTheDocument();
    expect(screen.getByText("Min")).toBeInTheDocument();
    expect(screen.getByText("Target")).toBeInTheDocument();
    const figureEl = screen.getByLabelText("Figure");
    expect(figureEl).toHaveStyle({ color: colorForScorecardFigure(10, 5, 20) });
  });
});
