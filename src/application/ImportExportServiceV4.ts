import type { Tree } from "../domain/Tree.js";

import type { TreeCodecV4 } from "./ports/TreeCodecV4.js";

type ImportOutcome = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * v4 successor to `ImportExportService` (SPEC §17.103). Same
 * validate-before-replace contract, same callable-decoupling from the
 * board collection — just typed against the §17.79 `Tree` container
 * instead of v3's `TreeNode<unknown>` aggregate via the §17.103
 * `TreeCodecV4` port.
 *
 * Parallel-additive per §17.94 Phase C. v3 stays live in `main.ts`
 * until §17.110 Phase E cutover; the concrete codec adapter
 * (`jsonCodecV4`) lands at §17.105 + §17.106.
 */
export class ImportExportServiceV4 {
  constructor(
    private readonly codec: TreeCodecV4,
    private readonly getCurrentTree: () => Tree,
    private readonly replaceCurrentTree: (tree: Tree) => Promise<void>,
  ) {}

  exportCurrentTree(): string {
    return this.codec.encode(this.getCurrentTree());
  }

  async importIntoCurrentBoard(text: string): Promise<ImportOutcome> {
    let decoded: Tree;
    try { decoded = this.codec.decode(text); }
    catch (err) { return { ok: false, reason: ImportExportServiceV4.errorReason(err) }; }
    try { await this.replaceCurrentTree(decoded); }
    catch (err) { return { ok: false, reason: ImportExportServiceV4.errorReason(err) }; }
    return { ok: true };
  }

  private static errorReason(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
