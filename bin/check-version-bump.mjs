#!/usr/bin/env node
// -----------------------------------------------------------------------------
// SPEC §17.85 — Schema-snapshot vs `package.json#version` cross-check (CI half).
// -----------------------------------------------------------------------------
// The §17.82 policy says: when the persisted JSON shape changes in a way that
// breaks existing localStorage payloads, the user-facing
// `package.json#version`'s MAJOR component (X) must be bumped so the §17.86
// runtime mismatch handler can refuse / migrate stale payloads.
//
// This guard mechanises the rule. Run on every PR / push (and locally before
// merging into master):
//   1. Diff vs the base ref (`GITHUB_BASE_REF` if set, else `origin/master`).
//   2. Inspect changes under `src/test/snapshots/*.snap.json`:
//        - `A` (added) entries are IGNORED — first-time snapshot files
//          establish a baseline; nothing existed before to break compat.
//        - `M` (modified) entries DO fire the rule.
//        - `D` (deleted) entries are IGNORED — almost certainly an
//          intentional cleanup, not a wire-shape break.
//   3. If any `M` entry is present AND `package.json#version`'s MAJOR
//      component is unchanged vs the base → exit 1.
//   4. Otherwise → exit 0.
//
// Escape hatch — `CHECK_BUMP_OVERRIDE=1` skips the rule. Use this when the
// snapshot change is a backward-compatible Y-bump (e.g. adding a new optional
// wire field per the §17.82 worked example) and X is genuinely the wrong
// bump. Setting the variable is an explicit human decision the operator
// owns; the variable's presence is logged so PR review can audit it.
//
// IMPORTANT — the guard never edits files. It only inspects git history. Run
// `npm run snapshot:update` to regenerate the snapshot files, then bump
// `package.json#version`'s X manually in the same commit.
//
// Cross-platform: written as a Node ESM script (not bash) so the guard runs
// identically on the Windows operator's laptop, the Linux GitHub Actions
// runner, and any future macOS contributor — no `sh` / `bash` / WSL needed.
// -----------------------------------------------------------------------------

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const PACKAGE_JSON = resolve(REPO_ROOT, "package.json");
const SNAPSHOT_GLOB_PREFIX = "src/test/snapshots/";
const SNAPSHOT_EXT = ".snap.json";

function fail(message) {
  process.stderr.write(`[check-version-bump] FAIL: ${message}\n`);
  process.exit(1);
}

function info(message) {
  process.stdout.write(`[check-version-bump] ${message}\n`);
}

/**
 * Resolve the diff base. Priority:
 *   1. `GITHUB_BASE_REF`   — set by GitHub Actions on `pull_request` workflows.
 *   2. `CHECK_BUMP_BASE`   — manual override for ad-hoc local diffs.
 *   3. `origin/master`     — local fallback (assumes the contributor has
 *                            fetched master at least once).
 *   4. `master`            — last-ditch local fallback when no remote is wired.
 */
function resolveBaseRef() {
  const env = (key) => process.env[key]?.trim();
  const candidates = [
    env("GITHUB_BASE_REF") ? `origin/${env("GITHUB_BASE_REF")}` : null,
    env("CHECK_BUMP_BASE"),
    "origin/master",
    "master",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      execSync(`git rev-parse --verify ${candidate}`, { cwd: REPO_ROOT, stdio: "ignore" });
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  fail(
    "could not resolve a base git ref. Tried GITHUB_BASE_REF, CHECK_BUMP_BASE, " +
      "origin/master, master. Fetch the remote or set CHECK_BUMP_BASE.",
  );
  return null; // unreachable — fail() exits.
}

/**
 * Returns the list of `{ status, path }` tuples for files that changed
 * between `baseRef` and `HEAD`. `status` is the single-letter code from
 * `git diff --name-status` (`A` add, `M` modify, `D` delete, `R…` rename).
 */
function changedEntries(baseRef) {
  const raw = execSync(`git diff --name-status ${baseRef}...HEAD`, {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
  const entries = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    // Format: `<STATUS>\t<PATH>` (renames are `R100\t<old>\t<new>`).
    const parts = trimmed.split(/\s+/);
    const status = parts[0]?.[0] ?? "";
    const path = parts[parts.length - 1] ?? "";
    if (status && path) entries.push({ status, path });
  }
  return entries;
}

/** Returns `package.json#version` at the given ref ("" if the file is absent there). */
function readVersionAtRef(ref) {
  try {
    const raw = execSync(`git show ${ref}:package.json`, {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsed = JSON.parse(raw);
    return typeof parsed.version === "string" ? parsed.version : "";
  } catch {
    return "";
  }
}

function readCurrentVersion() {
  if (!existsSync(PACKAGE_JSON)) {
    fail(`package.json not found at ${PACKAGE_JSON}`);
  }
  const parsed = JSON.parse(readFileSync(PACKAGE_JSON, { encoding: "utf-8" }));
  if (typeof parsed.version !== "string") {
    fail("package.json#version is missing or non-string");
  }
  return parsed.version;
}

function majorOf(semver) {
  const m = /^(\d+)\./.exec(semver);
  if (!m) return null;
  return Number(m[1]);
}

function main() {
  if (process.env["CHECK_BUMP_OVERRIDE"] === "1") {
    info("CHECK_BUMP_OVERRIDE=1 set — skipping rule (operator-acknowledged).");
    process.exit(0);
  }

  const baseRef = resolveBaseRef();
  const entries = changedEntries(baseRef);
  const snapshotEntries = entries.filter(
    (e) => e.path.startsWith(SNAPSHOT_GLOB_PREFIX) && e.path.endsWith(SNAPSHOT_EXT),
  );

  if (snapshotEntries.length === 0) {
    info(`no snapshot files changed vs ${baseRef} — guard passes.`);
    process.exit(0);
  }

  const modified = snapshotEntries.filter((e) => e.status === "M");
  const added = snapshotEntries.filter((e) => e.status === "A");
  const deleted = snapshotEntries.filter((e) => e.status === "D");

  if (added.length > 0) {
    info(`ignoring ${added.length} added snapshot file(s) (baseline-establishing):`);
    for (const e of added) info(`  + ${e.path}`);
  }
  if (deleted.length > 0) {
    info(`ignoring ${deleted.length} deleted snapshot file(s) (intentional cleanup):`);
    for (const e of deleted) info(`  - ${e.path}`);
  }

  if (modified.length === 0) {
    info(`no modified snapshot files vs ${baseRef} — guard passes.`);
    process.exit(0);
  }

  info(`detected ${modified.length} modified snapshot file(s):`);
  for (const e of modified) info(`  * ${e.path}`);

  const currentVersion = readCurrentVersion();
  const baseVersion = readVersionAtRef(baseRef);
  const currentMajor = majorOf(currentVersion);
  const baseMajor = majorOf(baseVersion);

  if (currentMajor === null) {
    fail(`could not parse major from current package.json#version="${currentVersion}".`);
  }
  if (baseMajor === null) {
    info(
      `could not parse major from base package.json#version="${baseVersion}" ` +
        `(treating as 0).`,
    );
  }

  const effectiveBaseMajor = baseMajor ?? 0;

  if (currentMajor > effectiveBaseMajor) {
    info(
      `package.json#version major bumped ${effectiveBaseMajor} → ${currentMajor} ` +
        `alongside snapshot change — guard passes.`,
    );
    process.exit(0);
  }

  fail(
    `Schema snapshot modified but \`package.json#version\`'s major was not ` +
      `bumped (base=${baseVersion || "?"}, current=${currentVersion}). ` +
      `Either revert the snapshot diff, bump the major component, or set ` +
      `CHECK_BUMP_OVERRIDE=1 if the change is genuinely backward-compatible ` +
      `(Y-bump per §17.82 worked example). See SPEC §17.85.`,
  );
}

main();
