# ✅ SUPERADMIN User Check

## Test Users Documentation

According to **docs/TEST_USERS.md**, there is a SUPERADMIN account configured:

### SUPERADMIN Credentials
- **Email:** admin@drivebook.com.au
- **Password:** Admin123!
- **Role:** SUPER_ADMIN (note the underscore)
- **Status:** Email Verified ✅

### How to Create/Verify

If the user doesn't exist, run this script:
\\\ash
node scripts/register-test-users.mjs
\\\

This script is **idempotent** (safe to re-run) and will:
1. Check if admin@drivebook.com.au exists
2. Create it if it doesn't exist
3. Skip creation if it already exists

### Access
- Admin dashboard: http://localhost:3000/admin
- All admin features unlocked
- Can access /admin/cancellations (our new page!)

---

## Role Name Inconsistency Found ⚠️

The codebase uses **TWO different role values**:

1. **SUPERADMIN** (no underscore)
   - Used in: scripts/register-test-users.ts
   - Used in: docs/TEST_USERS.md

2. **SUPER_ADMIN** (with underscore)
   - Used in: lib/auth/requireRole.ts
   - Used in: lib/rbac/checkPermission.ts
   - Used in: app/api/*/route.ts (most API endpoints)

### Recommendation
The system **should standardize** on one value. Based on grep results:
- **SUPER_ADMIN** (with underscore) is used in ~20+ files
- **SUPERADMIN** (no underscore) is used in ~2 files

**Action:** Update the test user registration script to use **SUPER_ADMIN** instead of **SUPERADMIN**.

---

## Quick Test

To verify the admin user exists and can access the cancellations page:

1. **Login:**
   - Go to: http://localhost:3000/login
   - Email: admin@drivebook.com.au
   - Password: Admin123!

2. **Access Admin Dashboard:**
   - Should redirect to: /admin
   - Look for "Finance" section in nav
   - Click "Cancellations" 🔄

3. **Verify Permissions:**
   - Page should load (not redirect or error)
   - Shows 3 tabs: Pending | Approved | Rejected
   - Initially empty (no cancellation requests yet)

---

## Fix Role Inconsistency

**Option 1: Update the registration script**
\\\	ypescript
// In scripts/register-test-users.ts, change line 35:
role: 'SUPER_ADMIN',  // was 'SUPERADMIN'
\\\

**Option 2: Update the database directly**
\\\sql
UPDATE "User" 
SET role = 'SUPER_ADMIN' 
WHERE email = 'admin@drivebook.com.au' AND role = 'SUPERADMIN';
\\\

**Option 3: Delete and recreate**
\\\sql
DELETE FROM "User" WHERE email = 'admin@drivebook.com.au';
\\\
Then run: \
ode scripts/register-test-users.mjs\ (after fixing the script)

---

## Current Status

- ✅ Admin credentials documented
- ✅ Admin routes implemented (/admin/cancellations)
- ✅ Role checks in API endpoints use SUPER_ADMIN
- ⚠️  Role value inconsistency (SUPERADMIN vs SUPER_ADMIN)
- ❓ Need to verify user exists in database

**Next Step:** Run the registration script or manually verify the user exists with the correct role.
