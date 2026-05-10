import type { Weight } from "../values/Weight.js";
import { Node } from "./Node.js";

/**
 * `ValueNode<T>` — v4 abstract value-bearing node (SPEC §17.72; mirrors
 * `<<abstract>> class ValueNode~T~` in the v4 class diagram). Sits between
 * `Node` and the historizable / ranged subclasses: introduces the value
 * type `T`, the description slot, and the abstract `getValue()` accessor.
 *
 * `getDescription()` is a method (not a JS getter) so subclasses can
 * override polymorphically — `TextNode` is expected to override it to
 * return `getValue()` per SPEC §17.15 (the rendered "description" of a
 * text node IS the value; the underlying description field stays empty).
 * The default impl returns `this._description` verbatim.
 */
export abstract class ValueNode<T> extends Node {
  private _description: string;

  protected constructor(
    id: string,
    title: string,
    weight: Weight,
    description: string,
  ) {
    super(id, title, weight);
    this._description = description;
  }

  getDescription(): string {
    return this._description;
  }

  setDescription(description: string): void {
    this._description = description;
  }

  abstract getValue(): T;
}
