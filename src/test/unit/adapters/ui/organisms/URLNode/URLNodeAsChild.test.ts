import type { LitElement } from "lit";
import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/organisms/URLNode/URLNodeAsChild.js";
import { URLNodeAsChild } from "../../../../../../adapters/ui/organisms/URLNode/URLNodeAsChild.js";
import type { URLNodeViewModel } from "../../../../../../adapters/ui/molecules/NodeViewModel.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

function vmWith(opts: Partial<URLNodeViewModel> = {}): URLNodeViewModel {
  return {
    kind: "URLNode",
    id: "url-1",
    title: "Docs",
    url: "https://example.com/docs",
    ...opts,
  } as URLNodeViewModel;
}

/**
 * SPEC §17.120 — wait for the async QR generation to land. The qrcode
 * library's `toString({ type: "svg" })` resolves on the microtask
 * queue, but Lit needs another `updateComplete` cycle to commit the
 * state-driven re-render after the .then callback mutates
 * `qrDataUrl` / `hasError`. We poll for the QR `<img>` or the
 * warning-fill glyph showing up — whichever arrives first ends the
 * wait. The cap (8 ticks) is generous enough that a healthy QR
 * always resolves in 2-3 ticks while still failing fast in CI on a
 * stuck library.
 */
async function waitForQRSettled(el: LitElement, maxTicks = 8): Promise<void> {
  for (let i = 0; i < maxTicks; i++) {
    await el.updateComplete;
    const sr = el.shadowRoot;
    if (
      sr?.querySelector('[data-testid="qr-image"]') ||
      sr?.querySelector('[data-testid="warning-fill"]')
    ) {
      return;
    }
    await Promise.resolve();
  }
}

/**
 * SPEC §17.120 — payload guaranteed to overflow the qrcode library's
 * max bit-density at every error-correction level. 10,000 characters
 * trips "The amount of data is too big to be stored in a QR Code"
 * deterministically against the real `qrcode` package (max payload
 * at correction level L is ~7,089 alphanumeric chars; at our
 * configured M it's substantially less). Using the real library's
 * own rejection path keeps the failure test free of vi.mock
 * gymnastics and lets us assert the exact same code path a real
 * operator entering an oversized URL would trigger.
 */
const OVERSIZED_URL = "a".repeat(10000);

/**
 * SPEC §17.120 — `<url-node-as-child>` unit tests.
 *
 * The child role for a URL node is intentionally minimal: title row
 * + a QR-code `<img>` that fills the value-area with `object-fit:
 * contain` (vs §17.119 PictureNode's `cover` — the strand divergence
 * the operator explicitly called out), with the §17.44
 * `warning-fill` glyph as the QR-generation-failure fallback. No
 * timestamp, no description, no inline-edit affordance — that's all
 * parent-role surface.
 */
describe("<url-node-as-child>", () => {
  it("\u00a717.121i \u2014 a disabled VM prepends a `.disabled-indicator` forbidden-sign glyph at the LEFT of the title; an enabled VM emits nothing (no strike, no value-area dim)", async () => {
    const enabled = await mountLitElement<URLNodeAsChild>("url-node-as-child", (e) => { e.vm = vmWith(); });
    expect(enabled.shadowRoot?.querySelector('[data-testid="disabled-indicator"]')).toBeNull();
    expect(enabled.shadowRoot?.querySelector('[data-testid="value-row"]')?.hasAttribute("data-disabled")).toBe(false);
    const off = await mountLitElement<URLNodeAsChild>("url-node-as-child", (e) => { e.vm = vmWith({ disabled: true }); });
    const title = off.shadowRoot?.querySelector('[data-testid="title"]');
    const indicator = title?.firstElementChild as HTMLElement | null;
    expect(indicator?.getAttribute("data-testid")).toBe("disabled-indicator");
    expect(indicator?.tagName).toBe("SPAN");
    expect(indicator?.children.length).toBe(0);
    expect(off.shadowRoot?.querySelector('[data-testid="value-row"]')?.hasAttribute("data-disabled")).toBe(false);
  });

  it("\u00a717.121j \u2014 reserves the shared `.subtitle` slot (empty) so the QR area lands at the same y-offset as the rest of the tile wall", async () => {
    const el = await mountLitElement<URLNodeAsChild>("url-node-as-child", (e) => { e.vm = vmWith(); });
    const subtitle = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="subtitle"]');
    expect(subtitle).not.toBeNull();
    expect(subtitle?.textContent?.trim()).toBe("");
  });

  it("renders the title with the URLNode view-kind tag", async () => {
    const el = await mountLitElement<URLNodeAsChild>(
      "url-node-as-child",
      (e) => {
        e.vm = vmWith({ id: "uuid-x", title: "Region map" });
      },
    );
    const title = el.shadowRoot?.querySelector('[data-testid="title"]');
    expect(title?.textContent?.trim()).toBe("Region map");
    expect(title?.getAttribute("data-view-kind")).toBe("URLNode");
    expect(title?.getAttribute("data-id")).toBe("uuid-x");
  });

  it("renders a QR-code <img> sized to fill the value-area with the VM's URL encoded + contain sizing (operator's §17.120 contract: 'displays a QR code on the card (css rule for object fit: contain)')", async () => {
    const el = await mountLitElement<URLNodeAsChild>(
      "url-node-as-child",
      (e) => {
        e.vm = vmWith({
          url: "https://example.com/docs",
          title: "Docs",
        });
      },
    );
    await waitForQRSettled(el);

    const img = el.shadowRoot?.querySelector<HTMLImageElement>(
      '[data-testid="qr-image"]',
    );
    expect(img).not.toBeNull();
    // SPEC §17.120 — QR image is a data: URL (SVG, encoded inline);
    // never the raw URL the operator entered. The actual data: prefix
    // is what we pin, because the SVG payload is library-version
    // dependent but the *scheme* is part of the contract (lets the
    // view layer drop it straight into <img src=>).
    const src = img?.getAttribute("src") ?? "";
    expect(src.startsWith("data:image/svg+xml")).toBe(true);
    // SPEC §17.120 — the original URL must NOT leak into the <img
    // src=> as a plain string (otherwise the browser would try to
    // load the URL itself rather than display the QR code). Pinning
    // this protects against a future refactor that accidentally
    // bypasses the generator.
    expect(src).not.toBe("https://example.com/docs");
    expect(img?.getAttribute("alt")).toBe("Docs");
    expect(img?.getAttribute("data-value-kind")).toBe("url");

    // The operator's core requirement — pin the literal CSS rule so a
    // future refactor that drops `object-fit: contain` (or flips it
    // to cover, e.g. by accidentally copy-pasting from PictureNode)
    // fails fast at test-time.
    const cssText = (URLNodeAsChild.styles as readonly { cssText?: string }[])
      .map((s) => String(s.cssText ?? s))
      .join("\n");
    expect(cssText).toMatch(/\.qr-img\s*\{[\s\S]*?object-fit:\s*contain/);
    expect(cssText).toMatch(/\.qr-img\s*\{[\s\S]*?width:\s*100%/);
    expect(cssText).toMatch(/\.qr-img\s*\{[\s\S]*?height:\s*100%/);
    // SPEC §17.120 — verify the strand divergence vs §17.119
    // PictureNode: this view MUST NOT use object-fit: cover (cropping
    // a QR is fatal to scannability).
    expect(cssText).not.toMatch(/object-fit:\s*cover/);
  });

  it("on QR-generation failure (oversized payload), swaps the QR image for the same warning-fill glyph the Computed* / PictureNode tiles use (§17.116 + §17.119 parity)", async () => {
    const el = await mountLitElement<URLNodeAsChild>(
      "url-node-as-child",
      (e) => {
        // SPEC §17.120 — 10k-char URL overflows the qrcode library's
        // max bit-density at every error-correction level, driving
        // the warning-fill code path through the real library
        // rejection (no mocking).
        e.vm = vmWith({ url: OVERSIZED_URL });
      },
    );
    await waitForQRSettled(el);

    expect(
      el.shadowRoot?.querySelector('[data-testid="qr-image"]'),
    ).toBeNull();
    const warning = el.shadowRoot?.querySelector(
      '[data-testid="warning-fill"]',
    );
    expect(warning).not.toBeNull();
    expect(warning?.getAttribute("role")).toBe("img");
    // The shared `.warning-fill` rule from tileLayoutStyles drives
    // the visual; the reason attribute is the stable e2e/A11y hook —
    // distinct from PictureNode's "image-load-failed" so a future
    // fault-debugging test can tell the two strands apart.
    expect(warning?.getAttribute("data-reason")).toBe(
      "qr-generation-failed",
    );
  });

  it("swapping vm.url after a generation failure clears the warning state and retries the QR encoding", async () => {
    const el = await mountLitElement<URLNodeAsChild>(
      "url-node-as-child",
      (e) => {
        e.vm = vmWith({ url: OVERSIZED_URL });
      },
    );
    await waitForQRSettled(el);
    expect(
      el.shadowRoot?.querySelector('[data-testid="warning-fill"]'),
    ).not.toBeNull();

    // SPEC §17.120 — the warning state is NOT sticky across URL
    // edits; the view's willUpdate clears `hasError` whenever
    // `vm.url` changes and kicks off a fresh generation. Replacing
    // the oversized URL with a typical one should land the QR <img>.
    el.vm = vmWith({ url: "https://example.com/works" });
    await waitForQRSettled(el);

    expect(
      el.shadowRoot?.querySelector('[data-testid="warning-fill"]'),
    ).toBeNull();
    const img = el.shadowRoot?.querySelector<HTMLImageElement>(
      '[data-testid="qr-image"]',
    );
    expect(img?.getAttribute("src")?.startsWith("data:image/svg+xml")).toBe(
      true,
    );
  });

  it("does NOT render a timestamp (URLNode is a snapshot leaf, no asOf)", async () => {
    const el = await mountLitElement<URLNodeAsChild>(
      "url-node-as-child",
      (e) => {
        e.vm = vmWith();
      },
    );
    await waitForQRSettled(el);
    expect(
      el.shadowRoot?.querySelector('[data-testid="value-date"]'),
    ).toBeNull();
  });

  it("does NOT render a Σ computed-badge (the URL is not aggregated)", async () => {
    const el = await mountLitElement<URLNodeAsChild>(
      "url-node-as-child",
      (e) => {
        e.vm = vmWith();
      },
    );
    await waitForQRSettled(el);
    expect(
      el.shadowRoot?.querySelector('[data-testid="computed-badge"]'),
    ).toBeNull();
  });

  it("renders nothing meaningful when vm is null (default state pre-bind)", async () => {
    const el = await mountLitElement<URLNodeAsChild>(
      "url-node-as-child",
    );
    expect(el.shadowRoot?.querySelector('[data-testid="title"]')).toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="qr-image"]'),
    ).toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="warning-fill"]'),
    ).toBeNull();
  });

  it("URL change with same value (vm reference changes, vm.url string identical) does NOT trigger a redundant QR regeneration", async () => {
    // SPEC §17.120 — `willUpdate` compares the URL string against
    // `lastUrl`; only a genuinely different URL kicks off a new
    // generation. This avoids gratuitous regeneration when the
    // composition root pushes a fresh VM with the same URL (e.g.
    // after an unrelated parent-level update). We assert by
    // capturing the data: URL the FIRST generation produced, pushing
    // a new VM with the same URL, and verifying the <img src=>
    // doesn't briefly drop back to `nothing` mid-update.
    const el = await mountLitElement<URLNodeAsChild>(
      "url-node-as-child",
      (e) => {
        e.vm = vmWith({ url: "https://example.com/stable" });
      },
    );
    await waitForQRSettled(el);
    const firstSrc = el.shadowRoot
      ?.querySelector<HTMLImageElement>('[data-testid="qr-image"]')
      ?.getAttribute("src");
    expect(firstSrc?.startsWith("data:image/svg+xml")).toBe(true);

    // Push a fresh VM object with the same URL — willUpdate should
    // observe `currentUrl === lastUrl` and NOT clear qrDataUrl.
    el.vm = vmWith({ url: "https://example.com/stable", title: "Renamed" });
    await el.updateComplete;
    // No await for QR regeneration: the QR must still be present
    // synchronously after the single update cycle, because no
    // generation was scheduled. If a regeneration HAD been triggered
    // (the bug we're guarding against), qrDataUrl would have been
    // cleared and the <img> would be missing here.
    const stillSrc = el.shadowRoot
      ?.querySelector<HTMLImageElement>('[data-testid="qr-image"]')
      ?.getAttribute("src");
    expect(stillSrc).toBe(firstSrc);
  });
});
