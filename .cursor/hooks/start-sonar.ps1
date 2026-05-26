# Cursor sessionStart helper - wait for Docker, then bring up the
# tgv-sonarqube container via `npm run sonar:up`.
#
# Spawned in detached mode by session-preflight.ps1 so the main hook
# can return immediately. Polls `docker ps` every 2 s for up to 2 min,
# then runs sonar:up exactly once. Output is appended to
# .cursor/hooks/logs/sonar-up.log (gitignored).

param()

$root    = (Get-Location).Path
$logsDir = Join-Path $root ".cursor\hooks\logs"
$logFile = Join-Path $logsDir "sonar-up.log"

if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

function Write-Log($msg) {
    "$(Get-Date -Format 'o') $msg" | Add-Content -Path $logFile -Encoding utf8
}

Write-Log "=== start-sonar helper starting (pwd=$root) ==="

$dockerReady = $false
for ($i = 0; $i -lt 60; $i++) {
    & docker ps 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $dockerReady = $true
        break
    }
    Start-Sleep -Seconds 2
}

if (-not $dockerReady) {
    Write-Log "Docker never came up within 2 min; bailing out."
    exit 1
}

Write-Log "Docker ready after ${i} polls; checking sonar container."

$sonarUp = $false
try {
    $rows = & docker ps --filter "name=tgv-sonarqube" --format "{{.Names}}" 2>$null
    if ($rows -and ($rows -match "tgv-sonarqube")) { $sonarUp = $true }
} catch {}

if ($sonarUp) {
    Write-Log "tgv-sonarqube container already running; skipping sonar:up."
} else {
    Write-Log "Running 'npm run sonar:up'."
    & npm run sonar:up *>> $logFile
    Write-Log "sonar:up finished with exit $LASTEXITCODE."
}

Write-Log "=== start-sonar helper done ==="
exit 0