# `bin/` — operational scripts

This folder holds operational scripts that don't belong in `src/` (they don't ship with the kiosk runtime). Two pipelines live here today:

1. **XRay import pipeline** (`xray-import.{ps1,sh}`) — ties Cucumber `.feature` files to Jira `Test` issues under `HE-2570`. One-way: source → Jira Test.
2. **XRay export-execution pipeline** (`xray-export-execution.{ps1,sh,mjs}`) — round-trips `npm run test:e2e` results back into Jira as **Test Execution** issues, grouped per Test Plan, with failure screenshots auto-attached as evidence (see §17.148). Dry-run by default; `--live` / `-Live` actually POSTs.

For the spec context, see `docs/SPEC.md` sec.15.7 (XRay workflow), sec.15.9 (issue key map), sec.17.8 (DT-10 as-built log), and sec.17.148 (Test-Execution scaffold).

---

## `xray-import.ps1` (Windows / local dev) and `xray-import.sh` (Linux / CI)

Two siblings with identical behaviour. Use whichever matches your environment.

### What they do

For each `.feature` file under `src/test/e2e/features/`:

1. **Authenticate** against XRay Cloud via `POST /api/v2/authenticate`.
2. **Auto-default feature-level placeholders**: any `@HE-????` that appears BEFORE the `Feature:` keyword is rewritten to `@HE-2570` (the OBEYA Epic cover; configurable via `-FeatureLevelCoverDefault` / `--feature-level-cover-default`). This is saved to disk BEFORE the POST so XRay establishes the cover link from the first run. (SPEC §17.149 bug-fix 2 — feature-level placeholders are not scenarios, so they don't belong in the placeholder-vs-new-keys budget check.)
3. **POST** the file to `/api/v1/import/feature?projectKey=HE` as `multipart/form-data`.
4. **Pair returned keys to scenarios by summary**: the script calls XRay's GraphQL `getTests(jql:"key in (...)")` to fetch each returned Test's summary, then matches each `@HE-????` to its scenario title (the `Scenario:` header immediately below the placeholder). Falls back to source-position pairing for any scenario whose title can't be matched. (SPEC §17.149 bug-fix 1 — replaces the source-position pairing that scrambled on >3-scenario files in §17.147.)
5. **Round-trip** the paired keys back into the source — each `@HE-????` placeholder is replaced by its summary-matched (or position-fallback) key.

Already-real keys (`@HE-1234`) are **not** rewritten — they're sent through unchanged so XRay updates the existing Test issue in place. This is what makes re-runs idempotent.

### Required environment variables

Both scripts read these from the shell first, then from two `.env` candidate paths in this precedence order (first match wins per key):

1. **`$HOME/.tree-map-viz/.env`** (Windows: `%USERPROFILE%\.tree-map-viz\.env`) — **preferred** location. Lives outside the working tree, so a `git clean -fdx` or `git reset --hard` can't wipe it. Use this for secrets you want to outlive a repo reset.
2. **`<repo-root>/.env`** — legacy fallback. Still read for backwards compatibility, but anything that lands here is vulnerable to `git clean -fdx`.

| Variable | Required | Default | Source |
|---|---|---|---|
| `XRAY_CLIENT_ID` | yes | — | Task A — Jira Cloud admin → XRay → API Keys |
| `XRAY_CLIENT_SECRET` | yes | — | Task A (only shown once at creation) |
| `XRAY_PROJECT_KEY` | no | `HE` | per spec sec.15.1 |
| `XRAY_BASE_URL` | no | `https://xray.cloud.getxray.app` | XRay Cloud REST + GraphQL root |

`.env.example` at the repo root is the template. Copy it to **`%USERPROFILE%\.tree-map-viz\.env`** (or `$HOME/.tree-map-viz/.env` on Linux/macOS) and fill in the values:

```powershell
$dir = Join-Path $env:USERPROFILE ".tree-map-viz"
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
Copy-Item .env.example "$dir\.env"
notepad "$dir\.env"
```

```bash
mkdir -p "$HOME/.tree-map-viz"
cp .env.example "$HOME/.tree-map-viz/.env"
$EDITOR "$HOME/.tree-map-viz/.env"
```

Both `.env.example` and any `.env` at the repo root are still gitignored (see `.gitignore`); the user-scoped location is by definition outside the repo so doesn't need a `.gitignore` rule.

### Local usage — Windows PowerShell

```powershell
# --- Dry-run (no creds needed; reports what would happen) ----------------
powershell -NoProfile -ExecutionPolicy Bypass -File bin\xray-import.ps1 -DryRun

# --- Real import -----------------------------------------------------------
$env:XRAY_CLIENT_ID  = "..."
$env:XRAY_CLIENT_SECRET = "..."
powershell -NoProfile -ExecutionPolicy Bypass -File bin\xray-import.ps1
```

The script targets **Windows PowerShell 5.1+** (so it runs on stock Windows without installing PowerShell 7). It forces TLS 1.2 explicitly because 5.1 still defaults to TLS 1.0 in some configurations.

Optional flags: `-FeaturesPath <DIR>`, `-ProjectKey <KEY>`, `-BaseUrl <URL>`, `-FeatureLevelCoverDefault <KEY>` (defaults to `HE-2570`; see §17.149).

### Local usage — Linux / macOS

```bash
# --- Dry-run --------------------------------------------------------------
bash bin/xray-import.sh --dry-run

# --- Real import ----------------------------------------------------------
export XRAY_CLIENT_ID=...
export XRAY_CLIENT_SECRET=...
bash bin/xray-import.sh
```

Requires `curl` and `jq` on `PATH`. Optional flags: `--features-path <DIR>`, `--project-key <KEY>`, `--base-url <URL>`, `--feature-level-cover-default <KEY>` (defaults to `HE-2570`; see §17.149).

### Idempotency — what re-running does

| State of a scenario tag | First run | Re-run |
|---|---|---|
| `@HE-????` (placeholder) | XRay creates a new Test; placeholder rewritten to the new key | (no longer present) |
| `@HE-1234` (real key) | XRay updates the existing `HE-1234` Test in place; tag untouched | Same — keep updating in place |

So once a small feature file has been through one successful import, every subsequent run is a pure update — no new Test issues, no file rewrites, no churn in `git`.

> **§17.147 caveat resolved by §17.149** — the source-position pairing that previously scrambled on >3-scenario files has been replaced by GraphQL summary-lookup pairing. Multi-scenario files (e.g. `add_child_modal.feature` with 27 scenarios) round-trip correctly on the first import and stay idempotent on re-runs. The script still falls back to source-position pairing if the GraphQL call fails or a scenario title doesn't match any returned Test summary; a `WARN: N scenario(s) paired by source-position` line is logged per file when that happens.

### Error handling

- Per-file failures (XRay rejects the POST — e.g. non-coverable feature-level tag, malformed Gherkin) are **logged and skipped**, the next file is attempted, and a summary at the end lists every file that failed. The script exits non-zero if any file failed, so CI catches the issue.
- The bash sibling captures the HTTP status from `curl` explicitly so 4xx/5xx responses don't get silently mis-parsed as count mismatches.
- The GraphQL summary lookup is a best-effort enrichment: if it fails (5xx, JWT expired between calls, GraphQL endpoint unavailable), the script logs a single warning and falls back to source-position pairing for the whole file. The original POST is never retried.

### Troubleshooting

- **"XRAY_CLIENT_ID and XRAY_CLIENT_SECRET must be set"** — Task A hasn't been completed yet. See `docs/SPEC.md` sec.15.5 (Task A = `HE-2586`).
- **TLS / handshake failures on Windows PowerShell 5.1** — the script already forces TLS 1.2; if you still hit this, your .NET Framework patch level is below 4.6 (rare on supported Windows versions).
- **"POST failed: … is not a coverable issue"** — the feature-level `@HE-XXXX` tag points at an issue type that XRay won't link Tests to (e.g. custom "Development Task", or XRay-internal types like "Test Execution"). Repoint that tag at an Epic / Story / standard Task and re-run. The OBEYA Epic `HE-2570` is the safe default cover (and is now applied automatically by §17.149's feature-level auto-default when the source has `@HE-????` on the feature line).
- **"scenario-level placeholders (N) != new keys (M)"** warning — XRay returned a different number of created Tests than the source has scenario-level placeholders. Investigate why; e.g. a scenario tag is duplicated, or XRay deduplicated by an existing tag we missed. The script leaves the scenario tags untouched so you can fix the source and re-run.
- **"N scenario(s) paired by source-position (title match unavailable)"** warning — the GraphQL summary lookup either failed entirely or returned summaries that don't exactly match the source `Scenario:` titles. Source-position pairing was used as fallback. Inspect Jira: the most common cause is XRay normalising the scenario title (e.g. trimming `§17.18` annotations) when creating the Test. Either edit the scenario title in the source to match what XRay records, or accept the position-fallback (it's correct as long as XRay returned the keys in the same order).
- **Multiple feature files at once** — both scripts process them per-file (not zipped) for clean response→source attribution. Per-file is also what lets the placeholder-counting precondition match exactly.

---

## CI integration

`.github/workflows/xray-import.yml` runs `xray-import.sh` on every push to `main` after `npm run test:e2e` succeeds. Credentials come from GitHub repo secrets (`XRAY_CLIENT_ID`, `XRAY_CLIENT_SECRET`). If the import rewrites any `.feature` files, the workflow auto-commits them back to `main` with `[skip ci]` to avoid a re-trigger loop.

---

## `xray-export-execution.ps1` / `xray-export-execution.sh` / `xray-export-execution.mjs`

The Test-Execution sibling of `xray-import`. Where `xray-import` ships *Tests* into Jira, this script ships *Test results* into Jira.

### What it does

1. Reads the Cucumber JSON written by `playwright-bdd`'s `cucumberReporter("json")` at `src/test/e2e/test-results/cucumber.json` (configured in `src/test/e2e/playwright.config.ts`).
2. Splits scenarios per Test Plan (the routing table is the operator's Q2 "tp-by-feature" choice — `layout/` + `shell/` → `HE-2587`, `modal/` → `HE-2580`, everything else → `HE-2585`). Updating the table is the only thing needed when new top-level feature dirs land.
3. For each Test Plan group, builds an XRay `info` JSON describing the Test Execution issue (summary, description, `testPlanKey`, `testEnvironments`) and POSTs `info` + the cucumber subset to `POST /api/v2/import/execution/cucumber/multipart`.
4. Failure screenshots are auto-attached: Playwright's `screenshot: "only-on-failure"` setting captures them on every failed scenario, the cucumber-json reporter base64-embeds them in the JSON, and XRay surfaces them inline on the matching Test result.

### Scope today — dry-run default, `--live` unblocked once placeholders are resolved

Per §17.148 Q3 (operator picked "scaffold-only"), the scripts default to **dry-run** and the `--live` / `-Live` switch is **gated behind a pre-flight check**: if any scenario still carries an unresolved `@HE-????` placeholder, the live POST refuses to fire. §17.149 has landed the pairing-bug fix in `xray-import`, so a clean re-import of all `.feature` files (`bin/xray-import.{ps1,sh}` without `--dry-run`) now leaves every scenario with a real `@HE-XXXX` key — at which point `xray-export-execution --live` becomes safe to use.

Dry-run mode (default) surfaces:

- the per-group split (which scenarios go to which Test Plan),
- the `info` JSON that *would* be POSTed,
- the per-group pass / fail / skipped counts,
- the inferred per-branch execution key (whether a fresh issue would be created vs an existing one updated).

### Local usage

```powershell
# Windows -- run e2e and then dry-run the export
npm run test:e2e:xray
# Or call the .ps1 directly if you already have a cucumber.json
powershell -NoProfile -File bin\xray-export-execution.ps1
```

```bash
# Linux / macOS / git-bash
npm run test:e2e:xray
# Or call the .sh directly
bash bin/xray-export-execution.sh
```

The cross-platform npm wrapper (`bin/xray-export-execution.mjs`) just dispatches to `powershell` on Windows and `bash` elsewhere; flags pass through unchanged.

### Environment

Same `.env` precedence as `xray-import` (`%USERPROFILE%\.tree-map-viz\.env` → `<repo>\.env` → shell). Only `XRAY_CLIENT_ID` + `XRAY_CLIENT_SECRET` are required, and only in `--live` mode (dry-run never touches the network).

| Variable | Required | Default | Notes |
|---|---|---|---|
| `XRAY_CLIENT_ID` | live only | — | shared with `xray-import` |
| `XRAY_CLIENT_SECRET` | live only | — | shared with `xray-import` |
| `XRAY_PROJECT_KEY` | no | `HE` | |
| `XRAY_BASE_URL` | no | `https://xray.cloud.getxray.app` | |
| `XRAY_EXECUTION_KEY_<BRANCH>` | no | — | Per-branch update-shared key (Q1). Set after the first `--live` creates an issue so subsequent runs update the same Jira issue instead of churning new ones. `<BRANCH>` is the branch name uppercased with non-alphanumeric runs collapsed to `_` (e.g. `feature/foo-bar` → `XRAY_EXECUTION_KEY_FEATURE_FOO_BAR`). |
| `XRAY_TEST_EXEC_REUSE_TAG` | no | — | §17.150 PR-scoped reuse tag (e.g. `"PR #123"`). When set, the script (a) labels each created Test Execution with `tmv-e2e-<slug>-<tp_key>` and (b) runs a GraphQL `getTestExecutions` lookup by that label so subsequent runs **update the same Jira issue** rather than create a new one. Takes precedence over `XRAY_EXECUTION_KEY_<BRANCH>`. The PR-gate workflow (`.github/workflows/e2e-pr-gate.yml`) sets this automatically from `github.event.pull_request.number`. |

### Flags

| PowerShell flag | Bash flag | Purpose |
|---|---|---|
| `-CucumberReport <path>` | `--cucumber-report <path>` | Override the input cucumber JSON. |
| `-Branch <name>` | `--branch <name>` | Override branch detection. |
| `-CommitSha <sha>` | `--commit <sha>` | Override the short SHA in the summary. |
| `-Environment <name>` | `--environment <name>` | Override the XRay test-environment label. Default: `CI` when `$CI` set, else `local`. |
| `-ReuseTag <tag>` | `--reuse-tag <tag>` | Override `$XRAY_TEST_EXEC_REUSE_TAG`. See the env-var row above. |
| `-ProjectKey <key>` | `--project-key <key>` | Override the Jira project. |
| `-BaseUrl <url>` | `--base-url <url>` | Override the XRay base URL. |
| `-Live` | `--live` | Actually POST. Refuses if any scenario carries `@HE-????`. |

### CI integration — PR-gate workflow (§17.150)

`.github/workflows/e2e-pr-gate.yml` is the **required status check** that branch protection enforces on `master`. It triggers on every `pull_request` (`opened` / `synchronize` / `reopened`) and runs:

1. `npm ci` + `playwright install --with-deps chromium`
2. `npm run lint` + `npm run lint:rules`
3. `npm test` (unit suite)
4. `npm run test:e2e` ← **gating step**: failure marks the `pr-gate` check red and blocks the merge.
5. Upload `src/test/e2e/test-results/` as a GHA artifact (traces, only-on-failure screenshots, and the `cucumber.json` with embedded base64 screenshots). Visible from the PR's *Checks* tab, 30-day retention.
6. `bash bin/xray-export-execution.sh --live --reuse-tag "PR #<N>"` — runs even when e2e failed (failures are exactly what we want recorded in Jira). The `--reuse-tag "PR #<N>"` triggers the §17.150 GraphQL `getTestExecutions` lookup, so every push to the same PR **updates the same per-Test-Plan Test Execution issue** instead of creating a new one. With the Q2 `tp-by-feature` routing, each PR ends up with at most three Test Execution issues in Jira (`HE-2587`, `HE-2580`, `HE-2585`).

Concurrency is `cancel-in-progress: true` per PR — a new push cancels the in-flight run. xray-export failures do **not** mark the gate red (only the e2e step does); secrets-missing fork PRs fall back to dry-run automatically.

Required repo secrets (already provisioned for `xray-import.yml`): `XRAY_CLIENT_ID`, `XRAY_CLIENT_SECRET`.

To enforce the gate, configure `master` branch protection so `pr-gate` is a required status check. Recipe (review the JSON before applying):

```bash
gh api -X PUT repos/<owner>/<repo>/branches/master/protection \
  -F required_status_checks.strict=true \
  -F 'required_status_checks.contexts[]=pr-gate' \
  -F enforce_admins=false \
  -F required_pull_request_reviews.required_approving_review_count=0 \
  -F restrictions= --input -
```

### Deferred follow-ups (intentionally NOT in §17.148 / §17.150)

- **§17.149** ✅ — **landed**. Summary-lookup pairing in `xray-import` now leaves every scenario with a real `@HE-XXXX` key, which unblocked the `xray-export-execution` `--live` gate.
- **§17.150** ✅ — **landed**. PR-gate workflow + per-PR Test Execution reuse via GraphQL `getTestExecutions` label lookup.
- **fixVersion linkage** — `info.fields.fixVersions` is left unset. Once a Jira version exists for the running semver, we'll auto-populate it from `package.json#version`.
- **Test Execution attachments beyond the inline embedding** — Playwright trace.zip uploads (Q4 option B) are deliberately skipped. The inline failure screenshot is enough for the Jira evidence; the trace.zip is still available as a GHA artifact for deep debugging.
