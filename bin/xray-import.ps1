#requires -Version 5.1
<#
.SYNOPSIS
  Imports Cucumber `.feature` files into XRay Cloud and round-trips the
  returned `@HE-XXXX` Test issue keys back into the source files.

.DESCRIPTION
  Implements DT-10 of the Tree Graph Viz spec (docs/SPEC.md sec.15.7, sec.17.8).

  For each `.feature` file under -FeaturesPath:
    1. Authenticate against XRay Cloud (POST /api/v2/authenticate).
    2. POST the file to /api/v1/import/feature?projectKey=<HE>.
    3. From the response, identify newly created Test keys
       (returned keys not already present in the source).
    4. Rewrite each `@HE-????` placeholder in source-line order with
       the next new key. Already-real keys (`@HE-1234`) are left alone,
       which is what makes re-runs idempotent -- XRay updates them in place.

  Credentials and target project come from environment variables
  (XRAY_CLIENT_ID, XRAY_CLIENT_SECRET, XRAY_PROJECT_KEY, XRAY_BASE_URL).
  If a `.env` file exists at the repo root it is sourced first; explicit
  shell env vars and -Param flags override `.env` values.

.PARAMETER FeaturesPath
  Folder to scan for `.feature` files (recursive). Defaults to
  `src/test/e2e/features` relative to the repo root.

.PARAMETER ProjectKey
  Jira project key. Defaults to $env:XRAY_PROJECT_KEY then "HE".

.PARAMETER DryRun
  Authenticates and parses local placeholders but never POSTs to XRay
  and never rewrites files. Prints what *would* happen.

.EXAMPLE
  pwsh ./bin/xray-import.ps1 -DryRun

.EXAMPLE
  $env:XRAY_CLIENT_ID  = "..."
  $env:XRAY_CLIENT_SECRET = "..."
  pwsh ./bin/xray-import.ps1
#>

[CmdletBinding()]
param(
    [string] $FeaturesPath,
    [string] $ProjectKey,
    [string] $BaseUrl,
    [switch] $DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Windows PowerShell 5.1 still defaults to TLS 1.0/1.1 in some configs;
# XRay Cloud requires TLS 1.2.
[Net.ServicePointManager]::SecurityProtocol =
    [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

# --- Repo root anchoring ------------------------------------------------------
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

# --- .env loader (best-effort; explicit env wins) ----------------------------
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
Import-DotEnv (Join-Path $RepoRoot ".env")

# --- Resolve effective config ------------------------------------------------
if (-not $FeaturesPath) {
    $FeaturesPath = Join-Path $RepoRoot "src/test/e2e/features"
}
if (-not $ProjectKey) {
    $ProjectKey = $env:XRAY_PROJECT_KEY
    if (-not $ProjectKey) { $ProjectKey = "HE" }
}
if (-not $BaseUrl) {
    $BaseUrl = $env:XRAY_BASE_URL
    if (-not $BaseUrl) { $BaseUrl = "https://xray.cloud.getxray.app" }
}
$ClientId     = $env:XRAY_CLIENT_ID
$ClientSecret = $env:XRAY_CLIENT_SECRET

if (-not (Test-Path $FeaturesPath)) {
    throw "FeaturesPath not found: $FeaturesPath"
}

$features = @(Get-ChildItem -LiteralPath $FeaturesPath -Recurse -Filter "*.feature" |
    Sort-Object FullName)

if ($features.Count -eq 0) {
    Write-Host "No `.feature` files under $FeaturesPath. Nothing to do." -ForegroundColor Yellow
    return
}

Write-Host "[xray-import] Project    : $ProjectKey"
Write-Host "[xray-import] BaseUrl    : $BaseUrl"
Write-Host "[xray-import] Features   : $($features.Count) under $FeaturesPath"
Write-Host "[xray-import] DryRun     : $DryRun"
Write-Host ""

# --- Auth ---------------------------------------------------------------------
$jwt = $null
function Get-XrayJwt {
    if (-not $ClientId -or -not $ClientSecret) {
        if ($DryRun) {
            Write-Host "[dry-run] XRAY_CLIENT_ID / XRAY_CLIENT_SECRET not set -- skipping auth." -ForegroundColor Yellow
            return $null
        }
        throw "XRAY_CLIENT_ID and XRAY_CLIENT_SECRET must be set (env or .env). See bin/README.md."
    }
    $body = @{ client_id = $ClientId; client_secret = $ClientSecret } | ConvertTo-Json -Compress
    $resp = Invoke-RestMethod `
        -Method Post `
        -Uri "$BaseUrl/api/v2/authenticate" `
        -ContentType "application/json" `
        -Body $body
    # Endpoint returns the JWT as a JSON string ("eyJhbGc..."); strip the wrapping quotes if present.
    if ($resp -is [string]) { return ($resp.Trim('"')) }
    return [string]$resp
}

# --- Per-file rewrite ---------------------------------------------------------
function Get-ExistingHeKeys([string] $content) {
    $rxMatches = [regex]::Matches($content, "@(HE-\d+)")
    $keys = @()
    foreach ($m in $rxMatches) {
        $k = $m.Groups[1].Value
        if ($keys -notcontains $k) { $keys += $k }
    }
    # Comma operator forces the function to return the array as-is
    # (otherwise PS unwraps a 1-element array to a scalar).
    return ,$keys
}

function Get-PlaceholderCount([string] $content) {
    return ([regex]::Matches($content, "@HE-\?{2,}")).Count
}

function Invoke-XrayImport([string] $featurePath, [string] $jwt) {
    $url      = "$BaseUrl/api/v1/import/feature?projectKey=$ProjectKey"
    $fileName = [System.IO.Path]::GetFileName($featurePath)
    # `.feature` files are UTF-8 text; reading as a string preserves embedded
    # line endings and round-trips cleanly through the multipart body.
    $fileText = [System.IO.File]::ReadAllText($featurePath, [System.Text.UTF8Encoding]::new($false))

    $boundary = [System.Guid]::NewGuid().ToString()
    $LF       = "`r`n"
    $body     = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
        "Content-Type: text/plain; charset=utf-8",
        "",
        $fileText,
        "--$boundary--",
        ""
    ) -join $LF

    return Invoke-RestMethod `
        -Method Post `
        -Uri $url `
        -Headers @{ Authorization = "Bearer $jwt" } `
        -ContentType "multipart/form-data; boundary=$boundary" `
        -Body $body
}

function Rewrite-Placeholders([string] $content, [string[]] $newKeys) {
    if ($newKeys.Count -eq 0) { return $content }
    # Iterate matches in source order; nth placeholder takes nth new key.
    $rx = [regex]"@HE-\?{2,}"
    $rxMatches = $rx.Matches($content)
    $sb = [System.Text.StringBuilder]::new()
    $cursor = 0
    for ($mi = 0; $mi -lt $rxMatches.Count; $mi++) {
        $m = $rxMatches[$mi]
        [void]$sb.Append($content.Substring($cursor, $m.Index - $cursor))
        if ($mi -lt $newKeys.Count) {
            [void]$sb.Append("@$($newKeys[$mi])")
        } else {
            [void]$sb.Append($m.Value)
        }
        $cursor = $m.Index + $m.Length
    }
    [void]$sb.Append($content.Substring($cursor))
    return $sb.ToString()
}

# --- Main loop ----------------------------------------------------------------
$totalCreated = 0
$totalUpdated = 0
$rewrittenFiles = @()

foreach ($f in $features) {
    Write-Host "[$($f.Name)]"
    $content = Get-Content -LiteralPath $f.FullName -Raw
    $existing = Get-ExistingHeKeys $content
    $placeholderCount = Get-PlaceholderCount $content

    $existingCount = $existing.Length
    $existingList  = $existing -join ', '
    $existingLine  = "  existing keys  : $existingCount"
    if ($existingCount -gt 0) { $existingLine += " - $existingList" }
    Write-Host $existingLine
    Write-Host "  placeholders   : $placeholderCount"

    if ($placeholderCount -eq 0 -and $existingCount -eq 0) {
        Write-Host "  (no scenario tags; nothing to do)" -ForegroundColor DarkGray
        Write-Host ""
        continue
    }

    if ($DryRun) {
        Write-Host "  [dry-run] would POST $($f.FullName) and rewrite $placeholderCount placeholder(s)." -ForegroundColor Yellow
        Write-Host ""
        continue
    }

    if (-not $jwt) { $jwt = Get-XrayJwt }

    $resp = Invoke-XrayImport -featurePath $f.FullName -jwt $jwt

    $returnedTests = @()
    if ($resp -and $resp.PSObject.Properties.Match('updatedOrCreatedTests').Count -gt 0 -and $null -ne $resp.updatedOrCreatedTests) {
        $returnedTests = @($resp.updatedOrCreatedTests)
    }
    $returnedKeys = @($returnedTests | ForEach-Object { $_.key } | Where-Object { $_ })

    $newKeys     = @($returnedKeys | Where-Object { $existing -notcontains $_ })
    $updatedKeys = @($returnedKeys | Where-Object { $existing    -contains $_ })

    Write-Host "  returned tests : $($returnedKeys.Count) ($($newKeys.Count) new, $($updatedKeys.Count) updated)"

    if ($newKeys.Count -gt 0) {
        $newKeysList = $newKeys -join ', '
        Write-Host "  new keys       : $newKeysList" -ForegroundColor Green
    }

    if ($newKeys.Count -ne $placeholderCount) {
        Write-Warning "  placeholder count ($placeholderCount) != new keys ($($newKeys.Count)); leaving file untouched."
    } elseif ($newKeys.Count -gt 0) {
        $rewritten = Rewrite-Placeholders $content $newKeys
        # UTF-8 (no BOM); preserves whatever line endings were already in $content.
        [System.IO.File]::WriteAllText($f.FullName, $rewritten, [System.Text.UTF8Encoding]::new($false))
        $rewrittenFiles += $f.FullName
        Write-Host "  rewrote        : $($f.FullName)" -ForegroundColor Green
    }

    $totalCreated += $newKeys.Count
    $totalUpdated += $updatedKeys.Count
    Write-Host ""
}

# --- Summary ------------------------------------------------------------------
Write-Host "=========================================="
Write-Host "Created : $totalCreated"
Write-Host "Updated : $totalUpdated"
Write-Host "Files rewritten : $($rewrittenFiles.Count)"
if ($DryRun) { Write-Host "Mode    : DRY-RUN (no network, no file writes)" -ForegroundColor Yellow }
