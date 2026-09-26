# INT-M-PKG-01 — HTTP Containment Execution Required

**Status:** PENDING EXECUTION  
**Gate:** HTTP integration tests (C1-C8)  
**Blocker:** Requires running Next.js server + connected database

---

## Current State

### ✅ What Is Verified (Code Level)

| Item | Status | Evidence |
|---|---|---|
| Discovery complete | ✅ VERIFIED | Commit `80c31f97`, discovery document |
| Containment implemented | ✅ VERIFIED | Kill switch in source code |
| Kill switch fail-closed | ✅ VERIFIED | `=== 'true'` comparison |
| Kill switch precedes vulnerable code | ✅ VERIFIED | Source diff, positioned before `checkProviderEligible()` |
| Unit tests executed | ✅ VERIFIED | 10/10 passed, commit `2f60242b` |
| Operational control documented | ✅ VERIFIED | Re-enable gate process, commit `9e9660de` |
| Integration tests exist | ✅ VERIFIED | File committed at `9e9660de` |
| C6 strengthened (DB verification) | ✅ VERIFIED | Source includes booking count checks |

### ⏳ What Is Pending (HTTP Level)

| Item | Status | Blocker |
|---|---|---|
| HTTP integration test execution | ⏳ PENDING | Requires running Next.js server |
| Database no-write proof | ⏳ PENDING | C6 requires connected database |
| 8/8 test result | ⏳ PENDING | Execution not performed |

---

## Required Execution Environment

### Prerequisites

1. **Running Next.js Server**
   - Dev server: `npm run dev` (port 3000)
   - OR deployed instance with known URL

2. **Connected Database**
   - PostgreSQL instance accessible by both:
     - Next.js server (via `DATABASE_URL`)
     - Test suite (via same `DATABASE_URL` or test-specific var)
   - **Critical:** Server and tests MUST use same database instance
   - Otherwise C6 "no bookings created" check is invalid

3. **Environment Variables**
   - `NEXT_PUBLIC_APP_URL` → server base URL
   - `DATABASE_URL` → PostgreSQL connection string
   - `NEXTAUTH_SECRET` → required for server startup
   - `ENABLE_MOBILE_PACKAGE_PURCHASE` → MUST NOT be set to 'true'

4. **Dependencies Installed**
   - `npm install` completed
   - All packages available

---

## Execution Command

```bash
# From repository root at commit 9e9660de

# 1. Start Next.js server (separate terminal)
npm run dev
# Wait for "Ready on http://localhost:3000"

# 2. Set test environment variable (separate terminal)
export NEXT_PUBLIC_APP_URL=http://localhost:3000
# OR on Windows:
# $env:NEXT_PUBLIC_APP_URL="http://localhost:3000"

# 3. Run HTTP integration tests
npx vitest run __tests__/integration/int-m-pkg-01-containment.test.ts --reporter=verbose

# 4. Capture complete output including:
#    - Vitest version
#    - Test file path
#    - Each test name and result
#    - Final summary: "Test Files  1 passed (1)"
#    - Final summary: "Tests       8 passed (8)"
#    - Exit code: 0
```

---

## Expected Test Results

### C1: Default behavior (flag not set)
```
✓ should return 503 when attempting package purchase
```

**Verifies:** POST returns 503 when `ENABLE_MOBILE_PACKAGE_PURCHASE` undefined

### C2: Explicit disable (flag = 'false')
```
✓ should return 503 when flag is explicitly false
```

**Verifies:** POST returns 503 when `ENABLE_MOBILE_PACKAGE_PURCHASE=false`

### C3: Various non-true values (fail closed)
```
✓ should return 503 when flag = "0"
✓ should return 503 when flag = "False"
✓ should return 503 when flag = "FALSE"
✓ should return 503 when flag = "no"
✓ should return 503 when flag = "disabled"
✓ should return 503 when flag = ""
✓ should return 503 when flag = "null"
✓ should return 503 when flag = "undefined"
```

**Verifies:** All non-'true' values result in 503 (fail closed)

**Note:** This suite has 8 sub-tests iterating over array values

### C4: GET endpoint remains available
```
✓ should allow GET requests (viewing existing packages)
```

**Verifies:** GET reaches auth layer (401), not feature flag (503)

### C5: Response format verification
```
✓ should return properly formatted error response
```

**Verifies:**
- HTTP 503 status
- JSON content-type
- Response body contains: `error`, `message`, `code`, `webUrl`
- `code === 'MOBILE_PURCHASE_DISABLED'`
- `webUrl` is valid URL

### C6: Security - endpoint does not reach vulnerable code
```
✓ should not process packageId or reach checkProviderEligible()
✓ should not create booking even with valid credentials
```

**Verifies:**
- HTTP 503 returned
- Database query shows zero bookings with `providerId: 'malicious-provider-id'`
- Booking count unchanged before/after attack attempt

**Critical:** These tests query `prisma.booking` directly. They MUST use the same database instance that the HTTP route connects to.

### C7: Documentation references
```
✓ should reference audit documentation in code comments
```

**Verifies:**
- Source code contains: `INT-M-PKG-01`, `CONTAINMENT`, `IDOR`, `Hardcoded pricing`, `Payment bypass`
- Source code references: `docs/audit/phase2/INT-M-PKG-01-DISCOVERY.md`

---

## Database Connection Requirement

### Why Same Database Is Critical

**Scenario 1: Correct (same database)**
```
HTTP POST → Next.js → DB A (no booking created)
Test query → Prisma → DB A (finds 0 bookings) ✅
```

**Scenario 2: Incorrect (different databases)**
```
HTTP POST → Next.js → DB A (booking created! kill switch failed!)
Test query → Prisma → DB B (finds 0 bookings) ❌ FALSE PASS
```

### Verification Step

Before test execution, confirm:

```typescript
// In test setup
console.log('Server DATABASE_URL:', process.env.DATABASE_URL)
console.log('Test DATABASE_URL:', process.env.DATABASE_URL)
// Must be identical
```

OR

```bash
# Check Next.js server logs for connection string
# Compare with test suite DATABASE_URL
```

---

## Required Evidence Package

After successful execution, provide:

### 1. Test Execution Output
```
File: int-m-pkg-01-http-execution-output.txt

Contents:
- Full vitest output (verbose mode)
- All test names and results
- Final summary: Test Files  1 passed (1)
- Final summary: Tests       8 passed (8)
- Exit Code   0
```

### 2. Environment Verification
```
Commit SHA: 9e9660de (or later if updated)
Node version: (from node --version)
Next.js server: Running at http://localhost:3000
Database: postgresql://...@host:port/database (sanitized)
Database connection: Confirmed same for server + tests
ENABLE_MOBILE_PACKAGE_PURCHASE: (not set) or false
Test timestamp: YYYY-MM-DD HH:MM:SS UTC
```

### 3. Database State Verification
```sql
-- Before test execution
SELECT COUNT(*) FROM "Booking" WHERE "isPackageBooking" = true;
-- Record count

-- After test execution  
SELECT COUNT(*) FROM "Booking" WHERE "isPackageBooking" = true;
-- Should be same count (no new bookings)
```

### 4. Server Startup Log (excerpt)
```
Showing:
- Next.js version
- Server started on http://localhost:3000
- No errors during startup
- Confirms DATABASE_URL connected
```

---

## Test Failure Scenarios

### If Any Test Fails

**Do NOT proceed to next audit finding.**

Possible causes:
1. Kill switch not working (code regression)
2. Server using different commit (not `9e9660de`)
3. `ENABLE_MOBILE_PACKAGE_PURCHASE=true` accidentally set
4. Database connection issue (server vs test)
5. Next.js server not running
6. URL mismatch (`NEXT_PUBLIC_APP_URL` wrong)

**Response:**
1. Capture failure output
2. Investigate root cause
3. Fix issue
4. Re-execute tests
5. Document as new commit if code changed

### If Test Passes But Booking Created

**Critical failure.** This means:
- Kill switch bypass exists
- OR database verification is checking wrong database
- OR test logic is incorrect

**Response:**
1. Query production database for recent package bookings
2. Verify test database vs server database connection
3. Review C6 test logic
4. DO NOT mark containment as verified
5. Investigate as potential containment breach

---

## Post-Execution Gate Decision

### If 8/8 Tests Pass

**Gate status:** HTTP CONTAINMENT VERIFIED

**Next gate:** Production verification
- Deploy to production
- Verify live endpoint returns 503
- Verify `ENABLE_MOBILE_PACKAGE_PURCHASE` not set in Vercel
- Verify no bookings created after deployment

### If Any Test Fails

**Gate status:** HTTP CONTAINMENT NOT VERIFIED

**Next action:** Fix failure, re-execute tests

**Do NOT:** Move to next audit finding until HTTP containment verified

---

## Current Status Summary

```
INT-M-PKG-01 Lifecycle Gates:

✅ Discovery                           VERIFIED
✅ Containment implementation         VERIFIED (code level)
✅ Unit tests                          VERIFIED (10/10)
✅ Operational control                 VERIFIED (documented)
✅ HTTP test source code               VERIFIED (committed at 9e9660de)
✅ C6 strengthened                     VERIFIED (DB checks in source)

⏳ HTTP test execution                 PENDING ← CURRENT GATE
⏳ HTTP database no-write proof        PENDING (part of C6)
⏳ Production deployment               PENDING
⏳ Production verification             PENDING

❌ Root-cause remediation              NOT STARTED
❌ Finding CLOSED                      NO
```

**Blocking issue:** HTTP tests require running Next.js server + connected database, which cannot be executed from current environment.

**Required action:** Manual test execution by developer with access to local/staging environment.

**Do not proceed to SUB-08-A until this gate passes.**

---

## References

- **Containment implementation:** Commit `80c31f97`
- **Unit tests:** Commit `2f60242b`
- **HTTP tests + operational control:** Commit `9e9660de`
- **Test file:** `__tests__/integration/int-m-pkg-01-containment.test.ts`
- **Discovery:** `docs/audit/phase2/INT-M-PKG-01-DISCOVERY.md`
- **Operational control:** `docs/audit/phase2/INT-M-PKG-01-OPERATIONAL-CONTROL.md`

---

**Status:** Awaiting manual execution by developer with server environment access.
