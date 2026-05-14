import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../adapters/ui/shell/VersionMismatchBanner.js";
import {
  VERSION_MISMATCH_CONTINUE_READ_ONLY_EVENT,
  VERSION_MISMATCH_DISMISS_EVENT,
  VERSION_MISMATCH_RESET_EVENT,
  type VersionMismatchBanner,
} from "../../../../../adapters/ui/shell/VersionMismatchBanner.js";
import type { VersionMismatchInfo } from "../../../../../adapters/persistence/LocalStorageBoardCollectionRepository.js";
import { cleanupLitFixtures, mountLitElement } from "../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

const FUTURE: VersionMismatchInfo = { kind: "future-data", persistedMajor: 2, runningMajor: 1 };
const FAILED: VersionMismatchInfo = { kind: "migration-failed", persistedMajor: 0, runningMajor: 1 };

function bannerOf(el: VersionMismatchBanner): HTMLElement | null {
  return el.shadowRoot?.querySelector<HTMLElement>("[data-testid='version-mismatch-banner']") ?? null;
}
function btn(el: VersionMismatchBanner, id: string): HTMLButtonElement {
  const b = el.shadowRoot?.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);
  if (!b) throw new Error(`expected <button> [${id}]`);
  return b;
}

describe("<version-mismatch-banner> (\u00a717.86b)", () => {
  it("renders nothing when info is null", async () => {
    const el = await mountLitElement<VersionMismatchBanner>("version-mismatch-banner");
    expect(bannerOf(el)).toBeNull();
  });

  it("renders kind-specific copy + data-kind for future-data and migration-failed", async () => {
    const a = await mountLitElement<VersionMismatchBanner>("version-mismatch-banner", (e) => { e.info = FUTURE; });
    expect(bannerOf(a)!.dataset.kind).toBe("future-data");
    expect(bannerOf(a)!.textContent).toMatch(/newer version \(v2\).*runs v1.*fresh seed/s);
    const b = await mountLitElement<VersionMismatchBanner>("version-mismatch-banner", (e) => { e.info = FAILED; });
    expect(bannerOf(b)!.dataset.kind).toBe("migration-failed");
    expect(bannerOf(b)!.textContent).toMatch(/older version \(v0\).*runs v1.*saves may corrupt/s);
  });

  it("each of the three buttons dispatches its own bubbling+composed CustomEvent", async () => {
    const el = await mountLitElement<VersionMismatchBanner>("version-mismatch-banner", (e) => { e.info = FAILED; });
    const cases: Array<[string, string]> = [
      [VERSION_MISMATCH_CONTINUE_READ_ONLY_EVENT, "version-mismatch-continue-read-only"],
      [VERSION_MISMATCH_RESET_EVENT, "version-mismatch-reset"],
      [VERSION_MISMATCH_DISMISS_EVENT, "version-mismatch-dismiss"],
    ];
    for (const [evt, testid] of cases) {
      const h = vi.fn();
      el.addEventListener(evt, h);
      btn(el, testid).click();
      expect(h).toHaveBeenCalledTimes(1);
      const e = h.mock.calls[0]?.[0] as CustomEvent;
      expect(e.bubbles).toBe(true);
      expect(e.composed).toBe(true);
    }
  });
});
