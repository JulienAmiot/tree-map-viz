# `bin/` — operational scripts

This folder holds operational scripts that don't belong in `src/` (they don't ship with the kiosk runtime). The only resident today is the **XRay import pipeline** that ties Cucumber `.feature` files to Jira `Test` issues under `HE-2570`.

For the spec context, see `docs/SPEC.md` sec.15.7 (XRay workflow), sec.15.9 (issue key map), and sec.17.8 (DT-10 as-built log).

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

So once `app_boots.feature` has been through one successful import, every subsequent run is a pure update — no new Test issues, no file rewrites, no churn in `git`.

### Troubleshooting

- **"XRAY_CLIENT_ID and XRAY_CLIENT_SECRET must be set"** — Task A hasn't been completed yet. See `docs/SPEC.md` sec.15.5 (Task A = `HE-2586`).
- **TLS / handshake failures on Windows PowerShell 5.1** — the script already forces TLS 1.2; if you still hit this, your .NET Framework patch level is below 4.6 (rare on supported Windows versions).
- **"placeholder count != new keys"** warning — XRay returned a different number of created tests than the source has placeholders. The script leaves the file untouched in this case so you can investigate. Re-run after manually fixing the source.
- **Multiple feature files at once** — both scripts process them per-file (not zipped) for clean response→source attribution. Per-file is also what lets the placeholder-counting precondition match exactly.

---

## CI integration

`.github/workflows/xray-import.yml` runs `xray-import.sh` on every push to `main` after `npm run test:e2e` succeeds. Credentials come from GitHub repo secrets (`XRAY_CLIENT_ID`, `XRAY_CLIENT_SECRET`). If the import rewrites any `.feature` files, the workflow auto-commits them back to `main` with `[skip ci]` to avoid a re-trigger loop.

---

## Why two scripts, not one Node.js script?

`docs/SPEC.md` sec.15.7 explicitly calls for a PowerShell primary + Bash sibling so each environment runs a script native to it (no Node bootstrap on a fresh CI runner; no bash-on-Windows requirement for local dev). The duplication is small (~150 LoC each) and the two are easy to keep in sync because they speak only to the XRay REST API.
