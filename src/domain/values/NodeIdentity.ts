import type { Description } from "./Description.js";
import type { Title } from "./Title.js";

export class NodeIdentity {
  private constructor(
    readonly title: Title,
    readonly description: Description,
  ) {}

  static of(title: Title, description: Description): NodeIdentity {
    return new NodeIdentity(title, description);
  }

  equals(other: NodeIdentity): boolean {
    return this.title.equals(other.title) && this.description.equals(other.description);
  }
}
