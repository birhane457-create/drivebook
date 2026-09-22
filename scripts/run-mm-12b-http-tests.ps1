# MM-12-B HTTP Integration Test Runner
#
# This script:
# 1. Verifies isolated PostgreSQL is running on port 5433
# 2. Creates .env.local to override DATABASE_URL for Next.js
# 3. Starts Next.js dev server on port 3001
# 4. Waits for server to be ready
# 5. Runs HTTP integration tests
# 6. Cleans up server process and .env.local
#
# REQUIREMENTS:
# - Docker container drivebook-test-db running (port 5433:5432)
# - No other process using port 3001

$ErrorActionPreference = "Stop"

$TEST_DB_URL  = "postgresql://postgres:testpass@localhost:5433/drivebook_test"
$TEST_PORT    = 3001
$ENV_LOCAL    = Join-Path $PSScriptRoot "..\\.env.local"
$SERVER_LOG   = Join-Path $PSScriptRoot "..\\mm-12b-server.log"
$SERVER_ERR   = Join-Path $PSScriptRoot "..\\mm-12b-server-error.log"

# --- 1. Verify PostgreSQL container ---
Write-Host "MM-12B: Checking drivebook-test-db container..." -ForegroundColor Cyan
try {
    $pgCheck = docker ps --filter "name=drivebook-test-db" --filter "status=running" --format "{{.Names}}"
    if ($pgCheck -ne "drivebook-test-db") {
        Write-Host "MM-12B ERROR: drivebook-test-db is not running. Run: docker start drivebook-test-db" -ForegroundColor Red
        exit 1
    }
    Write-Host "MM-12B: PostgreSQL container running on port 5433" -ForegroundColor Green
} catch {
    Write-Host "MM-12B ERROR: Docker check failed: $_" -ForegroundColor Red
    exit 1
}

# --- 2. Write .env.local to override DATABASE_URL for Next.js ---
# Next.js env loading order: .env.local > .env.$(NODE_ENV).local > .env.$(NODE_ENV) > .env
# .env.local is not committed and overrides production values.
Write-Host "MM-12B: Writing .env.local to point Next.js at test database..." -ForegroundColor Cyan

$envLocalContent = @"
# MM-12-B test run -- injected by run-mm-12b-http-tests.ps1
# Overrides production values from .env for isolated test execution.
DATABASE_URL="$TEST_DB_URL"
DIRECT_URL="$TEST_DB_URL"
# NEXTAUTH_URL must match the server port so CSRF validation passes.
NEXTAUTH_URL="http://localhost:$TEST_PORT"
"@

Set-Content -Path $ENV_LOCAL -Value $envLocalContent -Encoding UTF8
Write-Host "MM-12B: .env.local written" -ForegroundColor Green

# Cleanup function — called on script exit (success or failure)
function Cleanup {
    param($ServerPid)
    Write-Host "MM-12B: Cleaning up..." -ForegroundColor Cyan
    if ($ServerPid -and (Get-Process -Id $ServerPid -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $ServerPid -Force
        Write-Host "MM-12B: Server process stopped" -ForegroundColor Green
    }
    if (Test-Path $ENV_LOCAL) {
        Remove-Item $ENV_LOCAL -Force
        Write-Host "MM-12B: .env.local removed" -ForegroundColor Green
    }
}

# --- 3. Start Next.js server ---
Write-Host "MM-12B: Starting Next.js dev server on port $TEST_PORT..." -ForegroundColor Cyan

# Set environment variables at the process level so Start-Process inherits them.
# (PowerShell 5.x $env: assignments are session-scope only and not inherited by child processes
# launched with Start-Process. SetEnvironmentVariable at Process scope IS inherited.)
[System.Environment]::SetEnvironmentVariable("DATABASE_URL",  $TEST_DB_URL,             "Process")
[System.Environment]::SetEnvironmentVariable("DIRECT_URL",    $TEST_DB_URL,             "Process")
[System.Environment]::SetEnvironmentVariable("PORT",          "$TEST_PORT",              "Process")
[System.Environment]::SetEnvironmentVariable("NEXTAUTH_URL",  "http://localhost:$TEST_PORT", "Process")

$serverProcess = Start-Process `
    -FilePath "npm" `
    -ArgumentList "run", "dev" `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput $SERVER_LOG `
    -RedirectStandardError  $SERVER_ERR

Write-Host "MM-12B: Server started (PID: $($serverProcess.Id))" -ForegroundColor Green

# --- 4. Wait for /api/health to respond ---
Write-Host "MM-12B: Waiting for server readiness (max 90s)..." -ForegroundColor Cyan
$maxWait   = 90
$waited    = 0
$serverOk  = $false

while ($waited -lt $maxWait) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$TEST_PORT/api/health" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) {
            $serverOk = $true
            break
        }
    } catch {
        # not ready yet
    }
    Start-Sleep -Seconds 3
    $waited += 3
    Write-Host "  waited ${waited}s..." -ForegroundColor DarkGray
}

if (-not $serverOk) {
    Write-Host "MM-12B ERROR: Server not ready after ${maxWait}s. Check mm-12b-server.log" -ForegroundColor Red
    Cleanup $serverProcess.Id
    exit 1
}

Write-Host "MM-12B: Server ready at http://localhost:$TEST_PORT" -ForegroundColor Green

# --- 5. Run tests ---
Write-Host "MM-12B: Running HTTP integration tests..." -ForegroundColor Cyan
$testExitCode = 0

try {
    $env:DATABASE_URL    = $TEST_DB_URL
    $env:TEST_SERVER_URL = "http://localhost:$TEST_PORT"
    npm test -- __tests__/integration/mm-12b-http
    $testExitCode = $LASTEXITCODE
} finally {
    Cleanup $serverProcess.Id
}

# --- 6. Report ---
if ($testExitCode -eq 0) {
    Write-Host "MM-12B: Tests PASSED" -ForegroundColor Green
} else {
    Write-Host "MM-12B: Tests FAILED (exit $testExitCode)" -ForegroundColor Red
}

exit $testExitCode
