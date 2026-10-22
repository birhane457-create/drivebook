# h02-full-run.ps1
# Complete H-02 test runner using Kiro.exe as Node runtime.
# Run AFTER setup-postgres-portable.ps1 has PostgreSQL running.
# No Docker, no separate Node install required.

$DB         = "e:\DOC\flowstate-wms\AI voice assistance - Copy - Copy - Copy\drivebook"
$KIRO       = "$env:LOCALAPPDATA\Programs\Kiro\Kiro.exe"
$VITEST     = "$DB\node_modules\vitest\vitest.mjs"
$VITCFG     = "$DB\vitest.config.ts"
$PRISMA_CLI = "$DB\node_modules\prisma\build\index.js"

$DB_URL     = "postgresql://postgres:testpass@localhost:5433/drivebook_test"
$ENV_VARS   = @{
    ELECTRON_RUN_AS_NODE  = "1"
    DATABASE_URL          = $DB_URL
    DIRECT_URL            = $DB_URL
    TEST_DATABASE_URL     = $DB_URL
    STRIPE_SECRET_KEY     = "sk_test_stub"
    STRIPE_WEBHOOK_SECRET = "whsec_stub"
    NEXTAUTH_SECRET       = "test-secret-h02"
    NEXTAUTH_URL          = "http://localhost:3000"
    NODE_ENV              = "test"
    SMTP_HOST             = "localhost"
    SMTP_PORT             = "1025"
    SMTP_USER             = "test"
    SMTP_PASS             = "test"
    ADMIN_EMAIL           = "admin@test.com"
    NODE_OPTIONS          = "--no-experimental-require-module"
}

foreach ($kv in $ENV_VARS.GetEnumerator()) {
    [System.Environment]::SetEnvironmentVariable($kv.Key, $kv.Value, "Process")
}

Write-Host ""
Write-Host "============================================================"
Write-Host "H-02 Integration Test Runner"
Write-Host (Get-Date)
Write-Host "Node: $KIRO"
Write-Host "DB:   $DB_URL"
Write-Host "============================================================"

# 1. Verify DB connectivity
Write-Host ""
Write-Host "[1/4] Verifying PostgreSQL connectivity..."
$dbCheck = & $KIRO "$DB\scripts\test-pg-connect.mjs" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "DB connectivity check failed:"
    $dbCheck | ForEach-Object { Write-Host "  $_" }
    Write-Error "PostgreSQL is not reachable. Run setup-postgres-portable.ps1 first."
    exit 1
}
$dbCheck | ForEach-Object { Write-Host "  $_" }
Write-Host "[1/4] Database reachable."

# 2. Push schema
Write-Host ""
Write-Host "[2/4] Pushing Prisma schema..."
& $KIRO $PRISMA_CLI db push --skip-generate --accept-data-loss 2>&1 | ForEach-Object { Write-Host "  $_" }
if ($LASTEXITCODE -ne 0) { Write-Error "prisma db push failed"; exit 1 }
Write-Host "[2/4] Schema pushed."

# 3. Child-booking suite (10 tests)
Write-Host ""
Write-Host "[3/4] Running child-booking suite (H02-T01..T10)..."
Write-Host "------------------------------------------------------------"
& $KIRO $VITEST run --config $VITCFG `
    "__tests__/integration/h02-child-booking-pricing.test.ts" `
    --reporter=verbose 2>&1 | ForEach-Object { Write-Host $_ }
$CHILD_EXIT = $LASTEXITCODE
Write-Host ""
Write-Host "Child-booking suite exit: $CHILD_EXIT"

# 4. Webhook-accounting suite (13 tests)
Write-Host ""
Write-Host "[4/4] Running webhook-accounting suite (W01..W12 + W11b)..."
Write-Host "------------------------------------------------------------"
& $KIRO $VITEST run --config $VITCFG `
    "__tests__/integration/h02-webhook-package-accounting.test.ts" `
    --reporter=verbose 2>&1 | ForEach-Object { Write-Host $_ }
$WEBHOOK_EXIT = $LASTEXITCODE
Write-Host ""
Write-Host "Webhook-accounting suite exit: $WEBHOOK_EXIT"

# Summary
Write-Host ""
Write-Host "============================================================"
Write-Host "SUMMARY — $(Get-Date)"
Write-Host "============================================================"
Write-Host "Child-booking suite     (10 tests): exit $CHILD_EXIT"
Write-Host "Webhook-accounting suite (13 tests): exit $WEBHOOK_EXIT"
if ($CHILD_EXIT -eq 0 -and $WEBHOOK_EXIT -eq 0) {
    Write-Host "RESULT: BOTH SUITES PASSED"
    exit 0
} else {
    Write-Host "RESULT: ONE OR BOTH SUITES FAILED"
    exit 1
}
