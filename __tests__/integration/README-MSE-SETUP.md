# MSE Test Suite Database Setup

## INT-M-03A Migration Script Execution Tests

The MSE (Migration Script Execution) test suite requires an **isolated PostgreSQL database** separate from production.

### Why Isolated Database is Required

The MSE tests execute the actual production migration script (`migrate-encrypt-oauth-tokens.mjs`) as a child process. The migration script creates its own `PrismaClient` instance and reads the `DATABASE_URL` environment variable directly.

**Do NOT run MSE tests against production database.**

### Setup Options

#### Option 1: Local PostgreSQL (Recommended for Development)

1. Install PostgreSQL locally
2. Create test database:
   ```sql
   CREATE DATABASE drivebook_test;
   ```

3. Set test DATABASE_URL before running MSE tests:
   ```bash
   $env:DATABASE_URL = "postgresql://user:password@localhost:5432/drivebook_test"
   $env:OAUTH_TOKEN_ENCRYPTION_KEY = (node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
   npm test -- __tests__/integration/oauth-migration-script-execution.test.ts
   ```

4. Run Prisma migrations on test database:
   ```bash
   npx prisma migrate deploy
   ```

#### Option 2: Docker PostgreSQL

1. Start PostgreSQL container:
   ```bash
   docker run --name drivebook-test-db \
     -e POSTGRES_PASSWORD=testpass \
     -e POSTGRES_DB=drivebook_test \
     -p 5433:5432 \
     -d postgres:15
   ```

2. Set test DATABASE_URL:
   ```bash
   $env:DATABASE_URL = "postgresql://postgres:testpass@localhost:5433/drivebook_test"
   ```

3. Run migrations and tests as above

#### Option 3: Supabase Test Project

1. Create separate Supabase project for testing
2. Get connection string from Supabase dashboard
3. Set test DATABASE_URL with test project connection string
4. **Never use production Supabase database for MSE tests**

### Test Execution Requirements

The MSE tests require:
- ✅ Isolated PostgreSQL database (not production)
- ✅ DATABASE_URL environment variable set to test database
- ✅ OAUTH_TOKEN_ENCRYPTION_KEY environment variable set
- ✅ Prisma schema migrated to test database
- ✅ Database accessible from both test process and child migration script

### Current Blocker

**MSE-1 failure** is caused by the migration script attempting to connect to production Supabase:
```
Can't reach database server at db.ikhqphbbilrocsghjyda.supabase.co:5432
```

This is expected behavior because:
1. Test fixtures are created via Prisma in the test process
2. Migration script spawns as child process with its own Prisma client
3. Child process reads DATABASE_URL (currently set to production)
4. Production database is not accessible from test environment

### Solution

Configure test-specific DATABASE_URL before running MSE suite:

```powershell
# Set test database
$env:DATABASE_URL = "postgresql://localhost:5432/drivebook_test"

# Set encryption key
$env:OAUTH_TOKEN_ENCRYPTION_KEY = (node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# Run MSE tests
npm test -- __tests__/integration/oauth-migration-script-execution.test.ts
```

### Test Database Lifecycle

The MSE tests:
1. Create test providers with plaintext tokens (via Prisma)
2. Execute migration script as child process (reads DATABASE_URL)
3. Verify database state after migration (via Prisma)
4. Clean up test data in afterEach

**Important:** Both the test process and child migration process must connect to the **same test database**.

### Security Note

The isolated test database should:
- ✅ Contain only test data (no production data)
- ✅ Use separate credentials from production
- ✅ Be disposable (can be dropped/recreated)
- ✅ Not be accessible from production environment

---

## Audit Requirement

Per independent audit finding, INT-M-03A requires:

> "The proper solution is an isolated PostgreSQL database and an explicitly supplied DATABASE_URL for the child migration process. Do not point this migration test at production."

This setup document addresses that requirement.
