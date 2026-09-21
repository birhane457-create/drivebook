@echo off
REM INT-M-03A MSE Test Execution Script
REM Requires: Docker Desktop running

echo === INT-M-03A MSE Test Suite Execution ===
echo.

REM Step 1: Check Docker
echo [Step 1] Checking Docker...
docker ps >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker Desktop is not running
    echo Please start Docker Desktop and run this script again
    exit /b 1
)
echo OK: Docker is running
echo.

REM Step 2: Remove old container if exists
echo [Step 2] Setting up isolated PostgreSQL database...
docker ps -a --filter "name=drivebook-test-db" --format "{{.Names}}" | findstr "drivebook-test-db" >nul 2>&1
if not errorlevel 1 (
    echo Removing existing container...
    docker rm -f drivebook-test-db >nul 2>&1
)

REM Create new container
docker run --name drivebook-test-db -e POSTGRES_PASSWORD=testpass -e POSTGRES_DB=drivebook_test -p 5433:5432 -d postgres:15
if errorlevel 1 (
    echo ERROR: Failed to create database container
    exit /b 1
)
echo OK: Database container created
echo Waiting for PostgreSQL to be ready...
timeout /t 5 /nobreak >nul
echo.

REM Step 3: Navigate to repository
echo [Step 3] Navigating to repository...
cd /d "e:\DOC\flowstate-wms\AI voice assistance - Copy - Copy - Copy\drivebook"
if errorlevel 1 (
    echo ERROR: Repository path not found
    exit /b 1
)
echo OK: Located at %CD%
echo.

REM Step 4: Backup .env file (prevents production database access)
echo [Step 4] Backing up .env file...
if exist .env (
    copy /Y .env .env.mse.backup >nul
    del /f .env
    echo OK: .env backed up and removed
) else (
    echo OK: No .env file found
)
echo.

REM Step 5: Set environment variables
echo [Step 5] Configuring environment...
set DATABASE_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test
set DIRECT_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test
echo OK: DATABASE_URL and DIRECT_URL set
for /f %%i in ('node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"') do set OAUTH_TOKEN_ENCRYPTION_KEY=%%i
echo OK: OAUTH_TOKEN_ENCRYPTION_KEY generated
echo.

REM Step 6: Apply Prisma schema to database
echo [Step 6] Syncing Prisma schema to database...
call npx prisma db push --skip-generate
if errorlevel 1 (
    echo ERROR: Prisma db push failed
    goto RESTORE_ENV
)
echo OK: Schema synced
echo.

REM Step 7: Regenerate Prisma Client
echo [Step 7] Regenerating Prisma Client...
call npx prisma generate
if errorlevel 1 (
    echo ERROR: Prisma generate failed
    goto RESTORE_ENV
)
echo OK: Prisma Client regenerated
echo.

REM Step 6: Record metadata
echo [Step 6] Recording test metadata...
for /f %%i in ('git rev-parse HEAD') do set COMMIT_SHA=%%i
echo Commit SHA: %COMMIT_SHA%
echo Timestamp: %DATE% %TIME%
echo Database: postgresql://localhost:5433/drivebook_test
echo.

REM Step 7: Run MSE tests
echo [Step 7] Running MSE test suite...
echo ========================================
call npx vitest run __tests__/integration/oauth-migration-script-execution.test.ts --reporter=verbose > mse-execution-output.txt 2>&1
set TEST_EXIT_CODE=%errorlevel%
type mse-execution-output.txt
echo ========================================
echo.
echo Test execution completed with exit code: %TEST_EXIT_CODE%
echo Full output saved to: mse-execution-output.txt
echo.

REM Step 8: Restore .env file
:RESTORE_ENV
echo [Step 8] Restoring .env file...
if exist .env.mse.backup (
    copy /Y .env.mse.backup .env >nul
    del /f .env.mse.backup
    echo OK: .env restored
) else (
    echo OK: No backup to restore
)
echo.

REM Step 9: Show summary
echo [Summary]
echo Commit: %COMMIT_SHA%
echo Database: Isolated PostgreSQL (localhost:5433)
echo Exit Code: %TEST_EXIT_CODE%
echo Output File: mse-execution-output.txt
echo.

exit /b %TEST_EXIT_CODE%
