import type { TreeCodecV4 } from "../../application/ports/TreeCodecV4.js";
import type { Clock } from "../../domain/capabilities/Clock.js";
import { Tree } from "../../domain/Tree.js";
import { v4TreeFromV3Root } from "../../domain/v3Bridge/v4TreeFromV3Root.js";
import type { V3ToV4Options } from "../../domain/v3Bridge/v4NodeFromV3.js";

import { decode as decodeV3 } from "./jsonCodec.js";

/**
 * §17.105 — `TreeCodecV4` decode-side adapter. Composes the v3
 * `jsonCodec.decode` (parses the v3 wire shape stored in
 * `LocalStorageBoardCollectionRepository` today) with the §17.81 +
 * §17.88 v3 → v4 bridge (`v4TreeFromV3Root`) so the produced object
 * is a §17.79 `Tree` ready to feed the v4 services + the §17.91 /
 * §17.104b view-model mapper.
 *
 * **Why compose rather than re-implement**: the §17.81 bridge already
 * encodes every v3 → v4 translation rule that the §17.94 v5 round-7
 * plan codified — including the §17.99c polymorphic resolution that
 * substitutes `ComputedBusinessScoreNode<T>` for any v3 BSC with
 * `computed: true`, the §17.99b `eligibleForParentComputation: false` →
 * `disabled: true` migration, and the §17.100.5 `BusinessScoreCardV4`
 * sidecar build for every BSC with a non-empty `unit`. Re-implementing
 * those rules inside a standalone v4-native walker would duplicate
 * ~250 lines of tested logic and create two seams to keep in sync
 * across future migrations. Composition keeps the codec under 50 lines
 * AND inherits every behavioural fix the bridge ships in subsequent
 * strands automatically — the codec's "first-load translation" claim
 * from the §17.94 plan row is exactly the bridge's contract.
 *
 * **Lifetime**: the v3 `jsonCodec` retires at §17.113 (Phase F
 * deletions). At that point this composition will need to either
 * inline the v3 parser (the wire shape itself doesn't change — only
 * the v3 NODE construction layer goes away) or be retired alongside
 * the v3 codec depending on whether v4-native wire shapes have landed
 * by then. Both paths are acceptable; the choice belongs to the
 * Phase F strand. **§17.106 owns the encode half**; this strand
 * intentionally throws `NotYetImplementedError` on `encode` so the
 * `TreeCodecV4` shape is structurally complete (every method present)
 * without prejudging the encode-side design (v3-wire-compatible vs.
 * v4-native).
 *
 * **Why a factory function**: the codec needs the v3 → v4 bridge's
 * `clock: Clock` (history timestamps re-asof against the same clock
 * the v4 nodes capture) and an optional `V3ToV4Options.overrides`
 * map (the per-id strict-range escape hatch from §17.81). A factory
 * returning a plain object satisfies the `TreeCodecV4` port shape
 * with no class overhead and matches the §17.102 / §17.103 factory
 * convention.
 */
export class JsonCodecV4NotYetImplementedError extends Error {
  constructor(method: string) {
    super(`jsonCodecV4: ${method} is not yet implemented (§17.106 owns the encode path)`);
    this.name = "JsonCodecV4NotYetImplementedError";
  }
}

export function createJsonCodecV4(
  clock: Clock,
  opts: V3ToV4Options = {},
): TreeCodecV4 {
  return {
    decode(text: string): Tree {
      const v3Root = decodeV3(text);
      return v4TreeFromV3Root(v3Root, clock, opts);
    },
    encode(_tree: Tree): string {
      throw new JsonCodecV4NotYetImplementedError("encode");
    },
  };
}
