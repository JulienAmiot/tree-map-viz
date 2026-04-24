import { BusinessScoreCard } from "./BusinessScoreCard.js";
import type { Node } from "./Node.js";

export function isBusinessScoreCard(node: Node): node is BusinessScoreCard {
  return node instanceof BusinessScoreCard;
}
