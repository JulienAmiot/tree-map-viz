#requires -Version 5.1
<#
.SYNOPSIS
  Exports the latest Cucumber JSON from `npm run test:e2e` into XRay Cloud as
  a Test Execution issue (or several, grouped per Test Plan). DRY-RUN by
  default; pass -Live to actually POST.

.DESCRIPTION
  Sibling of `bin/xray-import.ps1` (the .feature -> XRay Test import
  pipeline). Where `xray-import` rounds Tests into Jira, this script rounds
  Test *results* back in: every e2e run produces a Cucumber JSON via the
  playwright-bdd reporter wired into `src/test/e2e/playwright.config.ts`,
  and this script ships that JSON to XRay's
  `POST /api/v2/import/execution/cucumber/multipart` endpoint along with an
  `info` JSON that controls the Test Execution issue's fields.

  Per the four operator choices captured in SPEC §17.148:
    Q1 (update-shared)  : one Test Execution per branch is reused across
                          runs by passing `testExecutionKey` at the top
                          level of the `info` JSON. The key is sourced
                          from $env:XRAY_EXECUTION_KEY_<BRANCH>; when
                          unset (first run on a new branch), XRay creates
                          a fresh issue.
    Q2 (tp-by-feature)  : scenarios are split per Test Plan and uploaded
                          in groups. The per-feature -> Test Plan map
                          lives in `Get-TestPlanForFeature` below.
    Q3 (scaffold-only)  : -Live is gated behind a pre-flight check that
                          refuses to fire if any scenario carries an
                          unresolved `@HE-????` placeholder (the
                          pairing-bug fix in the follow-up §17.149 strand
                          will land real keys; until then -Live is a
                          no-op).
    Q4 (ss-failed-only) : Playwright's `screenshot: 'only-on-failure'`
                          attaches a screenshot via testInfo on failure;
                          playwright-bdd's cucumber-json reporter emits
                          it as a base64 `embeddings` entry, which XRay
                          surfaces as evidence on the matching Test
                          result. No extra work needed here.

.PARAMETER CucumberReport
  Path to the Cucumber JSON file. Defaults to
  `<repo>/src/test/e2e/test-results/cucumber.json` (where
  `playwright.config.ts` writes it).

.PARAMETER ProjectKey
  Jira project key. Defaults to $env:XRAY_PROJECT_KEY then "HE".

.PARAMETER BaseUrl
  XRay Cloud base URL. Defaults to $env:XRAY_BASE_URL then the public host.

.PARAMETER Branch
  Branch name to put in the Test Execution summary + use to look up the
  per-branch execution key. Defaults to `git rev-parse --abbrev-ref HEAD`.

.PARAMETER CommitSha
  Short commit SHA for the summary. Defaults to `git rev-parse --short HEAD`.

.PARAMETER Environment
  XRay testEnvironments value. Defaults to "CI" when $env:CI is truthy,
  else "local".

.PARAMETER ReuseTag
  Free-form identifier used to find + reuse a Test Execution across
  runs (typically `PR #123` from the CI workflow's pull_request
  trigger). When set, the script:
    - includes the tag in the Test Execution summary,
    - applies a unique Jira label `tmv-e2e-<slug>-<tpKey>` per
      group so the issue can be looked up later,
    - in `-Live` mode runs a GraphQL `getTestExecutions(jql:"labels =
      \"...\"")` lookup; if found, the existing issue key drives an
      UPDATE; if not, a fresh issue is CREATEd with the label so the
      next run can find it.
  Falls back to $env:XRAY_TEST_EXEC_REUSE_TAG when not passed.
  Takes precedence over the `XRAY_EXECUTION_KEY_<BRANCH>` legacy
  reuse mechanism (§17.148 Q1). See SPEC §17.150.

.PARAMETER Live
  When set, authenticates and POSTs to XRay. Otherwise (default) the
  script prints the `info` JSON + the per-group summary and exits without
  touching the network.

.EXAMPLE
  # Dry-run after a local e2e run (default mode).
  pwsh ./bin/xray-export-execution.ps1

.EXAMPLE
  # Real upload (only meaningful once the pairing-bug follow-up has
  # resolved all @HE-???? scenario placeholders).
  pwsh ./bin/xray-export-execution.ps1 -Live

.EXAMPLE
  # CI usage: one reused Test Execution per PR + Test Plan group.
  pwsh ./bin/xray-export-execution.ps1 -Live -ReuseTag "PR #123"
#>

[CmdletBinding()]
param(
    [string] $CucumberReport,
    [string] $ProjectKey,
    [string] $BaseUrl,
    [string] $Branch,
    [string] $CommitSha,
    [string] $Environment,
    [string] $ReuseTag,
    [switch] $Live
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

[Net.ServicePointManager]::SecurityProtocol =
    [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

function Import-DotEnv([string] $path) {
    if (-not (Test-Path $path)) { return }
    foreach ($line in Get-Content -LiteralPath $path) {
        $trimmed = $line.Trim()
        if ($trimmed -eq "" -or $trimmed.StartsWith("#")) { continue }
        $kv = $trimmed -split "=", 2
        if ($kv.Length -ne 2) { continue }
        $name  = $kv[0].Trim()
        $value = $kv[1].Trim().Trim('"').Trim("'")
        if (-not [Environment]::GetEnvironmentVariable($name, "Process")) {
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}
Import-DotEnv (Join-Path $env:USERPROFILE ".tree-map-viz\.env")
Import-DotEnv (Join-Path $RepoRoot ".env")

if (-not $CucumberReport) {
    $CucumberReport = Join-Path $RepoRoot "src/test/e2e/test-results/cucumber.json"
}
if (-not $ProjectKey) {
    $ProjectKey = $env:XRAY_PROJECT_KEY
    if (-not $ProjectKey) { $ProjectKey = "HE" }
}
if (-not $BaseUrl) {
    $BaseUrl = $env:XRAY_BASE_URL
    if (-not $BaseUrl) { $BaseUrl = "https://xray.cloud.getxray.app" }
}
if (-not $Branch) {
    try { $Branch = (& git -C $RepoRoot rev-parse --abbrev-ref HEAD).Trim() } catch { $Branch = "unknown" }
}
if (-not $CommitSha) {
    try { $CommitSha = (& git -C $RepoRoot rev-parse --short HEAD).Trim() } catch { $CommitSha = "unknown" }
}
if (-not $Environment) {
    if ($env:CI) { $Environment = "CI" } else { $Environment = "" }
}
if (-not $ReuseTag) {
    $ReuseTag = $env:XRAY_TEST_EXEC_REUSE_TAG
}
$ClientId     = $env:XRAY_CLIENT_ID
$ClientSecret = $env:XRAY_CLIENT_SECRET

# Per-branch reused Test Execution key (Q1 update-shared). The env var name
# is sanitised so `feature/foo-bar` becomes XRAY_EXECUTION_KEY_FEATURE_FOO_BAR.
# Operators set this once after the first -Live run creates an issue.
function Get-PerBranchExecutionKey([string] $branch) {
    $slug = ($branch.ToUpperInvariant() -replace "[^A-Z0-9]+", "_").Trim("_")
    $envName = "XRAY_EXECUTION_KEY_$slug"
    return [Environment]::GetEnvironmentVariable($envName, "Process")
}

# --- Test Plan routing (Q2 tp-by-feature) -------------------------------------
# Maps the feature-file dir (relative to src/test/e2e/features) to the
# matching Test Plan key. Update this table when new top-level dirs land.
$TestPlanByDir = @{
    "layout"      = "HE-2587"   # TP-B Phase 7 (shell + layout)
    "shell"       = "HE-2587"   # TP-B Phase 7
    "modal"       = "HE-2580"   # TP-C Phase 8 Modal
    "boot"        = "HE-2585"   # TP-D catch-all
    "persistence" = "HE-2585"   # TP-D Phase 9-10
    "routing"     = "HE-2585"   # TP-D Phase 9-10
    "views"       = "HE-2585"   # TP-D catch-all
}
$DefaultTestPlan = "HE-2585"

function Get-TestPlanForFeature([string] $uri) {
    # Cucumber JSON's `uri` is like "features/boot/app_boots.feature" or
    # "features\boot\app_boots.feature" on Windows. Normalise + extract
    # the first segment AFTER `features/`.
    $normalised = $uri -replace "\\", "/"
    if ($normalised -match "(?:^|/)features/([^/]+)/") {
        $dir = $matches[1]
        if ($TestPlanByDir.ContainsKey($dir)) { return $TestPlanByDir[$dir] }
    }
    return $DefaultTestPlan
}

# --- Pre-flight: detect unresolved @HE-???? scenario tags ---------------------
# The check looks only for the *placeholder* token (@HE-????). The presence
# of a real @HE-XXXX tag inherited from the feature-level epic does NOT
# rescue the scenario: XRay's import-cucumber endpoint matches scenarios to
# Tests by the @HE-XXXX tag attached directly to the *scenario*, not the
# feature, and the §17.149 follow-up (feature/xray-pairing-by-summary) is
# what will land scenario-level Test keys. Until then, any @HE-???? is a
# scenario that XRay would either skip or duplicate.
function Get-UnresolvedScenarios($cucumberJson) {
    $hits = @()
    foreach ($feature in $cucumberJson) {
        foreach ($scenario in $feature.elements) {
            foreach ($tag in $scenario.tags) {
                if ($tag.name -match "^@HE-\?+$") {
                    $hits += [pscustomobject]@{
                        Feature  = $feature.uri
                        Scenario = $scenario.name
                    }
                    break
                }
            }
        }
    }
    return ,$hits
}

# --- Auth (cached per invocation) ---------------------------------------------
$jwt = $null
function Get-XrayJwt {
    if ($script:jwt) { return $script:jwt }
    if (-not $ClientId -or -not $ClientSecret) {
        throw "XRAY_CLIENT_ID and XRAY_CLIENT_SECRET must be set for -Live. See bin/README.md."
    }
    $body = @{ client_id = $ClientId; client_secret = $ClientSecret } | ConvertTo-Json -Compress
    $resp = Invoke-RestMethod `
        -Method Post `
        -Uri "$BaseUrl/api/v2/authenticate" `
        -ContentType "application/json" `
        -Body $body
    if ($resp -is [string]) { $script:jwt = $resp.Trim('"') } else { $script:jwt = [string]$resp }
    return $script:jwt
}

# --- §17.150 reuse-tag helpers -----------------------------------------------
# Returns a Jira-safe label combining the reuse tag + Test Plan key. Used as
# the lookup key for `Find-ExistingTestExecution` AND embedded as a Jira
# label on every created Test Execution so the next run can find it.
# Slug rules: lowercase, [^a-z0-9] -> "-", collapsed + trimmed; prefixed
# with "tmv-e2e-" so labels scope cleanly to this codebase.
function Get-ReuseTagLabel([string] $reuseTag, [string] $tpKey) {
    if (-not $reuseTag) { return "" }
    $combined = "$reuseTag-$tpKey"
    $slug = $combined.ToLowerInvariant() -replace "[^a-z0-9]+", "-"
    $slug = $slug.Trim("-")
    return "tmv-e2e-$slug"
}

# Looks up an existing Test Execution issue carrying the `Get-ReuseTagLabel`
# label via XRay's GraphQL `getTestExecutions(jql:"...")`. Returns the
# issue key or $null. Same fail-soft contract as `Get-XrayTestSummaries`
# in xray-import.ps1: any error logs a warning and returns $null, which
# causes the caller to CREATE a fresh Test Execution.
function Find-ExistingTestExecution([string] $jwt, [string] $reuseTag, [string] $tpKey) {
    if (-not $reuseTag) { return $null }
    $label = Get-ReuseTagLabel -reuseTag $reuseTag -tpKey $tpKey
    if (-not $label) { return $null }
    $jql   = "labels = \`"$label\`""
    $query = "{ getTestExecutions(jql: `"$jql`", limit: 5) { results { jira(fields: [`"key`", `"summary`"]) } } }"
    $body  = @{ query = $query } | ConvertTo-Json -Compress
    try {
        $resp = Invoke-RestMethod `
            -Method Post `
            -Uri "$BaseUrl/api/v2/graphql" `
            -Headers @{ Authorization = "Bearer $jwt" } `
            -ContentType "application/json" `
            -Body $body
    } catch {
        Write-Warning "  Reuse-tag GraphQL lookup failed for label '$label': $($_.Exception.Message). Will CREATE a new Test Execution."
        return $null
    }
    if ($resp -and $resp.data -and $resp.data.getTestExecutions -and $resp.data.getTestExecutions.results) {
        $first = @($resp.data.getTestExecutions.results) | Select-Object -First 1
        if ($first -and $first.jira -and $first.jira.key) {
            return [string]$first.jira.key
        }
    }
    return $null
}

# --- Build the per-group `info` JSON -----------------------------------------
function New-InfoPayload {
    param(
        [string] $testPlanKey,
        [int]    $scenarioCount,
        [int]    $passedCount,
        [int]    $failedCount,
        [string] $reuseTag          = "",
        [string] $reuseExecutionKey = ""
    )
    $perBranchKey = Get-PerBranchExecutionKey -branch $Branch
    $timestamp    = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $summary = if ($reuseTag) {
        "E2E run -- $reuseTag -- $testPlanKey"
    } else {
        "E2E run -- $Branch@$CommitSha -- $timestamp -- $testPlanKey"
    }
    $description = @(
        "Automated XRay Test Execution import.",
        "",
        "Branch       : $Branch",
        "Commit       : $CommitSha",
        "Environment  : $Environment",
        "Test Plan    : $testPlanKey",
        "Scenarios    : $scenarioCount (passed: $passedCount, failed: $failedCount)",
        "Reuse Tag    : $(if ($reuseTag) { $reuseTag } else { '<none>' })",
        "Source       : src/test/e2e/test-results/cucumber.json"
    ) -join "`n"

    # Precedence: explicit reuse-lookup result > XRAY_EXECUTION_KEY_<BRANCH>.
    $existingKey = $null
    if ($reuseExecutionKey)   { $existingKey = $reuseExecutionKey }
    elseif ($perBranchKey)    { $existingKey = $perBranchKey }

    # XRay's cucumber multipart endpoint distinguishes CREATE vs UPDATE
    # by the presence of `testExecutionKey`. On UPDATE we MUST omit
    # `summary` and `issuetype` because their presence causes XRay to
    # interpret the request as a CREATE and spawn a new Test Execution
    # issue even when `testExecutionKey` is also set. `project` IS
    # required by the API even for UPDATE (otherwise 400 "fields in
    # info file is required and should contain project field").
    $fields = [ordered]@{
        project     = @{ key = $ProjectKey }
        description = $description
    }
    if (-not $existingKey) {
        $fields["summary"]   = $summary
        $fields["issuetype"] = @{ name = "Test Execution" }
    }
    if ($reuseTag -and -not $existingKey) {
        # Per-(reuseTag, tpKey) label attached on CREATE so the next
        # run's GraphQL lookup uniquely resolves THIS group's Test
        # Execution issue. On UPDATE the label is already attached.
        $fields["labels"] = @(Get-ReuseTagLabel -reuseTag $reuseTag -tpKey $testPlanKey)
    }
    $info = [ordered]@{
        fields = $fields
    }
    if (-not $existingKey) {
        $xrayFields = [ordered]@{
            testPlanKey = $testPlanKey
        }
        if ($Environment) {
            $xrayFields["environments"] = @($Environment)
        }
        $info["xrayFields"] = $xrayFields
    }
    if ($existingKey) {
        $info["testExecutionKey"] = $existingKey
    }
    return $info
}

# --- POST the cucumber results to XRay ---------------------------------------
# XRay v2 has two cucumber-import endpoints with different semantics:
#   CREATE: POST /api/v2/import/execution/cucumber/multipart
#       expects multipart body with `info` + `results` parts; XRay creates
#       a new Test Execution issue with the metadata from `info` and links
#       the cucumber `results` to it. The `testExecutionKey` field in the
#       info file is NOT supported here despite some older docs claiming
#       otherwise -- XRay always interprets a multipart request as CREATE.
#   UPDATE: POST /api/v2/import/execution/cucumber/{testExecKey}
#       expects the raw cucumber JSON in the body (NOT multipart, NOT
#       wrapped in any envelope); XRay attaches the results to the
#       existing Test Execution issue. The `info` payload is irrelevant
#       here -- the issue already exists with its summary / labels /
#       Test Plan / environments from the original CREATE.
function Invoke-XrayExportGroup($info, $cucumberSubset, $existingKey) {
    $jwt = Get-XrayJwt
    $resultJson = ($cucumberSubset | ConvertTo-Json -Depth 64 -Compress)

    if ($existingKey) {
        # UPDATE path -- raw cucumber JSON, target Test Execution identified
        # by injecting an `@<existingKey>` feature-level tag into every
        # feature in the subset. XRay Cloud does NOT honor a `?testExecKey=`
        # query parameter on the cucumber endpoint (only XRay Server / DC
        # does); the canonical Cloud mechanism is to add the Test Execution
        # key as a feature-level @-tag, which XRay's tag-prefix-driven
        # router then routes to the existing Test Execution issue.
        # See: https://community.atlassian.com/forums/App-Central-questions/XRay-import-cucumber-results-to-an-existing-test-execution-issue
        $tagged = $cucumberSubset | ForEach-Object {
            $feat = $_.PSObject.Copy()
            $existingTags = @()
            if ($feat.PSObject.Properties["tags"] -and $feat.tags) {
                $existingTags = @($feat.tags)
            }
            $execTag = [PSCustomObject]@{ name = "@$existingKey"; line = 1 }
            $feat | Add-Member -NotePropertyName tags -NotePropertyValue (@($execTag) + $existingTags) -Force
            $feat
        }
        $taggedJson = ConvertTo-Json -InputObject $tagged -Depth 64 -Compress
        return Invoke-RestMethod `
            -Method Post `
            -Uri "$BaseUrl/api/v2/import/execution/cucumber" `
            -Headers @{ Authorization = "Bearer $jwt" } `
            -ContentType "application/json" `
            -Body $taggedJson
    }

    # CREATE path -- multipart body with info + results.
    $infoJson = $info | ConvertTo-Json -Depth 8 -Compress
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF       = "`r`n"
    $body     = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"info`"; filename=`"info.json`"",
        "Content-Type: application/json; charset=utf-8",
        "",
        $infoJson,
        "--$boundary",
        "Content-Disposition: form-data; name=`"results`"; filename=`"cucumber.json`"",
        "Content-Type: application/json; charset=utf-8",
        "",
        $resultJson,
        "--$boundary--",
        ""
    ) -join $LF

    return Invoke-RestMethod `
        -Method Post `
        -Uri "$BaseUrl/api/v2/import/execution/cucumber/multipart" `
        -Headers @{ Authorization = "Bearer $jwt" } `
        -ContentType "multipart/form-data; boundary=$boundary" `
        -Body $body
}

# --- Main ---------------------------------------------------------------------
if (-not (Test-Path $CucumberReport)) {
    throw "Cucumber report not found at $CucumberReport. Run `npm run test:e2e` first."
}

$cucumberRaw = Get-Content -LiteralPath $CucumberReport -Raw -Encoding UTF8
$cucumberJson = $cucumberRaw | ConvertFrom-Json
if ($cucumberJson -isnot [System.Collections.IEnumerable]) {
    throw "Cucumber report at $CucumberReport is not a JSON array. Aborting."
}
$cucumberArray = @($cucumberJson)

Write-Host "[xray-export-execution] Project    : $ProjectKey"
Write-Host "[xray-export-execution] BaseUrl    : $BaseUrl"
Write-Host "[xray-export-execution] Branch     : $Branch"
Write-Host "[xray-export-execution] Commit     : $CommitSha"
Write-Host "[xray-export-execution] Environment: $Environment"
Write-Host "[xray-export-execution] ReuseTag   : $(if ($ReuseTag) { $ReuseTag } else { '<unset>' })"
Write-Host "[xray-export-execution] Source     : $CucumberReport"
Write-Host "[xray-export-execution] Features   : $($cucumberArray.Count)"
Write-Host "[xray-export-execution] Mode       : $(if ($Live) { 'LIVE (will POST)' } else { 'DRY-RUN (no network calls)' })"
Write-Host ""

# Group features by Test Plan key.
$grouped = @{}
foreach ($feature in $cucumberArray) {
    $tpKey = Get-TestPlanForFeature -uri $feature.uri
    if (-not $grouped.ContainsKey($tpKey)) { $grouped[$tpKey] = @() }
    $grouped[$tpKey] += $feature
}

# Pre-flight: count unresolved @HE-???? scenarios.
$unresolved = Get-UnresolvedScenarios -cucumberJson $cucumberArray
if ($unresolved.Count -gt 0) {
    Write-Host "[pre-flight] $($unresolved.Count) scenario(s) have an unresolved @HE-???? placeholder (no real Test key)." -ForegroundColor Yellow
    Write-Host "[pre-flight] Such scenarios cannot be linked to an existing XRay Test; on -Live, XRay would" -ForegroundColor Yellow
    Write-Host "[pre-flight] create a NEW Test per scenario per run (the §17.147 duplication bug)." -ForegroundColor Yellow
    foreach ($u in ($unresolved | Select-Object -First 5)) {
        Write-Host "  - $($u.Feature) :: $($u.Scenario)" -ForegroundColor Yellow
    }
    if ($unresolved.Count -gt 5) {
        Write-Host "  ... and $($unresolved.Count - 5) more" -ForegroundColor Yellow
    }
    Write-Host ""
    if ($Live) {
        throw "Refusing to -Live with unresolved @HE-???? placeholders. Land the §17.149 follow-up (feature/xray-pairing-by-summary) first."
    }
}

# Per-group dispatch.
$grandTotal = [ordered]@{ scenarios = 0; passed = 0; failed = 0; skipped = 0 }
foreach ($tpKey in ($grouped.Keys | Sort-Object)) {
    $features = $grouped[$tpKey]
    $scenarioCount = 0
    $passedCount   = 0
    $failedCount   = 0
    $skippedCount  = 0
    foreach ($feature in $features) {
        foreach ($scenario in $feature.elements) {
            $scenarioCount++
            $allPassed = $true
            $anyFailed = $false
            $anySkipped = $false
            foreach ($step in $scenario.steps) {
                switch ($step.result.status) {
                    "passed"  { }
                    "failed"  { $anyFailed = $true; $allPassed = $false }
                    "skipped" { $anySkipped = $true; $allPassed = $false }
                    default   { $allPassed = $false }
                }
            }
            if ($anyFailed)        { $failedCount++ }
            elseif ($anySkipped)   { $skippedCount++ }
            elseif ($allPassed)    { $passedCount++ }
        }
    }
    $grandTotal.scenarios += $scenarioCount
    $grandTotal.passed    += $passedCount
    $grandTotal.failed    += $failedCount
    $grandTotal.skipped   += $skippedCount

    Write-Host "=== Group: $tpKey ($($features.Count) feature(s), $scenarioCount scenarios) ==="
    $reuseKey = $null
    if ($Live -and $ReuseTag) {
        $reuseKey = Find-ExistingTestExecution -jwt (Get-XrayJwt) -reuseTag $ReuseTag -tpKey $tpKey
        if ($reuseKey) {
            Write-Host "  reuse lookup     : found $reuseKey via label '$(Get-ReuseTagLabel -reuseTag $ReuseTag -tpKey $tpKey)' (UPDATE)" -ForegroundColor Cyan
        } else {
            Write-Host "  reuse lookup     : no existing Test Execution for '$ReuseTag' + $tpKey (CREATE, label '$(Get-ReuseTagLabel -reuseTag $ReuseTag -tpKey $tpKey)' attached for next run)" -ForegroundColor Cyan
        }
    }
    $perBranchKey = Get-PerBranchExecutionKey -branch $Branch
    if ($reuseKey) {
        Write-Host "  testExecutionKey : $reuseKey (UPDATE via reuse-tag)"
    } elseif ($perBranchKey) {
        Write-Host "  testExecutionKey : $perBranchKey (UPDATE via XRAY_EXECUTION_KEY_<BRANCH>)"
    } elseif ($ReuseTag) {
        Write-Host "  testExecutionKey : <unset> (would CREATE; labelled for reuse on next run)"
    } else {
        Write-Host "  testExecutionKey : <unset> (would CREATE a new Test Execution issue)"
    }
    Write-Host "  scenarios        : passed=$passedCount, failed=$failedCount, skipped=$skippedCount"

    $info = New-InfoPayload `
        -testPlanKey $tpKey `
        -scenarioCount $scenarioCount `
        -passedCount $passedCount `
        -failedCount $failedCount `
        -reuseTag $ReuseTag `
        -reuseExecutionKey $reuseKey
    if (-not $Live) {
        Write-Host "  --- info JSON (would POST) ---"
        Write-Host (($info | ConvertTo-Json -Depth 8) -split "`n" | ForEach-Object { "    $_" } | Out-String)
        Write-Host "  --- end info JSON ---"
    } else {
        if ($reuseKey) {
            Write-Host "  Posting to $BaseUrl/api/v2/import/execution/cucumber (with injected @$reuseKey feature tag) ..."
        } else {
            Write-Host "  Posting to $BaseUrl/api/v2/import/execution/cucumber/multipart ..."
        }
        try {
            $resp = Invoke-XrayExportGroup -info $info -cucumberSubset $features -existingKey $reuseKey
            $issueKey = $null
            if ($resp.PSObject.Properties["key"]) { $issueKey = $resp.key }
            elseif ($resp.PSObject.Properties["testExecIssue"] -and $resp.testExecIssue.PSObject.Properties["key"]) {
                $issueKey = $resp.testExecIssue.key
            }
            elseif ($resp.PSObject.Properties["id"]) { $issueKey = $resp.id }
            if ($reuseKey -and -not $issueKey) { $issueKey = $reuseKey }
            Write-Host "  Test Execution: $issueKey" -ForegroundColor Green
        } catch {
            Write-Host "  POST failed: $($_.Exception.Message)" -ForegroundColor Red
            throw
        }
    }
    Write-Host ""
}

Write-Host "[xray-export-execution] === Grand total ==="
Write-Host "  groups    : $($grouped.Keys.Count)"
Write-Host "  scenarios : $($grandTotal.scenarios)"
Write-Host "  passed    : $($grandTotal.passed)"
Write-Host "  failed    : $($grandTotal.failed)"
Write-Host "  skipped   : $($grandTotal.skipped)"
if (-not $Live) {
    Write-Host ""
    Write-Host "[xray-export-execution] DRY-RUN complete. No XRay calls were made." -ForegroundColor Cyan
    Write-Host "[xray-export-execution] Re-run with -Live to actually POST (blocked until §17.149 pairing-bug fix)."
}
