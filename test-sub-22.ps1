# SUB-22 Concurrency Test Runner
# Spins up isolated PostgreSQL, runs migrations, executes tests

Write-Host "SUB-22 Concurrency Verification" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Start PostgreSQL
Write-Host "[1/6] Starting PostgreSQL test container..." -ForegroundColor Yellow
docker-compose -f docker-compose.test.yml up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start PostgreSQL container" -ForegroundColor Red
    exit 1
}

# Step 2: Wait for PostgreSQL to be ready
Write-Host "[2/6] Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

$retries = 0
$maxRetries = 30
while ($retries -lt $maxRetries) {
    docker exec drivebook-test-db pg_isready -U testuser -d drivebook_test 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "PostgreSQL is ready!" -ForegroundColor Green
        break
    }
    $retries++
    Write-Host "  Waiting... ($retries/$maxRetries)" -ForegroundColor Gray
    Start-Sleep -Seconds 2
}

if ($retries -eq $maxRetries) {
    Write-Host "PostgreSQL failed to become ready" -ForegroundColor Red
    docker-compose -f docker-compose.test.yml logs
    exit 1
}

# Step 3: Load test environment
Write-Host "[3/6] Loading test environment..." -ForegroundColor Yellow
Get-Content .env.test | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        Write-Host "  Set $($matches[1])" -ForegroundColor Gray
    }
}

# Step 4: Run Prisma migration
Write-Host "[4/6] Running Prisma migrations..." -ForegroundColor Yellow
$env:DATABASE_URL = "postgresql://testuser:testpass@localhost:5433/drivebook_test"
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "Migration failed" -ForegroundColor Red
    docker-compose -f docker-compose.test.yml down
    exit 1
}

# Step 5: Verify indexes
Write-Host "[5/6] Verifying partial unique indexes..." -ForegroundColor Yellow
$indexQuery = @"
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'Subscription' 
    AND indexname LIKE '%unique%'
ORDER BY indexname;
"@

docker exec -i drivebook-test-db psql -U testuser -d drivebook_test -c $indexQuery

# Step 6: Run tests
Write-Host "[6/6] Running SUB-22 concurrency tests..." -ForegroundColor Yellow
Write-Host ""
npm test sub-22-concurrent

$testResult = $LASTEXITCODE

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan

if ($testResult -eq 0) {
    Write-Host "SUB-22 tests PASSED" -ForegroundColor Green
} else {
    Write-Host "SUB-22 tests FAILED" -ForegroundColor Red
}

Write-Host ""
Write-Host "To inspect the database:" -ForegroundColor Yellow
Write-Host "  docker exec -it drivebook-test-db psql -U testuser -d drivebook_test" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop the test database:" -ForegroundColor Yellow
Write-Host "  docker-compose -f docker-compose.test.yml down" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop and remove all data:" -ForegroundColor Yellow
Write-Host "  docker-compose -f docker-compose.test.yml down -v" -ForegroundColor Gray
Write-Host ""

exit $testResult
