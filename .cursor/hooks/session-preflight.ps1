# Cursor sessionStart hook - Tree Map Viz preflight.
#
# Fires once at the start of every agent session. Brings the three local
# dev dependencies online so the operator never has to chase them
# manually:
#   1. Docker Desktop (the daemon behind tgv-sonarqube).
#   2. The tgv-sonarqube container itself (npm run sonar:up).
#   3. The Vite dev server on port 5173 (npm run dev).
# Fire-and-forget pattern: the hook returns within a second or two even
# when Docker takes ~30-60 s to boot. The companion rule
# .cursor/rules/session-preflight.mdc tells the agent to verify
# health before doing meaningful work and to recover any gap.
# All log output is appended to .cursor/hooks/logs/preflight.log
# (gitignored via the project-wide *.log rule).

param()

$null = [Console]::In.ReadToEnd()

$root      = (Get-Location).Path
$logsDir   = Join-Path $root ".cursor\hooks\logs"
$mainLog   = Join-Path $logsDir "preflight.log"
$devLog    = Join-Path $logsDir "dev-server.log"
$helperPs1 = Join-Path $root ".cursor\hooks\start-sonar.ps1"

if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

function Write-Log($msg) {
    "$(Get-Date -Format 'o') $msg" | Add-Content -Path $mainLog -Encoding utf8
}

function Test-DockerReady {
    try {
        & docker ps 2>&1 | Out-Null
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}

function Test-PortListening([int]$port) {
    # Get-NetTCPConnection covers both v4 and v6 listeners, which matters
    # because Vite binds to ::1 by default on Windows. Returns $true iff
    # at least one socket is in the Listen state on $port.
    try {
        $hits = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop
        return ($null -ne $hits)
    } catch {
        return $false
    }
}

Write-Log "=== session-preflight starting (pwd=$root) ==="

if (Test-DockerReady) {
    Write-Log "Docker daemon already responding; skipping Docker Desktop launch."
} else {
    $dockerExe = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerExe) {
        Write-Log "Docker daemon not responding; launching '$dockerExe'."
        Start-Process -FilePath $dockerExe -ErrorAction SilentlyContinue
    } else {
        Write-Log "Docker Desktop not found at '$dockerExe' - preflight cannot bring it up; surface to operator."
    }
}

if (Test-Path $helperPs1) {
    Write-Log "Spawning sonar-up helper '$helperPs1'."
    Start-Process -FilePath "powershell" -ArgumentList @(
        "-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass",
        "-File", $helperPs1
    ) -WindowStyle Hidden -ErrorAction SilentlyContinue
} else {
    Write-Log "Helper script missing at '$helperPs1' - sonar:up will not be auto-started."
}

if (Test-PortListening 5173) {
    Write-Log "Vite dev server already listening on 5173; skipping npm run dev."
} else {
    Write-Log "Vite dev server not on 5173; spawning 'npm run dev' (log -> $devLog)."
    $devCmd = "Set-Location '$root'; npm run dev *>> '$devLog'"
    Start-Process -FilePath "powershell" -ArgumentList @(
        "-NoProfile", "-WindowStyle", "Hidden", "-Command", $devCmd
    ) -WindowStyle Hidden -ErrorAction SilentlyContinue
}

Write-Log "=== session-preflight done ==="

Write-Output '{}'
exit 0