import { defineConfig } from "@playwright/test";
import { cucumberReporter, defineBddConfig } from "playwright-bdd";

// Patterns are resolved relative to this config file's directory
// (`configDir` per playwright-bdd's `TestFilesGenerator.loadFeatures`),
// so they stay short and survive a workspace move.
const testDir = defineBddConfig({
  features: "features/**/*.feature",
  steps: "steps/**/*.ts",
});

// Cucumber-JSON reporter output path. playwright-bdd resolves outputFile
// against the playwright config's directory (`getConfigDirFromEnv()`), which
// is `src/test/e2e/`. We put it under `test-results/` so the file is
// gitignored by the global `test-results/` rule and stays out of git.
// `bin/xray-export-execution` reads it from this exact spot by default
// (see SPEC §17.148).
const CUCUMBER_REPORT_OUTPUT = "test-results/cucumber.json";

export default defineConfig({
  testDir,
  reporter: [
    ["list"],
    cucumberReporter("json", { outputFile: CUCUMBER_REPORT_OUTPUT }),
  ],
  use: {
    baseURL: "http://localhost:4173",
    headless: true,
    trace: "on-first-retry",
    // §17.148: only-on-failure auto-attaches the failure screenshot via
    // testInfo. playwright-bdd's cucumber-json reporter forwards every
    // testInfo attachment into the step's `embeddings` array (base64 +
    // mime_type), which XRay's import-cucumber endpoint surfaces as
    // evidence on the matching Test Execution result.
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
