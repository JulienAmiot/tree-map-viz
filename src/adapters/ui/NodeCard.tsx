import type { Node } from "../../domain/Node.js";
import { isBusinessScoreCard } from "../../domain/guards.js";
import { colorForScorecardFigure } from "./scorecardFigureColor.js";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

type Props = {
  node: Node;
  variant: "center" | "child";
  onActivate?: () => void;
  /** Merged for drill / layout modifiers (e.g. `node-card--picking`). */
  className?: string;
};

export function NodeCard({ node, variant, onActivate, className: extraClass }: Props) {
  const isActionable = Boolean(onActivate);
  const figureText =
    node.figure !== null
      ? `${new Intl.NumberFormat().format(node.figure)}${node.unit ? ` ${node.unit}` : ""}`
      : "—";

  const className = [
    "node-card",
    `node-card--${variant}`,
    isActionable ? "node-card--interactive" : "",
    extraClass,
  ]
    .filter(Boolean)
    .join(" ");

  const scoreFigureColor =
    isBusinessScoreCard(node) && node.figure !== null
      ? colorForScorecardFigure(node.figure, node.minimalValue, node.targetValue)
      : undefined;

  const content = (
    <>
      <header className="node-card__head">
        <h2 className="node-card__title">{node.title}</h2>
        {isBusinessScoreCard(node) && <span className="node-card__chip">Score card</span>}
      </header>
      {node.description ? <p className="node-card__desc">{node.description}</p> : null}
      <div
        className="node-card__figure"
        style={scoreFigureColor ? { color: scoreFigureColor } : undefined}
        aria-label="Figure"
      >
        {figureText}
      </div>
      <p className="node-card__meta">Updated {dateFmt.format(node.timestamp)}</p>
      {isBusinessScoreCard(node) && (
        <ul className="node-card__extra">
          <li>
            <span>Due</span> {dateFmt.format(node.dueDate)}
          </li>
          <li>
            <span>Min</span> {new Intl.NumberFormat().format(node.minimalValue)}
          </li>
          <li>
            <span>Target</span> {new Intl.NumberFormat().format(node.targetValue)}
          </li>
        </ul>
      )}
    </>
  );

  if (onActivate) {
    return (
      <button
        type="button"
        className={className}
        onClick={onActivate}
        aria-label={`Open ${node.title}`}
      >
        {content}
      </button>
    );
  }

  return (
    <article className={className} role="group" aria-label={node.title}>
      {content}
    </article>
  );
}
