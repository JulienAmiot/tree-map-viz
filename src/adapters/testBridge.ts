/**
 * Test bridge — the only file in `src/` that knows e2e tests exist (SPEC §14.4).
 *
 * Surface contract:
 *  - Activation gate: caller MUST only invoke `installTestBridge` when
 *    `new URL(location.href).searchParams.get("test") === "1"`. The bridge
 *    itself does not read the URL — main.ts owns the gate so the module is
 *    tree-shaken out of the production bundle (`await import(...)` chunk).
 *  - JSON-only API: no domain types ever cross `window.__appTestApi__`.
 *  - Goes through public ports only (`BoardCollectionRepository`, `TreeCodec`,
 *    `Router`); never reaches into `TreeNode`, `BusinessScoreCard`, …
 *  - Hard cap ~80 lines (SPEC §14.4). Anything growing larger is a smell —
 *    we're using the bridge as a feature backdoor instead of a test seam.
 */

import type { BoardCollectionRepository } from "../application/ports/BoardCollectionRepository.js";
import type { Router } from "../application/ports/Router.js";
import type { TreeCodec } from "../application/ports/TreeCodec.js";
import { DEFAULT_WORKFLOW_STATUSES } from "../domain/values/WorkflowStatus.js";

/** Public JSON-only API exposed on `window.__appTestApi__`. See SPEC §14.4. */
export interface TestApi {
  /** Wipe persisted state and load a tree from JSON; the page must reload to pick it up. */
  seed(json: unknown): Promise<void>;
  /** Currently focused node uuid as parsed from `window.location.hash`; empty string if none. */
  currentFocusUuid(): string;
  /** Currently focused board id as parsed from `window.location.hash`; empty string if none. */
  currentBoardId(): string;
  /** Set the URL/hash; resolves after one animation frame so reactive updates have settled. */
  navigateTo(url: string): Promise<void>;
  /** Mark the document so the view layer treats it as `prefers-reduced-motion: reduce`. */
  dismissAnimations(): void;
}

export type TestBridgeDeps = {
  readonly repo: BoardCollectionRepository;
  readonly codec: TreeCodec;
  readonly router: Router;
};

/** Stable id used for the single "test" board the bridge seeds. */
const TEST_BOARD_ID = "test-board";

/** CSS class added on `<html>` by `dismissAnimations` so view templates can opt into reduce motion. */
export const TEST_NO_ANIM_CLASS = "test-no-anim";

/**
 * Install the bridge onto the given window. Idempotent — re-installing
 * replaces the previous facade, which is convenient when seeding across
 * multiple Playwright fixtures.
 */
export function installTestBridge(target: Window & typeof globalThis, deps: TestBridgeDeps): void {
  const { repo, codec, router } = deps;

  const api: TestApi = {
    async seed(json) {
      const text = typeof json === "string" ? json : JSON.stringify(json);
      const tree = codec.decode(text);
      await repo.save({
        boards: [
          {
            id: TEST_BOARD_ID,
            name: "Test board",
            tree,
            // SPEC §17.118 -- seed the test board with the PDCA defaults so
            // workflow-card scenarios get a working status table out of the
            // gate. E2E fixtures that need a custom catalogue can re-seed
            // through the bridge once the board-settings UI lands.
            workflowStatuses: DEFAULT_WORKFLOW_STATUSES,
          },
        ],
        currentBoardId: TEST_BOARD_ID,
      });
    },
    currentFocusUuid: () => router.current()?.focusNodeUuid ?? "",
    currentBoardId: () => router.current()?.boardId ?? "",
    async navigateTo(url) {
      const hashIdx = url.indexOf("#");
      target.location.hash = hashIdx >= 0 ? url.slice(hashIdx) : url;
      await new Promise<void>((resolve) =>
        target.requestAnimationFrame(() => resolve()),
      );
    },
    dismissAnimations: () => {
      target.document.documentElement.classList.add(TEST_NO_ANIM_CLASS);
    },
  };

  Object.defineProperty(target, "__appTestApi__", {
    value: Object.freeze(api),
    configurable: true,
    writable: false,
  });
}

declare global {
  interface Window {
    __appTestApi__?: TestApi;
  }
}
