import { defineConfig } from "vitest/config";

export default defineConfig({
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
