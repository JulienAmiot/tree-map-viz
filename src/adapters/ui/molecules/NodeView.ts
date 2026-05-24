/**
 * `<node-view>` — single dispatch point for per-kind / per-role rendering
 * (SPEC §5 — Dispatcher / OCP).
 *
 * Reads `vm.kind` + `viewRole`, looks up the per-kind tag in
 * `nodeViewRegistry`, and renders that custom element with the same VM.
 * No per-kind switch lives here — adding a new node kind = register an
 * entry; this file does not change.
 *
 * Uses `lit/static-html.js` so the rendered tag name comes from the
 * registry at render time, not at template parse time. The tag string is
 * sourced from a frozen registry populated by app code, never from the
 * VM payload — `unsafeStatic` therefore never sees user-controlled data.
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { html as staticHtml, unsafeStatic } from "lit/static-html.js";

import type { NodeRole, NodeViewModel } from "./NodeViewModel.js";
import { nodeViewRegistry } from "./nodeViewRegistry.js";

@customElement("node-view")
export class NodeView extends LitElement {
  /** The node to render. Must be a frozen-shape `NodeViewModel`; never a domain object. */
  @property({ attribute: false })
  vm: NodeViewModel | null = null;

  /**
   * Whether the node renders in the parent strip (`asParent`) or as a
   * treemap tile (`asChild`). Reflected so e2e selectors and CSS rules in
   * the shell can target the host directly. Defaults to `asChild` because
   * children outnumber parents N:1 in any focused view.
   */
  @property({ attribute: "view-role", reflect: true })
  viewRole: NodeRole = "asChild";

  /** SPEC §17.136 S13a -- focused-node parent id, forwarded from the
      shell through the strip down to whichever AsParent tag the
      registry dispatches. AsChild tags ignore it. */
  @property({ attribute: "parent-id" })
  parentId = "";

  /** SPEC §17.136 S13b -- per-child weight, forwarded from
      `<children-grid>` down to whichever AsChild tag the registry
      dispatches so it can pre-fill its `<weight-edit-button>`'s
      `.weight` property. AsParent tags ignore it (they don't carry
      the affordance -- a parent node has no parent-relative weight
      until the operator drills back out). */
  @property({ type: Number })
  weight = 1;

  static styles = css`
    :host {
      display: contents;
    }
  `;

  render() {
    if (!this.vm) {
      return html`<span data-testid="node-view-empty"></span>`;
    }
    const tagName = nodeViewRegistry.lookup(this.vm.kind, this.viewRole);
    const tag = unsafeStatic(tagName);
    // SPEC §17.104-followup / §17.116 / §17.136 S13a / S13b -- forward
    // viewRole + parentId + weight; AsParent tags ignore weight,
    // AsChild + Computed* tags ignore parentId.
    return staticHtml`<${tag} .vm=${this.vm} .viewRole=${this.viewRole} .parentId=${this.parentId} .weight=${this.weight}></${tag}>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "node-view": NodeView;
  }
}
