#!/usr/bin/env node
// -----------------------------------------------------------------------------
// SPEC §17.85 — Snapshot regeneration helper.
// -----------------------------------------------------------------------------
// Spawns vitest against the wire-snapshot test file with `SNAPSHOT_UPDATE=1`
// set. Under that env var the test WRITES the snapshot files instead of
// reading + comparing — see `src/test/unit/adapters/persistence/wireSnapshots.test.ts`.
//
// Cross-platform on purpose: a Node wrapper avoids depending on `cross-env`
// (or shelling out to `sh -c`) so this works identically on Windows operator
// laptops + the Linux CI runners that drive the §17.85 guard.
//
// Usage:
//   npm run snapshot:update
//
// After running, REVIEW the diff in `git status`, commit the updated
// snapshot files alongside whatever production change drove the regen,
// AND remember to bump `package.json#version`'s X if the change breaks
// existing localStorage payloads. The CI guard at
// `bin/check-version-bump.mjs` will reject any snapshot diff missing
// an X-bump.
// -----------------------------------------------------------------------------

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const TARGET = "src/test/unit/adapters/persistence/wireSnapshots.test.ts";

const vitestBin = process.platform === "win32" ? "vitest.cmd" : "vitest";
const vitestPath = resolve(REPO_ROOT, "node_modules", ".bin", vitestBin);

// `shell: true` is required on Windows to spawn `.cmd` shims (vitest.cmd);
// it is harmless on POSIX where `vitest` is a JS shebang script.
const child = spawn(vitestPath, ["run", TARGET], {
  cwd: REPO_ROOT,
  env: { ...process.env, SNAPSHOT_UPDATE: "1" },
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
