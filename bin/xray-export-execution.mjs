#!/usr/bin/env node
// Cross-platform dispatcher for `bin/xray-export-execution.{ps1,sh}`. The
// `npm run test:e2e:xray` script calls this so Windows operators get the
// PowerShell sibling and Linux/macOS/CI get the bash sibling without
// hand-coding platform branches in `package.json`.
//
// See SPEC §17.148 for the strand context.

import { spawnSync } from "node:child_process";
import { platform } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

const isWindows = platform() === "win32";
const command = isWindows ? "powershell" : "bash";
const scriptName = isWindows
  ? "xray-export-execution.ps1"
  : "xray-export-execution.sh";
const baseArgs = isWindows
  ? ["-NoProfile", "-File", join(__dirname, scriptName)]
  : [join(__dirname, scriptName)];

const result = spawnSync(command, [...baseArgs, ...args], { stdio: "inherit" });
if (result.error) {
  console.error(`Failed to launch ${command}:`, result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
