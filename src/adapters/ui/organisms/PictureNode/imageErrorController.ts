/**
 * Reactive controller that tracks the `<img>` error state for
 * a `PictureNode` view (SPEC §17.119).
 *
 * Pre-extraction both PictureNodeAsParent + PictureNodeAsChild
 * duplicated:
 *   - the `hasError` reactive slot,
 *   - the `lastUrl` change-tracker,
 *   - the `willUpdate` hook that resets the warning state when
 *     the URL actually changes (not just any vm property), so a
 *     previously-broken URL retries the load once the operator
 *     points it at a working source,
 *   - the `handleImageError` arrow handler that flips the flag.
 *
 * The shared controller absorbs all of that. A view installs it,
 * implements {@link ImageErrorHost.getURL} to surface the current
 * URL, and reads `controller.hasError` + binds
 * `controller.handleError` to the `<img>`'s `@error` slot.
 *
 * Why a controller and not a mixin: the WorkflowNode view doesn't
 * track image error state but DOES already extend the same
 * `LitElement` ancestor — a mixin would need to be opted-in via
 * a class-decorator chain; controllers compose as plain fields.
 */

import type { ReactiveController, ReactiveControllerHost } from "lit";

export interface ImageErrorHost extends ReactiveControllerHost {
  /** Returns the current image URL, or `null` if the view has no vm yet. */
  getURL(): string | null;
}

export class ImageErrorController implements ReactiveController {
  private readonly host: ImageErrorHost;
  private lastUrl: string | null = null;

  /**
   * `true` once the `<img>`'s `error` event has fired for the
   * current URL. Reset whenever the URL changes so the next
   * render pass mounts a fresh `<img>` and lets the browser
   * retry the load.
   */
  hasError = false;

  constructor(host: ImageErrorHost) {
    this.host = host;
    host.addController(this);
  }

  hostUpdate(): void {
    const currentUrl = this.host.getURL();
    if (currentUrl === this.lastUrl) return;
    this.lastUrl = currentUrl;
    if (this.hasError) {
      this.hasError = false;
      this.host.requestUpdate();
    }
  }

  /**
   * Bound `@error` handler — wire to the `<img>`'s `@error`
   * event slot. Flips the warning flag and requests a host
   * update so the next render swaps the `<img>` for the
   * `warning-fill` glyph.
   */
  readonly handleError = (): void => {
    if (this.hasError) return;
    this.hasError = true;
    this.host.requestUpdate();
  };
}
