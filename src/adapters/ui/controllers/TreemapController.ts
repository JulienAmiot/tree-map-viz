/**
 * `TreemapController` — Lit `ReactiveController` that drives the squarified
 * treemap layout for the children grid (SPEC §4 / §12.2 line 343).
 *
 * Owns three things:
 *   - the most recent observed content size of the host element,
 *   - the most recent weights / options requested by the host,
 *   - the resulting rects (one per weight).
 *
 * Two entry points:
 *   - `layout(weights, options?)` — called by the host from its render loop
 *     (e.g. `willUpdate`). Synchronously recomputes rects against the
 *     currently observed content size. Does NOT call `host.requestUpdate`
 *     because the host is already in the middle of a render.
 *   - `onResize(entry)` (private) — fires when the host element resizes.
 *     Re-runs the squarify with the same weights/options, and calls
 *     `host.requestUpdate()` only if the rects actually changed.
 *
 * Lifecycle:
 *   - `hostConnected` subscribes a `ResizeObserver` over the host. The
 *     constructor is injectable for tests.
 *   - `hostDisconnected` disconnects the observer.
 *
 * Initial render under jsdom (or any browser before the first
 * ResizeObserver tick) sees a 0×0 content size, so `rects` is `[]` until
 * the first resize observation. The host should render an empty children
 * grid in that case; the second render (triggered by `requestUpdate`)
 * shows the real layout. On real browsers this happens within a single
 * frame.
 */

import type { ReactiveController, ReactiveControllerHost } from "lit";

import { layoutSquarified } from "../../../domain/treemapSquarify.js";

export type TreemapRect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export type TreemapOptions = {
  readonly aspectRatio?: number;
  readonly padding?: number;
};

export type ResizeObserverConstructor = new (callback: ResizeObserverCallback) => ResizeObserver;

export class TreemapController implements ReactiveController {
  /** Most recently computed rects. Read by the host during `render`. */
  rects: readonly TreemapRect[] = [];

  private readonly host: ReactiveControllerHost & Element;
  private readonly Observer: ResizeObserverConstructor | undefined;
  private observer: ResizeObserver | null = null;
  private weights: readonly number[] = [];
  private options: TreemapOptions = {};
  private contentSize = { width: 0, height: 0 };

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

  /**
   * Recompute rects against the current observed content size and the
   * given weights/options. Idempotent. Returns the freshly computed rects
   * (same reference as `this.rects` after the call).
   */
  layout(
    weights: readonly number[],
    options: TreemapOptions = {},
  ): readonly TreemapRect[] {
    this.weights = weights;
    this.options = options;
    this.rects = layoutSquarified(
      weights.slice(),
      this.contentSize.width,
      this.contentSize.height,
      options,
    );
    return this.rects;
  }

  private onResize(entries: ResizeObserverEntry[]): void {
    for (const entry of entries) {
      if (entry.target !== this.host) continue;
      const { width, height } = entry.contentRect;
      if (width === this.contentSize.width && height === this.contentSize.height) {
        continue;
      }
      this.contentSize = { width, height };
      const next = layoutSquarified(
        this.weights.slice(),
        width,
        height,
        this.options,
      );
      if (!rectsEqual(this.rects, next)) {
        this.rects = next;
        this.host.requestUpdate();
      }
    }
  }
}

function rectsEqual(
  a: readonly TreemapRect[],
  b: readonly TreemapRect[],
  eps = 0.5,
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ra = a[i]!;
    const rb = b[i]!;
    if (Math.abs(ra.x - rb.x) > eps) return false;
    if (Math.abs(ra.y - rb.y) > eps) return false;
    if (Math.abs(ra.w - rb.w) > eps) return false;
    if (Math.abs(ra.h - rb.h) > eps) return false;
  }
  return true;
}
