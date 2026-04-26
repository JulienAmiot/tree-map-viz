import type { TreeNode } from "../domain/nodes/TreeNode.js";

import type { TreeCodec } from "./ports/TreeCodec.js";

type ImportOutcome = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * Application service: serialise the current board's tree to a string
 * (export) and replace the current board's tree from a string (import).
 *
 * The validate-before-replace contract is enforced by ordering: the codec
 * decodes (and throws on malformed input) FIRST; only on a successful
 * decode does the service call `replaceCurrentTree`. A failing decode
 * leaves the current tree untouched.
 *
 * The service is decoupled from the board collection: it consumes
 * `getCurrentTree` and `replaceCurrentTree` callables wired by the
 * composition root, so it doesn't need to know about boards, ids, or
 * persistence layout.
 */
export class ImportExportService {
  constructor(
    private readonly codec: TreeCodec,
    private readonly getCurrentTree: () => TreeNode<unknown>,
    private readonly replaceCurrentTree: (tree: TreeNode<unknown>) => Promise<void>,
  ) {}

  exportCurrentTree(): string {
    return this.codec.encode(this.getCurrentTree());
  }

  async importIntoCurrentBoard(text: string): Promise<ImportOutcome> {
    let decoded: TreeNode<unknown>;
    try {
      decoded = this.codec.decode(text);
    } catch (err) {
      return { ok: false, reason: ImportExportService.errorReason(err) };
    }
    try {
      await this.replaceCurrentTree(decoded);
    } catch (err) {
      return { ok: false, reason: ImportExportService.errorReason(err) };
    }
    return { ok: true };
  }

  private static errorReason(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }
}
