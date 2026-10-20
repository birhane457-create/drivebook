@echo off
setlocal enabledelayedexpansion

:: H-02 Integration Test Runner
:: Run this script from a Command Prompt where Docker Desktop is accessible.
:: It follows the reviewer's instructions exactly:
::   1. Verify container networking before running tests
::   2. Full OpenSSL diagnostic with set -e (stop on first failure)
::   3. Run both suites independently with complete output

set SCRIPT_DIR=%~dp0..
cd /d "%SCRIPT_DIR%"

echo ============================================================
echo H-02 Integration Test Runner
echo %DATE% %TIME%
echo ============================================================

:: ── Step 1: Verify Postgres container IP ──────────────────────
echo.
echo [1/5] Getting Postgres container IP...
for /f %%i in ('docker inspect -f "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" drivebook-test-db 2^>^&1') do set PG_IP=%%i

if "%PG_IP%"=="" (
    echo ERROR: Could not get container IP. Is drivebook-test-db running?
    echo Run: docker ps
    exit /b 1
)
echo Postgres container IP: %PG_IP%

:: ── Step 2: Confirm the IP responds to pg_isready ─────────────
echo.
echo [2/5] Confirming PostgreSQL is reachable at %PG_IP%:5432 ...
docker exec drivebook-test-db pg_isready -U postgres -d drivebook_test -h %PG_IP%
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: pg_isready failed. Database not accepting connections.
    exit /b 1
)
echo PostgreSQL confirmed reachable.

set DB_URL=postgresql://postgres:testpass@%PG_IP%:5432/drivebook_test

:: ── Step 3: Verify OpenSSL and Prisma compatibility (diagnostic) ─
echo.
echo [3/5] Running OpenSSL and Prisma compatibility check (Alpine)...
echo Full output — stopping at first failure (set -e):
docker run --rm --network bridge ^
  -e DATABASE_URL="%DB_URL%" ^
  -e DIRECT_URL="%DB_URL%" ^
  -v "%SCRIPT_DIR%:/app" ^
  -w /app node:20-alpine ^
  sh -c "set -e; echo '-- apk add openssl --'; apk add --no-cache openssl1.1-compat; echo '-- npm ci --'; npm ci --ignore-scripts 2>&1; echo '-- prisma generate --'; npx prisma generate 2>&1; echo '-- prisma db ping --'; node -e \"const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$queryRaw\`SELECT 1\`.then(()=>{console.log('DB OK');p.\$disconnect()}).catch(e=>{console.error('DB FAIL:',e.message);process.exit(1)})\"; echo 'COMPAT_CHECK_PASSED'"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Compatibility check failed. See output above.
    echo If openssl1.1-compat is not available, switch to node:20-bullseye-slim.
    exit /b 1
)
echo Compatibility check passed.

:: ── Step 4: Child-booking suite (10 tests) ───────────────────
echo.
echo [4/5] Running child-booking suite (H02-T01 through H02-T10)...
echo DATABASE_URL: %DB_URL%
docker run --rm --network bridge ^
  -e TEST_DATABASE_URL="%DB_URL%" ^
  -e DATABASE_URL="%DB_URL%" ^
  -e DIRECT_URL="%DB_URL%" ^
  -e NEXTAUTH_SECRET="test-secret-h02" ^
  -e STRIPE_SECRET_KEY="sk_test_stub" ^
  -e STRIPE_WEBHOOK_SECRET="whsec_stub" ^
  -e NODE_ENV="test" ^
  -v "%SCRIPT_DIR%:/app" ^
  -w /app node:20-alpine ^
  sh -c "set -e; apk add --no-cache openssl1.1-compat; npm ci --ignore-scripts; npx prisma generate; npx vitest run __tests__/integration/h02-child-booking-pricing.test.ts --reporter=verbose"
set CHILD_EXIT=%ERRORLEVEL%
echo.
echo Child-booking suite exit code: %CHILD_EXIT%

:: ── Step 5: Webhook-accounting suite (13 tests) ──────────────
echo.
echo [5/5] Running webhook-accounting suite (W01 through W12)...
docker run --rm --network bridge ^
  -e TEST_DATABASE_URL="%DB_URL%" ^
  -e DATABASE_URL="%DB_URL%" ^
  -e DIRECT_URL="%DB_URL%" ^
  -e NEXTAUTH_SECRET="test-secret-h02" ^
  -e STRIPE_SECRET_KEY="sk_test_stub" ^
  -e STRIPE_WEBHOOK_SECRET="whsec_stub" ^
  -e NODE_ENV="test" ^
  -v "%SCRIPT_DIR%:/app" ^
  -w /app node:20-alpine ^
  sh -c "set -e; apk add --no-cache openssl1.1-compat; npm ci --ignore-scripts; npx prisma generate; npx vitest run __tests__/integration/h02-webhook-package-accounting.test.ts --reporter=verbose"
set WEBHOOK_EXIT=%ERRORLEVEL%
echo.
echo Webhook-accounting suite exit code: %WEBHOOK_EXIT%

:: ── Summary ──────────────────────────────────────────────────
echo.
echo ============================================================
echo SUMMARY
echo ============================================================
echo Child-booking suite  (10 tests): exit %CHILD_EXIT%
echo Webhook-accounting suite (13 tests): exit %WEBHOOK_EXIT%
if "%CHILD_EXIT%"=="0" if "%WEBHOOK_EXIT%"=="0" (
    echo RESULT: BOTH SUITES PASSED
) else (
    echo RESULT: ONE OR BOTH SUITES FAILED — see output above
)
echo ============================================================

endlocal
