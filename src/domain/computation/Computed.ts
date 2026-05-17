import type { Computation } from "./Computation.js";
import type { ComputationKind } from "./ComputationKind.js";

/**
 * `Computed<T>` — interface marking a value node whose value is auto-derived
 * from its children via a polymorphic `Computation<T>` strategy (SPEC §17.96 /
 * v5 round 7; mirrors `<<interface>> class Computed~T~` in
 * `classDiagramMermaid.v5.mermaid`).
 *
 * Two concrete implementers ship in later strands: `ComputedNode<T>` (§17.97;
 * sibling of `TextNode` / `RangedValueNode` under `HistorizableValueNode<T>`,
 * plain auto-derived value) and `ComputedBusinessScoreNode<T>` (§17.98;
 * extends `BusinessScoreNode<T>`, auto-derived value PLUS range + objective).
 * §17.94 D3 — the enum + the resolved strategy live on the interface (not
 * duplicated on each subclass), so a polymorphic caller can `node.computation
 * .apply(node.children)` regardless of which concrete Computed* shape it
 * holds. The enum is the persisted + UI-facing discriminator; the strategy
 * is the resolved behaviour. Hybrid Strategy + Type-Code pattern: enum
 * drives serialisation + UI dropdown, polymorphism drives behaviour.
 *
 * `setComputationKind(kind)` is the operator-facing mutator — the kiosk UI
 * flips this in real-time and the implementing class re-resolves the strategy
 * via `ComputationRegistry.resolve(kind)` (§17.97 + §17.98 wiring; the
 * interface itself stays runtime-empty per TS's interface erasure).
 */
export interface Computed<T> {
  readonly computationKind: ComputationKind;
  readonly computation: Computation<T>;
  setComputationKind(kind: ComputationKind): void;
}
