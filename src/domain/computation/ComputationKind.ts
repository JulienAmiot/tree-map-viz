/**
 * `ComputationKind` — enumerated discriminator for the `Computation<T>`
 * strategy hierarchy (SPEC §17.95 / v5 round 7; mirrors
 * `<<enumeration>> class ComputationKind` in `classDiagramMermaid.v5.mermaid`).
 *
 * Six inhabitants: `SUM | AVERAGE | MIN | MAX | WEIGHTED_AVERAGE | COUNT`
 * (§17.94 decision D2 — the operator's full set, even though only AVERAGE
 * had a v3 implementation behind it; the polymorphic strategy hierarchy is
 * open-closed so landing the full enum at design time avoids the
 * "we'll add it later" trap).
 *
 * Class-with-singletons shape, same as `Direction` (§17.67) and
 * `Comparator<T>` (§17.68): private constructor + `static readonly`
 * inhabitants; reference equality (`===`) IS value equality. The `name`
 * field is the persisted wire-form discriminator + the UI dropdown label.
 *
 * Two downstream consumers (in later strands):
 *  - `ComputationRegistry.resolve(kind)` (§17.95) maps a `ComputationKind`
 *    to its `Computation<T>` singleton.
 *  - `Computed<T>.computationKind` (§17.96) exposes the operator-editable
 *    enum on `ComputedNode<T>` + `ComputedBusinessScoreNode<T>` (§17.97 /
 *    §17.98).
 */
export class ComputationKind {
  private constructor(readonly name: string) {}

  static readonly SUM = new ComputationKind("SUM");
  static readonly AVERAGE = new ComputationKind("AVERAGE");
  static readonly MIN = new ComputationKind("MIN");
  static readonly MAX = new ComputationKind("MAX");
  static readonly WEIGHTED_AVERAGE = new ComputationKind("WEIGHTED_AVERAGE");
  static readonly COUNT = new ComputationKind("COUNT");

  /** Stable enumeration of all inhabitants (UI dropdown source of truth). */
  static readonly ALL: readonly ComputationKind[] = Object.freeze([
    ComputationKind.SUM,
    ComputationKind.AVERAGE,
    ComputationKind.MIN,
    ComputationKind.MAX,
    ComputationKind.WEIGHTED_AVERAGE,
    ComputationKind.COUNT,
  ]);

  /** Parse a wire-format / UI-form name back into a singleton; `undefined`
   * on unknown input so the caller chooses the recovery (default kind,
   * surface error, refuse to load, …). */
  static fromName(name: string): ComputationKind | undefined {
    return ComputationKind.ALL.find((k) => k.name === name);
  }
}
