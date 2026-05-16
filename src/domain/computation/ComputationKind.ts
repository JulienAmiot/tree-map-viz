/**
 * `ComputationKind` — persisted + UI-facing enum for the `Computation<T>`
 * strategy hierarchy (SPEC §17.95 / v5 round 7; §17.94 D2 — six inhabitants).
 * Class-with-singletons shape matches §17.66 `Direction` / §17.68 `Comparator`:
 * private ctor + `static readonly` inhabitants; reference equality (`===`) IS
 * value equality. `fromName` landed at §17.106b (`jsonCodecV4` decoder
 * rewrite needs to round-trip the persisted `name` string back to the
 * canonical singleton).
 */
export class ComputationKind {
  private constructor(readonly name: string) {}

  static readonly SUM = new ComputationKind("SUM");
  static readonly AVERAGE = new ComputationKind("AVERAGE");
  static readonly MIN = new ComputationKind("MIN");
  static readonly MAX = new ComputationKind("MAX");
  static readonly WEIGHTED_AVERAGE = new ComputationKind("WEIGHTED_AVERAGE");
  static readonly COUNT = new ComputationKind("COUNT");

  static readonly ALL: readonly ComputationKind[] = Object.freeze([
    ComputationKind.SUM,
    ComputationKind.AVERAGE,
    ComputationKind.MIN,
    ComputationKind.MAX,
    ComputationKind.WEIGHTED_AVERAGE,
    ComputationKind.COUNT,
  ]);

  /**
   * Resolve a `name` string back to its canonical singleton. Returns
   * `undefined` when the name is not one of the six inhabitants — codec
   * decoders surface that as a typed JSON-pointer error rather than
   * silently falling back to a default kind. Reference equality with the
   * `static readonly` slots holds (`fromName("SUM") === ComputationKind.SUM`).
   */
  static fromName(name: string): ComputationKind | undefined {
    return ComputationKind.ALL.find((kind) => kind.name === name);
  }
}
