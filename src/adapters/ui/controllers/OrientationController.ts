/**
 * `OrientationController` — Lit `ReactiveController` that tracks the host
 * element's orientation as `'landscape' | 'portrait'` (SPEC §4 / §12.2 line 344).
 *
 * Subscribes a `ResizeObserver` over the host on `hostConnected` and reads
 * dimensions from `ResizeObserverEntry.contentRect` (avoids forced reflow).
 * Disconnects on `hostDisconnected`.
 *
 * `'landscape' | 'portrait'` is derived from `width >= height`. Square-tie
 * defaults to `'landscape'` to match the kiosk's at-rest pose (§4 — 16/9).
 *
 * Calls `host.requestUpdate()` only when the orientation **flips**, so
 * unrelated resizes don't force the host to re-render.
 *
 * The `ResizeObserver` constructor is injectable (default = `globalThis.ResizeObserver`)
 * so unit tests can drive the callback synchronously through a fake — see
 * `src/test/fixtures/fakeResizeObserver.ts`.
 */

import type { ReactiveController, ReactiveControllerHost } from "lit";

export type Orientation = "landscape" | "portrait";

export type ResizeObserverConstructor = new (callback: ResizeObserverCallback) => ResizeObserver;

export class OrientationController implements ReactiveController {
  /** Current orientation derived from the host's content rect. */
  orientation: Orientation = "landscape";

  private readonly host: ReactiveControllerHost & Element;
  private readonly Observer: ResizeObserverConstructor | undefined;
  private observer: ResizeObserver | null = null;

  constructor(
    host: ReactiveControllerHost & Element,
    observerCtor?: ResizeObserverConstructor,
  ) {
    this.host = host;
    this.Observer =
      observerCtor ??
      (globalThis as { ResizeObserver?: ResizeObserverConstructor }).ResizeObserver;
    host.addController(this);
  }

  hostConnected(): void {
    if (!this.Observer) return;
    this.observer = new this.Observer((entries) => this.onResize(entries));
    this.observer.observe(this.host);
  }

  hostDisconnected(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private onResize(entries: ResizeObserverEntry[]): void {
    for (const entry of entries) {
      if (entry.target !== this.host) continue;
      const { width, height } = entry.contentRect;
      const next: Orientation = width >= height ? "landscape" : "portrait";
      if (next !== this.orientation) {
        this.orientation = next;
        this.host.requestUpdate();
      }
    }
  }
}
