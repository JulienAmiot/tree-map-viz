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
2. **POST** the file to `/api/v1/import/feature?projectKey=HE` as `multipart/form-data`.
3. **Round-trip** the returned `@HE-XXXX` Test issue keys back into the source — each `@HE-????` placeholder, in source order, is replaced by the matching newly created key.

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
| `XRAY_BASE_URL` | no | `https://xray.cloud.getxray.app` | XRay Cloud REST root |

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

Optional flags: `-FeaturesPath <DIR>`, `-ProjectKey <KEY>`, `-BaseUrl <URL>`.

### Local usage — Linux / macOS

```bash
# --- Dry-run --------------------------------------------------------------
bash bin/xray-import.sh --dry-run

# --- Real import ----------------------------------------------------------
export XRAY_CLIENT_ID=...
export XRAY_CLIENT_SECRET=...
bash bin/xray-import.sh
```

Requires `curl` and `jq` on `PATH`. Optional flags: `--features-path <DIR>`, `--project-key <KEY>`, `--base-url <URL>`.

### Idempotency — what re-running does

| State of a scenario tag | First run | Re-run |
|---|---|---|
| `@HE-????` (placeholder) | XRay creates a new Test; placeholder rewritten to the new key | (no longer present) |
| `@HE-1234` (real key) | XRay updates the existing `HE-1234` Test in place; tag untouched | Same — keep updating in place |

So once a small feature file has been through one successful import, every subsequent run is a pure update — no new Test issues, no file rewrites, no churn in `git`.

> **Known caveat (see `docs/SPEC.md` sec.17.147)** — the per-file response → source pairing assumes XRay returns newly created Test keys in scenario source order. This holds reliably for files with ≤3-4 scenarios but breaks down for larger files. Until the pairing strategy is fixed (planned follow-up), **avoid re-running this script against multi-scenario files that have already had an initial successful import**, or you will accrete duplicate Test issues in Jira each run.

### Error handling

- Per-file failures (XRay rejects the POST — e.g. non-coverable feature-level tag, malformed Gherkin) are **logged and skipped**, the next file is attempted, and a summary at the end lists every file that failed. The script exits non-zero if any file failed, so CI catches the issue.
- The bash sibling captures the HTTP status from `curl` explicitly so 4xx/5xx responses don't get silently mis-parsed as count mismatches.

### Troubleshooting

- **"XRAY_CLIENT_ID and XRAY_CLIENT_SECRET must be set"** — Task A hasn't been completed yet. See `docs/SPEC.md` sec.15.5 (Task A = `HE-2586`).
- **TLS / handshake failures on Windows PowerShell 5.1** — the script already forces TLS 1.2; if you still hit this, your .NET Framework patch level is below 4.6 (rare on supported Windows versions).
- **"POST failed: … is not a coverable issue"** — the feature-level `@HE-XXXX` tag points at an issue type that XRay won't link Tests to (e.g. custom "Development Task", or XRay-internal types like "Test Execution"). Repoint that tag at an Epic / Story / standard Task and re-run. The OBEYA Epic `HE-2570` is the safe default cover.
- **"placeholder count != new keys"** warning — XRay returned a different number of created tests than the source has placeholders. Most often: the file's line-1 tag is a `@HE-????` placeholder, which XRay correctly ignores (feature-level tags aren't Tests). The script leaves the file untouched so you can investigate; replace the line-1 placeholder with a real cover key (e.g. `HE-2570`) and re-run.
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

### Scope today — dry-run-only (the `--live` gate)

Per §17.148 Q3 (operator picked "scaffold-only"), the scripts default to **dry-run** and the `--live` / `-Live` switch is **gated behind a pre-flight check**: if any scenario still carries an unresolved `@HE-????` placeholder, the live POST refuses to fire. This makes the scaffold safe to ship now without polluting Jira with duplicate Tests, and lets the §17.149 follow-up (`feature/xray-pairing-by-summary`) land scenario-level Test keys cleanly before this script becomes useful in live mode.

Until then, dry-run mode is the supported mode. It surfaces:

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

### Flags

| PowerShell flag | Bash flag | Purpose |
|---|---|---|
| `-CucumberReport <path>` | `--cucumber-report <path>` | Override the input cucumber JSON. |
| `-Branch <name>` | `--branch <name>` | Override branch detection. |
| `-CommitSha <sha>` | `--commit <sha>` | Override the short SHA in the summary. |
| `-Environment <name>` | `--environment <name>` | Override the XRay test-environment label. Default: `CI` when `$CI` set, else `local`. |
| `-ProjectKey <key>` | `--project-key <key>` | Override the Jira project. |
| `-BaseUrl <url>` | `--base-url <url>` | Override the XRay base URL. |
| `-Live` | `--live` | Actually POST. Refuses if any scenario carries `@HE-????`. |

### Deferred follow-ups (intentionally NOT in this strand)

- **§17.149** — pair each scenario by *summary* (not by source-line index) when round-tripping new Test keys back from `xray-import`. Once this lands and the next clean import gives every scenario a real `@HE-XXXX` tag, the `--live` gate here unblocks naturally.
- **CI wiring** — `.github/workflows/xray-import.yml` does NOT yet invoke this script. It will, once `--live` is usable.
- **fixVersion linkage** — `info.fields.fixVersions` is left unset. Once a Jira version exists for the running semver, we'll auto-populate it from `package.json#version`.
- **Test Execution attachments beyond the inline embedding** — Playwright trace.zip uploads (Q4 option B) are deliberately skipped. The inline failure screenshot is enough for now.
