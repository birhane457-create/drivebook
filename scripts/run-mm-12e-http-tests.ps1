# MM-12-E HTTP Integration Test Runner
# Starts Next.js on port 3001 with isolated test DB, runs MM-12-E suite, cleans up.
#
# REQUIREMENTS:
# - Docker container drivebook-test-db running (port 5433:5432)
# - No other process on port 3001
# - prisma db push previously applied to drivebook_test
#   (includes AdminWalletIdempotencyKey table from MM-12-D migration)

$TEST_DB_URL = "postgresql://postgres:testpass@localhost:5433/drivebook_test"
$TEST_PORT   = 3001
$SERVER_LOG  = Join-Path $PSScriptRoot "..\mm-12e-server.log"
$SERVER_ERR  = Join-Path $PSScriptRoot "..\mm-12e-server-error.log"
$ENV_LOCAL   = Join-Path $PSScriptRoot "..\.env.local"

Write-Host "MM-12E: Checking drivebook-test-db container..." -ForegroundColor Cyan
try {
    $pgCheck = docker ps --filter "name=drivebook-test-db" --filter "status=running" --format "{{.Names}}"
    if ($pgCheck -ne "drivebook-test-db") {
        Write-Host "MM-12E ERROR: drivebook-test-db not running. Run: docker start drivebook-test-db" -ForegroundColor Red
        exit 1
    }
    Write-Host "MM-12E: PostgreSQL running on port 5433" -ForegroundColor Green
} catch {
    Write-Host "MM-12E ERROR: Docker check failed: $_" -ForegroundColor Red
    exit 1
}

# Apply MM-12-D migration to test DB (idempotent — safe to re-run)
Write-Host "MM-12E: Applying schema to test DB..." -ForegroundColor Cyan
$env:DATABASE_URL = $TEST_DB_URL
npx prisma db push --skip-generate 2>&1 | Select-String -Pattern "error|Error|WARN" | Out-String -Width 200
Write-Host "MM-12E: Schema ready" -ForegroundColor Green

# Write .env.local to route Next.js at the test database
$envContent = @"
DATABASE_URL="$TEST_DB_URL"
DIRECT_URL="$TEST_DB_URL"
NEXTAUTH_URL="http://localhost:$TEST_PORT"
"@
Set-Content -Path $ENV_LOCAL -Value $envContent -Encoding UTF8
Write-Host "MM-12E: .env.local written" -ForegroundColor Green

function Cleanup {
    param($ServerPid)
    if ($ServerPid -and (Get-Process -Id $ServerPid -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $ServerPid -Force
        Write-Host "MM-12E: Server stopped" -ForegroundColor Green
    }
    if (Test-Path $ENV_LOCAL) {
        Remove-Item $ENV_LOCAL -Force
        Write-Host "MM-12E: .env.local removed" -ForegroundColor Green
    }
}

# Inject env at process level so Start-Process child inherits it (PS 5.x compat)
[System.Environment]::SetEnvironmentVariable("DATABASE_URL",  $TEST_DB_URL,                 "Process")
[System.Environment]::SetEnvironmentVariable("DIRECT_URL",    $TEST_DB_URL,                 "Process")
[System.Environment]::SetEnvironmentVariable("PORT",          "$TEST_PORT",                  "Process")
[System.Environment]::SetEnvironmentVariable("NEXTAUTH_URL",  "http://localhost:$TEST_PORT", "Process")

Write-Host "MM-12E: Starting Next.js on port $TEST_PORT..." -ForegroundColor Cyan
$serverProcess = Start-Process `
    -FilePath "npm" `
    -ArgumentList "run", "dev" `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput $SERVER_LOG `
    -RedirectStandardError  $SERVER_ERR

Write-Host "MM-12E: Server PID $($serverProcess.Id)" -ForegroundColor Green
Write-Host "MM-12E: Waiting for readiness (max 90s)..." -ForegroundColor Cyan

$maxWait = 90; $waited = 0; $ready = $false
while ($waited -lt $maxWait) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$TEST_PORT/api/health" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 3; $waited += 3
    Write-Host "  ${waited}s..." -ForegroundColor DarkGray
}

if (-not $ready) {
    Write-Host "MM-12E ERROR: Server not ready after ${maxWait}s" -ForegroundColor Red
    Cleanup $serverProcess.Id; exit 1
}
Write-Host "MM-12E: Server ready at http://localhost:$TEST_PORT" -ForegroundColor Green

$testExitCode = 0
try {
    $env:DATABASE_URL    = $TEST_DB_URL
    $env:TEST_SERVER_URL = "http://localhost:$TEST_PORT"
    npm test -- __tests__/integration/mm-12e
    $testExitCode = $LASTEXITCODE
} finally {
    Cleanup $serverProcess.Id
}

if ($testExitCode -eq 0) { Write-Host "MM-12E: PASSED" -ForegroundColor Green }
else                      { Write-Host "MM-12E: FAILED (exit $testExitCode)" -ForegroundColor Red }
exit $testExitCode
