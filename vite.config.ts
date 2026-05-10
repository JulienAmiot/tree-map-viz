import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// SPEC §17.83 — GitHub Pages deployment ships the build at
// `https://julienamiot.github.io/tree-map-viz/`, a subpath of the
// `julienamiot.github.io` domain. Vite's `base` prefixes every
// generated asset URL (in `index.html` and chunked imports) so the
// deployed page resolves modules correctly. Dev mode (`npm run dev`)
// is unaffected — `base` only applies to `vite build` output. The
// HashRouter is base-agnostic by construction (the hash fragment is
// independent of the path prefix), so no router change is needed.
// Trailing slash matters: `/tree-map-viz/` produces correct relative
// asset URLs; `/tree-map-viz` (no slash) breaks them.

// SPEC §17.84 — App-version source-of-truth. The single canonical
// value is `package.json#version`; this config reads it once at
// eval time and stamps it into the bundled output via Vite's
// `define` (a string-replacement pass that rewrites every
// `__APP_VERSION__` reference to the literal at build time). The
// build-date constant is captured the same way — as the ISO date
// the build started, formatted `YYYY-MM-DD` (no time / no zone:
// the kiosk operator's question is "is this the latest?", which
// only needs day-precision; full timestamps add noise). Both
// constants are consumed via `src/version.ts`, which re-exports
// them as typed string constants so the rest of the app doesn't
// depend on the build-time identifier convention. Tests run
// through the same Vite config (vitest extends it), so the
// constants are also defined in test mode — `version.test.ts`
// can assert their shape.
const PACKAGE_JSON = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8"),
) as { readonly version: string };
const APP_VERSION = PACKAGE_JSON.version;
const APP_BUILD_DATE = new Date().toISOString().slice(0, 10);

export default defineConfig({
  base: "/tree-map-viz/",
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_BUILD_DATE__: JSON.stringify(APP_BUILD_DATE),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Coverage is consumed by the SonarQube scanner (§17.53). Vitest's v8
    // provider produces lcov natively from V8's built-in coverage data —
    // no source-map round-trip, no Istanbul transform pass, ~30% faster
    // on this codebase. The scanner reads coverage/lcov.info via the
    // `sonar.{javascript,typescript}.lcov.reportPaths` properties in
    // sonar-project.properties.
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "src/domain/**/*.ts",
        "src/application/**/*.ts",
        "src/adapters/**/*.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/test/**",
        "src/main.ts",
        "src/vite-env.d.ts",
        "**/*.d.ts",
      ],
      // No threshold here — the SonarQube Quality Gate ("Sonar Way",
      // 80% coverage on NEW code) is the source of truth. Setting a
      // local floor in vitest would double-gate and produce confusing
      // failures (vitest red while the Sonar gate is green for an
      // unchanged file with stale low coverage).
    },
  },
});
