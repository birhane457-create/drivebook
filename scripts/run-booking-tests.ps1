$env:DATABASE_URL = "postgresql://postgres.zzntmozvppyzeaqautpi:REDACTED_JAPAN_DB_PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"
$env:DIRECT_URL = "postgresql://postgres.zzntmozvppyzeaqautpi:REDACTED_JAPAN_DB_PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
$env:TEST_DATABASE_URL = $env:DATABASE_URL
$env:TEST_SERVER_URL = "http://localhost:3001"
$env:NEXTAUTH_URL = "http://localhost:3001"

Write-Host "Step 1: Cleanup leftover test records..."
npx ts-node --transpile-only scripts/cleanup-test-records.ts

Write-Host "`nStep 2: Run regression tests..."
npx vitest run "__tests__/integration/booking-group-regression.test.ts" 2>&1 | Tee-Object -FilePath "booking-reg-run2.txt"
