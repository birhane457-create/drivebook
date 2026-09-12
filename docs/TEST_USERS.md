# Test User Credentials

**Status:** ✅ Current  
**Last Updated:** 2026-09-01  
**Last Verified:** 2026-09-01  
**Script:** `scripts/register-test-users.mjs`

---

## 🔐 Super Admin

**Purpose:** Full system administration access

| Field | Value |
|-------|-------|
| **Email** | `admin@drivebook.com.au` |
| **Password** | `Admin123!` |
| **Role** | `SUPER_ADMIN` |
| **Status** | Email Verified ✅ |

**Access:**
- Admin dashboard: `/admin`
- Full access to all admin features
- Can approve/reject providers
- Manage platform settings (`/admin/pricing`)
- View all bookings, revenue, analytics

---

## 👤 Provider (Driving Instructor)

**Purpose:** Test provider/instructor account

| Field | Value |
|-------|-------|
| **Email** | `instructor@drivebook.com.au` |
| **Password** | `Provider123!` |
| **Name** | John Smith |
| **Phone** | +61412345678 |
| **Role** | `provider` |
| **Status** | APPROVED & ACTIVE ✅ |

**Business Details:**
- **Business Model:** `MARKETPLACE` (driving instructor)
- **Payment Mode:** `PLATFORM`
- **Account Type:** `INDIVIDUAL`
- **Base Address:** Sydney CBD, NSW 2000
- **Service Radius:** 20km
- **Hourly Rate:** \$65

**Subscription:**
- **Tier:** `PRO` (Trial)
- **Trial Duration:** 14 days
- **Features:** All PRO tier features unlocked

**Access:**
- Provider dashboard: `/dashboard`
- Manage bookings: `/dashboard/bookings`
- Schedule: `/dashboard/schedule`
- Clients: `/dashboard/clients`
- Analytics: `/dashboard/analytics`
- Earnings: `/dashboard/earnings`

---

## 🔗 Routes (Verified 2026-09-01)

| Route | Purpose | File |
|-------|---------|------|
| `/` | Homepage | `app/page.tsx` |
| `/login` | Login page | `app/login/page.tsx` |
| `/register` | Registration | `app/register/page.tsx` |
| `/admin` | Admin dashboard | `app/admin/page.tsx` |
| `/dashboard` | Provider dashboard | `app/dashboard/page.tsx` |
| `/book` | Booking page (redirects to `/instructors`) | `app/book/page.tsx` |
| `/instructors` | Instructor directory | `app/instructors/page.tsx` |

---

## 🚀 Quick Start

### Create Test Users

Run this script to create both accounts (idempotent - safe to re-run):

\\\ash
node scripts/register-test-users.mjs
\\\

**What the script does:**
1. Checks if users already exist
2. Creates users if they don't exist
3. Skips creation if they already exist
4. Sets up PRO trial subscription for provider
5. Links provider to user account

### Login as Admin

\\\ash
# Navigate to: http://localhost:3000/login
# Email: admin@drivebook.com.au
# Password: Admin123!
# Redirects to: /admin
\\\

### Login as Provider

\\\ash
# Navigate to: http://localhost:3000/login
# Email: instructor@drivebook.com.au
# Password: Provider123!
# Redirects to: /dashboard
\\\

---

## 🗑️ Reset Users

If you need to delete and recreate users:

\\\sql
-- Connect to PostgreSQL database
-- Delete in correct order (foreign keys)

-- 1. Delete subscriptions
DELETE FROM "Subscription" WHERE "providerId" IN (
  SELECT id FROM "Provider" WHERE "userId" IN (
    SELECT id FROM "User" WHERE email IN ('admin@drivebook.com.au', 'instructor@drivebook.com.au')
  )
);

-- 2. Delete provider
DELETE FROM "Provider" WHERE "userId" IN (
  SELECT id FROM "User" WHERE email IN ('admin@drivebook.com.au', 'instructor@drivebook.com.au')
);

-- 3. Delete users
DELETE FROM "User" WHERE email IN ('admin@drivebook.com.au', 'instructor@drivebook.com.au');
\\\

Then re-run: `node scripts/register-test-users.mjs`

---

## 📊 Verify Users in Database

Check if users exist:

\\\sql
-- Check users
SELECT id, email, role, "emailVerified", "providerId" 
FROM "User" 
WHERE email IN ('admin@drivebook.com.au', 'instructor@drivebook.com.au');

-- Check provider details
SELECT p.id, p.name, p."approvalStatus", p."subscriptionTier", 
       p."subscriptionStatus", p."trialEndsAt", u.email 
FROM "Provider" p 
JOIN "User" u ON p."userId" = u.id 
WHERE u.email = 'instructor@drivebook.com.au';

-- Check subscription
SELECT s.tier, s.status, s."trialEndsAt", s."currentPeriodEnd"
FROM "Subscription" s
JOIN "Provider" p ON s."providerId" = p.id
JOIN "User" u ON p."userId" = u.id
WHERE u.email = 'instructor@drivebook.com.au';
\\\

---

## ⚠️ Security Notes

**For Development Only:**
- These credentials are for **local testing only**
- **DO NOT** use these credentials in production
- **DO NOT** commit real production credentials to git
- Change passwords before deploying to production
- Use strong, unique passwords for production accounts

**Production Setup:**
1. Use environment-specific credentials
2. Enable 2FA for admin accounts
3. Use OAuth/SSO where possible
4. Rotate passwords regularly
5. Monitor login attempts
6. Enable audit logging

---

## 🎯 Testing Checklist

### Admin Account Tests
- [ ] Login with admin credentials
- [ ] Access `/admin` dashboard
- [ ] View instructor approvals (`/admin/instructors`)
- [ ] View platform revenue (`/admin/revenue`)
- [ ] Access pricing settings (`/admin/pricing`)
- [ ] View audit log (`/admin/audit-log`)
- [ ] Check bookings list (`/admin/bookings`)

### Provider Account Tests
- [ ] Login with provider credentials
- [ ] Access `/dashboard`
- [ ] View bookings list (`/dashboard/bookings`)
- [ ] Check schedule (`/dashboard/schedule`)
- [ ] View clients list (`/dashboard/clients`)
- [ ] Check earnings (`/dashboard/earnings`)
- [ ] View analytics (`/dashboard/analytics`)
- [ ] Verify PRO trial badge shows
- [ ] Check subscription page shows 14-day trial

### Booking Flow Tests
- [ ] Navigate to `/instructors` (or `/book` redirects)
- [ ] Search for instructor
- [ ] Select John Smith from results
- [ ] Create test booking
- [ ] Verify booking appears in provider dashboard
- [ ] Check booking status transitions

---

## 🔄 Related Documentation

- User roles → `docs/AUTH_AND_ROLES.md`
- Subscription system → `docs/SUBSCRIPTION_SYSTEM.md`
- Admin features → `docs/DOCROLEBASE/05-admin/`
- Provider features → `docs/DOCROLEBASE/03-instructor/`
- Database schema → `prisma/schema.prisma`

---

**Status:** ✅ Verified and ready for testing!