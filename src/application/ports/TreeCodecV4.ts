import type { Tree } from "../../domain/Tree.js";

/**
 * v4 successor to `TreeCodec` (SPEC §17.103). Encodes/decodes the
 * §17.79 `Tree` container (root + §17.100.5 cards sidecar) instead
 * of the v3 `TreeNode<unknown>` aggregate.
 *
 * Parallel-additive to the v3 `TreeCodec` port — v3 stays live in
 * `main.ts` until §17.110 Phase E cutover. The concrete adapter
 * (`jsonCodecV4`) lands at §17.105 (decode) + §17.106 (encode); this
 * port establishes the shape so §17.103 `ImportExportServiceV4` and
 * §17.102 `BoardCollectionServiceV4` can wire together without
 * blocking on the codec migration.
 *
 * Same throw/no-throw contract as v3: decoders MUST throw a typed
 * error on malformed or structurally invalid input, so the service's
 * validate-before-replace ordering survives unchanged.
 */
export interface TreeCodecV4 {
  encode(tree: Tree): string;
  decode(text: string): Tree;
}
