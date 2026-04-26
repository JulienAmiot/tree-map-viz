import type { TreeNode } from "../../domain/nodes/TreeNode.js";

/**
 * Application port: encode/decode of a tree to/from a string wire format.
 *
 * The concrete adapter today is `src/adapters/persistence/jsonCodec.ts`
 * which speaks the JSON shape from `examples/test.json` and reports
 * decode errors with RFC-6901 JSON pointers. Future adapters could
 * speak YAML, Protobuf, etc., without touching application services.
 *
 * Decoders MUST throw a typed error on malformed / structurally invalid
 * input — `ImportExportService` relies on the throw/no-throw contract
 * to validate before replacing the current board.
 */
export interface TreeCodec {
  encode(tree: TreeNode<unknown>): string;
  decode(text: string): TreeNode<unknown>;
}
