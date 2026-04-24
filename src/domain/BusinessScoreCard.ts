import { Node } from "./Node.js";

/**
 * Business score card: extends {@link Node} with planning and target bounds.
 */
export class BusinessScoreCard extends Node {
  dueDate: Date;
  minimalValue: number;
  targetValue: number;

  constructor(
    id: string,
    title: string,
    description: string,
    figure: number | null,
    unit: string,
    timestamp: Date,
    dueDate: Date,
    minimalValue: number,
    targetValue: number,
    children: Node[] = [],
  ) {
    super(id, title, description, figure, unit, timestamp, children);
    this.dueDate = dueDate;
    this.minimalValue = minimalValue;
    this.targetValue = targetValue;
  }
}
