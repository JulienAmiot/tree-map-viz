import { defineConfig } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

// Patterns are resolved relative to this config file's directory
// (`configDir` per playwright-bdd's `TestFilesGenerator.loadFeatures`),
// so they stay short and survive a workspace move.
const testDir = defineBddConfig({
  features: "features/**/*.feature",
  steps: "steps/**/*.ts",
});

export default defineConfig({
  testDir,
  use: {
    baseURL: "http://localhost:4173",
    headless: true,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
