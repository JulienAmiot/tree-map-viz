/**
 * Hand-rolled `ResizeObserver` test double for unit tests under jsdom.
 *
 * Why this exists:
 *   - jsdom does not implement `ResizeObserver`. `src/test/setup.ts` installs
 *     a no-op global stub so `new ResizeObserver(cb)` doesn't throw, but
 *     that stub never fires the callback, so any controller-under-test that
 *     reacts to resizes would be untested.
 *   - Tests that need to drive resize events inject this class through the
 *     controller's optional `observerCtor` parameter, leaving the global
 *     stub in place for code paths that don't care.
 *
 * Lifecycle bookkeeping (`observeCalls`, `unobserveCalls`, `disconnectCalls`,
 * `observed`) lets tests assert subscription/teardown contracts without
 * spying on the prototype.
 *
 * Static `instances` + `reset()` is the cross-test escape hatch: each test
 * grabs the instance the controller created via `FakeResizeObserver.instances.at(-1)`
 * and calls `reset()` in `beforeEach` to avoid bleed.
 *
 * No `.test.ts` suffix on purpose so vitest does not auto-discover it.
 */

export type FakeResizeRect = { readonly width: number; readonly height: number };

export type FakeResizeFireEntry = { readonly target: Element; readonly rect: FakeResizeRect };

export class FakeResizeObserver implements ResizeObserver {
  /** Every instance ever constructed since the last `reset()`. */
  static instances: FakeResizeObserver[] = [];

  static reset(): void {
    FakeResizeObserver.instances.length = 0;
  }

  /** Targets currently observed by this instance. */
  readonly observed: Set<Element> = new Set();
  observeCalls = 0;
  unobserveCalls = 0;
  disconnectCalls = 0;

  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.add(target);
    this.observeCalls += 1;
  }

  unobserve(target: Element): void {
    this.observed.delete(target);
    this.unobserveCalls += 1;
  }

  disconnect(): void {
    this.observed.clear();
    this.disconnectCalls += 1;
  }

  /**
   * Synchronously invoke the observer callback with synthesised entries.
   * Tests use this to drive controllers' resize-reaction paths.
   */
  fire(entries: FakeResizeFireEntry[]): void {
    const observerEntries = entries.map(({ target, rect }) => makeEntry(target, rect));
    this.callback(observerEntries, this);
  }
}

function makeEntry(target: Element, rect: FakeResizeRect): ResizeObserverEntry {
  const { width, height } = rect;
  const domRect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON(): unknown {
      return { x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height };
    },
  } as DOMRectReadOnly;

  const entry = {
    target,
    contentRect: domRect,
    borderBoxSize: [{ inlineSize: width, blockSize: height }],
    contentBoxSize: [{ inlineSize: width, blockSize: height }],
    devicePixelContentBoxSize: [{ inlineSize: width, blockSize: height }],
  };
  return entry as unknown as ResizeObserverEntry;
}
