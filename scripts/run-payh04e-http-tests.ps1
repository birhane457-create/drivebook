# PAY-H-04-E Post-Fix HTTP Verification Test Runner
# Applies the PAY-H-04 migration (btree_gist + exclusion constraint),
# starts Next.js on port 3001, runs the post-fix suite, cleans up.

$TEST_DB_URL = "postgresql://postgres:testpass@localhost:5433/drivebook_test"
$TEST_PORT   = 3001
$SERVER_LOG  = Join-Path $PSScriptRoot "..\payh04e-server.log"
$SERVER_ERR  = Join-Path $PSScriptRoot "..\payh04e-server-error.log"
$ENV_LOCAL   = Join-Path $PSScriptRoot "..\.env.local"

Write-Host "PAY-H04E: Checking drivebook-test-db..." -ForegroundColor Cyan
try {
    $pgCheck = docker ps --filter "name=drivebook-test-db" --filter "status=running" --format "{{.Names}}"
    if ($pgCheck -ne "drivebook-test-db") {
        Write-Host "PAY-H04E ERROR: drivebook-test-db not running" -ForegroundColor Red; exit 1
    }
    Write-Host "PAY-H04E: PostgreSQL on port 5433" -ForegroundColor Green
} catch { Write-Host "PAY-H04E ERROR: Docker check failed: $_" -ForegroundColor Red; exit 1 }

Write-Host "PAY-H04E: Applying PAY-H-04 migration (btree_gist + exclusion constraint)..." -ForegroundColor Cyan
$env:DATABASE_URL = $TEST_DB_URL; $env:DIRECT_URL = $TEST_DB_URL
npx prisma db push --skip-generate 2>&1 | Select-String -Pattern "sync|error|Error|localhost" | Out-String -Width 200
Write-Host "PAY-H04E: Schema + constraint ready" -ForegroundColor Green

$envContent = @"
DATABASE_URL="$TEST_DB_URL"
DIRECT_URL="$TEST_DB_URL"
NEXTAUTH_URL="http://localhost:$TEST_PORT"
"@
Set-Content -Path $ENV_LOCAL -Value $envContent -Encoding UTF8

function Cleanup {
    param($ServerPid)
    if ($ServerPid -and (Get-Process -Id $ServerPid -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $ServerPid -Force
        Write-Host "PAY-H04E: Server stopped" -ForegroundColor Green
    }
    if (Test-Path $ENV_LOCAL) { Remove-Item $ENV_LOCAL -Force; Write-Host "PAY-H04E: .env.local removed" -ForegroundColor Green }
}

[System.Environment]::SetEnvironmentVariable("DATABASE_URL",  $TEST_DB_URL,                 "Process")
[System.Environment]::SetEnvironmentVariable("DIRECT_URL",    $TEST_DB_URL,                 "Process")
[System.Environment]::SetEnvironmentVariable("PORT",          "$TEST_PORT",                  "Process")
[System.Environment]::SetEnvironmentVariable("NEXTAUTH_URL",  "http://localhost:$TEST_PORT", "Process")

Write-Host "PAY-H04E: Starting Next.js on port $TEST_PORT..." -ForegroundColor Cyan
$serverProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput $SERVER_LOG -RedirectStandardError $SERVER_ERR
Write-Host "PAY-H04E: Server PID $($serverProcess.Id)" -ForegroundColor Green

$maxWait = 90; $waited = 0; $ready = $false
Write-Host "PAY-H04E: Waiting for readiness..." -ForegroundColor Cyan
while ($waited -lt $maxWait) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$TEST_PORT/api/health" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 3; $waited += 3; Write-Host "  ${waited}s..." -ForegroundColor DarkGray
}

if (-not $ready) { Write-Host "PAY-H04E ERROR: Server not ready" -ForegroundColor Red; Cleanup $serverProcess.Id; exit 1 }
Write-Host "PAY-H04E: Server ready at http://localhost:$TEST_PORT" -ForegroundColor Green

$testExitCode = 0
try {
    $env:DATABASE_URL    = $TEST_DB_URL
    $env:TEST_SERVER_URL = "http://localhost:$TEST_PORT"
    npm test -- __tests__/integration/payh04e
    $testExitCode = $LASTEXITCODE
} finally { Cleanup $serverProcess.Id }

if ($testExitCode -eq 0) { Write-Host "PAY-H04E: PASSED" -ForegroundColor Green }
else                      { Write-Host "PAY-H04E: FAILED (exit $testExitCode)" -ForegroundColor Red }
exit $testExitCode
