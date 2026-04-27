/**
 * Lit-element test fixture helper for unit tests under jsdom.
 *
 * Why this exists, since `@open-wc/testing-helpers/fixture()` is already a
 * devDep:
 *   `fixture(html\`<my-el .prop=\${vm}></my-el>\`)` does not reliably
 *   upgrade custom elements + apply property bindings under jsdom — the
 *   tagged-template parsing path uses `<template>.innerHTML = …` which
 *   creates the element before the property binding is applied, and jsdom
 *   does not always replay the property assignment after upgrade.
 *
 *   The manual path used here — `document.createElement(tag) → assign
 *   properties → `appendChild` → `await updateComplete` — sidesteps the
 *   pitfall and is what every Vitest unit test in `src/test/unit/adapters/ui/`
 *   should use.
 *
 * IMPORTANT — register the element first:
 *   `@customElement("…")` only runs when the module is actually evaluated.
 *   esbuild (under vitest) tree-shakes a `import { Foo } from "./Foo.js"`
 *   line when `Foo` is only referenced as a TypeScript type parameter
 *   (e.g. `mountLitElement<Foo>(...)`), and the registration never runs.
 *   Each test file that mounts a custom element MUST import the module for
 *   its side effect, e.g.:
 *     `import "…/TextNodeAsParent.js";`
 *     `import type { TextNodeAsParent } from "…/TextNodeAsParent.js";`
 *
 * No `.test.ts` suffix on purpose so vitest does not auto-discover it.
 */

/**
 * Mount a custom element under `<body>`, run an optional setup callback to
 * wire properties before insertion (so the first reactive update sees them),
 * then await `updateComplete`. Returns the live element.
 *
 * Each call appends a fresh wrapper `<div>`; tests should call
 * `cleanupLitFixtures()` in `afterEach` to detach all wrappers and prevent
 * cross-test DOM bleed.
 */
export async function mountLitElement<T extends HTMLElement>(
  tag: string,
  setup?: (el: T) => void,
): Promise<T> {
  const wrapper = document.createElement("div");
  wrapper.dataset["litFixture"] = "1";
  document.body.appendChild(wrapper);

  const el = document.createElement(tag) as T;
  if (setup) {
    setup(el);
  }
  wrapper.appendChild(el);

  await (el as unknown as { updateComplete?: Promise<unknown> }).updateComplete;
  return el;
}

/** Detach every wrapper created by `mountLitElement`. Call from `afterEach`. */
export function cleanupLitFixtures(): void {
  const wrappers = document.querySelectorAll('[data-lit-fixture="1"]');
  wrappers.forEach((w) => w.parentElement?.removeChild(w));
}
