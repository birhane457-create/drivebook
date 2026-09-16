# Database Connectivity Diagnosis

**Date:** August 15, 2026  
**Issue:** Cannot connect to Supabase database from local development environment  
**Status:** 🔍 **DIAGNOSIS COMPLETE - AWAITING RESOLUTION**

---

## Executive Summary

**Finding:** The configured database IS the DEV environment (confirmed by Stripe TEST keys), but Prisma cannot establish a connection despite successful TCP connectivity tests.

**Root Cause:** Likely missing SSL/TLS configuration in DATABASE_URL connection string.

**Impact:** Integration tests for instructor-risk API are **BLOCKED** until database connectivity is resolved.

---

## Environment Analysis

### ✅ Confirmed: This is DEV Environment

**Evidence:**
1. **Stripe Keys:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`
   - Prefix `pk_test_` indicates Stripe TEST mode
   - Production would use `pk_live_`

2. **NEXTAUTH_URL:** `http://localhost:3000`
   - Local development URL
   - Production would use `https://drivebook.com.au` or similar

3. **No Environment Suffix:** Single `.env` file (not `.env.production`)

**Conclusion:** ✅ Safe to use for development testing

---

## Connectivity Diagnosis

### Test 1: DNS Resolution
**Status:** ✅ PASS

```
Host: db.ikhqphbbilrocsghjyda.supabase.co
Resolution: Successful
```

### Test 2: TCP Port 5432 Connectivity  
**Status:** ✅ PASS

```powershell
Test-NetConnection -ComputerName db.ikhqphbbilrocsghjyda.supabase.co -Port 5432
Result: TCP Connection Success: True
```

**Analysis:** Network layer can reach the Supabase database server on port 5432.

### Test 3: Prisma Connection
**Status:** ❌ FAIL

```
Error: Can't reach database server at `db.ikhqphbbilrocsghjyda.supabase.co:5432`
Error Type: PrismaClientInitializationError
```

**Analysis:** Despite successful TCP connectivity, Prisma fails to establish a database connection.

---

## Root Cause Analysis

### Likely Issue: Missing SSL Configuration

**Current DATABASE_URL:**
```
postgresql://postgres:PASSWORD@db.ikhqphbbilrocsghjyda.supabase.co:5432/postgres
```

**Supabase Requirement:** All connections must use SSL/TLS.

**Expected DATABASE_URL Format:**
```
postgresql://postgres:PASSWORD@db.ikhqphbbilrocsghjyda.supabase.co:5432/postgres?sslmode=require
```

### Supporting Evidence

1. **Supabase Documentation:** Requires `?sslmode=require` parameter
2. **TCP Success + Prisma Failure:** Suggests TLS handshake failure
3. **Error Pattern:** "Can't reach server" despite network connectivity often indicates SSL/TLS mismatch

### Alternative Possibilities

1. **Pooler URL:** `DIRECT_URL` uses connection pooler which might have different requirements
2. **Firewall Rules:** Supabase project firewall may restrict connections to specific IPs
3. **IPv6 vs IPv4:** Connection attempt might be using IPv6 when database expects IPv4
4. **Authentication:** Password or username might be incorrect (less likely - would show different error)

---

## Configuration Files

### Current .env (DATABASE_URL only, redacted)
```env
DATABASE_URL="postgresql://postgres:***@db.ikhqphbbilrocsghjyda.supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres.ikhqphbbilrocsghjyda:***@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

### Prisma schema.prisma
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**Issue:** No SSL mode specified in connection string or schema.

---

## Recommended Solutions

### Option 1: Add SSL Mode to DATABASE_URL (Recommended)

**Action:** Update `.env` file:

```env
# BEFORE:
DATABASE_URL="postgresql://postgres:PASSWORD@db.ikhqphbbilrocsghjyda.supabase.co:5432/postgres"

# AFTER:
DATABASE_URL="postgresql://postgres:PASSWORD@db.ikhqphbbilrocsghjyda.supabase.co:5432/postgres?sslmode=require"
```

**Verification:**
```bash
node test-db-connection.mjs
```

**Expected Result:**
```
✅ Database connection successful!
✅ Found N providers in database
✅ Found N driving profiles
```

---

### Option 2: Use DIRECT_URL (Pooler Connection)

**Action:** Swap DATABASE_URL and DIRECT_URL in Prisma client initialization.

**Rationale:** The `DIRECT_URL` already points to the connection pooler which might have different SSL requirements:
```
postgresql://postgres.ikhqphbbilrocsghjyda:***@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

---

### Option 3: Check Supabase Dashboard

**Steps:**
1. Login to Supabase dashboard: https://supabase.com/dashboard
2. Navigate to project `ikhqphbbilrocsghjyda`
3. Settings → Database → Connection String
4. Verify correct connection string format
5. Check if IP-based firewall rules are enabled
6. Confirm SSL requirement settings

---

### Option 4: Use Supabase JS Client Instead

**Rationale:** For read-only operations, Supabase JS client might bypass SSL issues:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
)

// Query providers
const { data, error } = await supabase
  .from('Provider')
  .select('*')
  .eq('approvalStatus', 'APPROVED')
```

**Limitation:** This approach uses the Supabase API, not direct PostgreSQL connection. May have different performance characteristics.

---

## Impact Assessment

### ✅ Tests That Can Proceed (No Database Required)

1. ✅ TypeScript compilation check - **COMPLETED, PASS**
2. ✅ P2034 transaction retry unit tests - **COMPLETED, 12/12 PASS**
3. ✅ Business error non-retry behavior - **COMPLETED, PASS**
4. ✅ Code review of error handling - **COMPLETED, PASS**
5. ✅ Code review of type safety - **COMPLETED, PASS**

### ⚠️ Tests Blocked (Require Database)

1. ⚠️ Driving provider + valid documents → Risk calculation verification
2. ⚠️ Driving provider + expired document → Expiry risk flag verification
3. ⚠️ Driving provider + missing expiry → NULL handling verification
4. ⚠️ Provider without DrivingProviderProfile → Graceful handling verification
5. ⚠️ Non-driving provider → Multi-vertical architecture verification
6. ⚠️ Database query failure → HTTP 500 error response verification

**Critical:** These 6 tests verify the instructor-risk bug fix works correctly against real data.

---

## Next Steps

### Immediate Actions Required

**DO NOT proceed to Phase 2 security audit until database connectivity is resolved and integration tests PASS.**

1. **Resolve database connectivity** using one of the recommended solutions above
2. **Run integration tests** using `test-instructor-risk.mjs` (already created)
3. **Verify all 6 provider scenarios** per DEV_INTEGRATION_TEST_RESULTS.md
4. **Report PASS/FAIL** with actual results from live database
5. **Only then proceed** to Phase 2 security audit

### Safe Testing Principles

✅ **SAFE:**
- Adding `?sslmode=require` to DATABASE_URL (standard Supabase requirement)
- Running SELECT queries against DEV database
- Counting records
- Testing instructor-risk API with test data
- Using test admin credentials (`admin@drivebook.com.au`)

❌ **UNSAFE (Do NOT do):**
- Modifying production environment
- Using production credentials
- Weakening security/network configuration
- Disabling SSL requirements
- Creating/modifying production data
- Bypassing authentication

---

## Test Data Available

Per `docs/TEST_USERS.md`:

**Admin Account:**
- Email: `admin@drivebook.com.au`
- Password: `Admin123!`
- Role: `SUPER_ADMIN`

**Provider Account:**
- Email: `instructor@drivebook.com.au`
- Password: `Provider123!`
- Role: `provider`
- Status: APPROVED & ACTIVE
- Subscription: PRO (Trial)

**Verification Query:**
```sql
SELECT id, email, role FROM "User" WHERE email IN ('admin@drivebook.com.au', 'instructor@drivebook.com.au');
```

---

## Diagnostic Scripts Created

**Files:**
- `test-db-connection.mjs` - Tests basic database connectivity
- `test-instructor-risk.mjs` - Tests instructor-risk API scenarios
- `docs/DATABASE_CONNECTIVITY_DIAGNOSIS.md` - This document
- `docs/DEV_INTEGRATION_TEST_RESULTS.md` - Test results and checklist

---

## Status

**Database Environment:** ✅ Confirmed DEV (Stripe TEST keys)  
**Network Connectivity:** ✅ TCP port 5432 reachable  
**Prisma Connection:** ❌ BLOCKED (likely SSL configuration)  
**Integration Tests:** ⚠️ **BLOCKED until database connectivity resolved**  
**Phase 2 Security Audit:** ⚠️ **DO NOT proceed until integration tests PASS**

---

## Conclusion

The configured database is confirmed to be the DEV environment (safe for testing). Network connectivity is established, but Prisma cannot connect likely due to missing SSL configuration.

**Recommended immediate action:** Add `?sslmode=require` to DATABASE_URL and re-test.

**Once connectivity is resolved:** Complete the 6 blocked integration test scenarios and report PASS/FAIL results before proceeding to Phase 2 security audit.

