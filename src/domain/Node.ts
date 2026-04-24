/**
 * Base node for tree visualization. Subclasses add fields for specific representations.
 */
export class Node {
  readonly id: string;
  title: string;
  description: string;
  /** Quantitative value shown on the card (e.g. KPI). */
  figure: number | null;
  unit: string;
  /** When the value was last updated. */
  timestamp: Date;
  children: Node[];

  constructor(
    id: string,
    title: string,
    description: string,
    figure: number | null,
    unit: string,
    timestamp: Date,
    children: Node[] = [],
  ) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.figure = figure;
    this.unit = unit;
    this.timestamp = timestamp;
    this.children = children;
  }
}
