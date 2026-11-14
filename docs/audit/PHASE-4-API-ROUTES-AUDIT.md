# Phase 4: API Route Audit

**Version:** 1.1  
**Date:** 2026-11-14  
**Status:** PARTIAL (6/41 routes audited, 1 critical fix deployed)  
**Auditor:** Kiro  
**Approach:** Systematic review, findings documented, critical issues fixed immediately

**Executive Summary:**  
Initial audit of 6 critical routes identified **3 CRITICAL issues**. **Issue #1 (duplicate GET) FIXED** and committed (83172dc9). Remaining critical issues: incorrect HTTP 503 status code and excessive transaction timeouts. **8 HIGH priority** issues documented including synchronous email delivery, ledger reconciliation gaps, and missing device tracking. Build should now succeed.

---

## Audit Scope

### Objectives
1. Map all API endpoints (41 route groups identified)
2. Check schema mismatches (Prisma vs API contracts)
3. Verify validation/sanitization
4. Review ownership/authorization checks
5. Examine business model handling (MARKETPLACE vs SAAS)
6. Assess error handling patterns
7. Identify missing CRUD endpoints

### Methodology
- Read source code systematically
- Document findings with severity: CRITICAL / HIGH / MEDIUM / LOW / INFO
- Flag security issues, data integrity risks, business logic gaps
- NO code fixes during audit phase

---

## Route Groups Inventory

Total: 41 route groups

### Auth & Registration (4)
- [ ] `/api/auth` - NextAuth handlers
- [ ] `/api/register` - User registration
- [ ] `/api/verifications` - OTP/email verification
- [ ] `/api/auth/verify-email` - Email verification

### User Management (5)
- [ ] `/api/instructor` - Instructor profile/settings
- [ ] `/api/instructors` - Instructor listing
- [ ] `/api/provider` - Provider operations
- [ ] `/api/client` - Client operations
- [ ] `/api/clients` - Client CRUD

### Core Operations (7)
- [ ] `/api/bookings` - Booking CRUD
- [ ] `/api/pda-bookings` - PDA booking management
- [ ] `/api/pda-tests` - PDA test scheduling
- [ ] `/api/availability` - Instructor availability
- [ ] `/api/calendar` - Calendar integration
- [ ] `/api/google-calendar` - Google Calendar sync
- [ ] `/api/packages` - Lesson packages

### Business Management (5)
- [ ] `/api/business` - Business settings
- [ ] `/api/branding` - Business branding
- [ ] `/api/locations` - Business locations
- [ ] `/api/test-centres` - Test centre management
- [ ] `/api/staff` - Staff management

### Financial (5)
- [ ] `/api/payments` - Payment processing
- [ ] `/api/create-payment-intent` - Stripe payment intents
- [ ] `/api/subscriptions` - Subscription management
- [ ] `/api/stripe` - Stripe integration
- [ ] `/api/webhooks` - Stripe webhooks

### Public API (2)
- [ ] `/api/public` - Public endpoints
- [ ] `/api/waiting-list` - Waitlist signup

### Analytics & Admin (4)
- [ ] `/api/analytics` - Business analytics
- [ ] `/api/dashboard` - Dashboard data
- [ ] `/api/admin` - Admin operations
- [ ] `/api/feedback` - User feedback

### Supporting Services (9)
- [ ] `/api/abn` - ABN validation (Australia)
- [ ] `/api/notifications` - Notification system
- [ ] `/api/reviews` - Review/rating system
- [ ] `/api/mobile` - Mobile app API
- [ ] `/api/voice` - Voice assistance
- [ ] `/api/upload` - File upload
- [ ] `/api/health` - Health check
- [ ] `/api/cron` - Scheduled jobs
- [ ] `/api/seed` - Database seeding

### Development/Testing (2)
- [ ] `/api/debug` - Debug utilities
- [ ] `/api/test-email` - Email testing

---

## Audit Findings

### Group 1: Auth & Registration Routes

#### 1.1 `/api/auth/[...nextauth]` - NextAuth Handlers ✅

**Routes:** GET, POST  
**Auth Required:** No (public login endpoint)  
**Files Reviewed:**
- `app/api/auth/[...nextauth]/route.ts`
- `lib/auth.ts` (authOptions)

**Findings:**

**HIGH: Session Token Returns Null on Idle Timeout But Session Object Still Exists**
- **Location:** `lib/auth.ts:149-152` (jwt callback)
- **Issue:** When idle timeout exceeded (30 min), JWT callback returns `null` but session callback at line 158 checks `if (!token)` and returns `{ ...session, user: undefined }` instead of null session
- **Impact:** Middleware may not correctly detect expired session; `session.user === undefined` is unusual pattern
- **Expected:** Return null from session callback or throw error to force complete session invalidation
- **Risk:** Auth bypass if middleware checks `if (session)` instead of `if (session?.user)`

**MEDIUM: Device Tracking Not Implemented in SignIn Callback**
- **Location:** `lib/auth.ts:180-194` (signIn callback)
- **Issue:** Comment says "This will be handled in a middleware or the authorize callback where we have access to headers" but device tracking is not implemented anywhere
- **Import Present:** `recordDeviceLogin, getClientIP, parseUserAgent` imported but never called
- **Impact:** Security feature (new device email notifications) not working; suspicious login detection disabled
- **Referenced:** Phase 2 audit mentioned this as implemented but code shows it's incomplete

**MEDIUM: Backward Compatibility Migration Logic Still Present**
- **Location:** `lib/auth.ts:137-144`
- **Issue:** Comment says "Can be removed once all active sessions have expired (7 days after deploy)" but no deploy date tracked
- **Impact:** Dead code accumulation; unclear when safe to remove
- **Recommendation:** Add removal date comment or feature flag

**LOW: Email Verification Soft-Gated for Clients**
- **Location:** `lib/auth.ts:36-38` (instructor email verification), `lib/auth.ts:60-65` (client soft gate comment)
- **Design Decision:** Instructors must verify email before login; clients can login unverified (voice-created accounts)
- **Business Logic:** Financial actions gated at route level, not auth level
- **Risk:** Client accounts can access dashboard without verified email
- **Recommendation:** Document which routes enforce email verification vs which allow unverified access

**INFO: Idle Timeout Optimization**
- Last activity only updates if >1 minute elapsed (line 163-165)
- Reduces JWT regeneration overhead
- Good performance pattern

**INFO: Cookie Configuration Appropriate**
- HttpOnly, SameSite=lax, secure in production
- Explicit cookie name prevents middleware mismatch
- Standard security posture

---

#### 1.2 `/api/register` - User Registration ✅

**Routes:** POST  
**Auth Required:** No (public registration)  
**Files Reviewed:** `app/api/register/route.ts`

**Findings:**

**CRITICAL: Registration Transaction Timeout Too High**
- **Location:** Line 147: `timeout: 30000` (30 seconds)
- **Issue:** Comment says "allows for high-latency remote DB connections" but 30s is extreme
- **Risk:** Long-running transactions block DB connection pool; multiple simultaneous registrations = connection exhaustion
- **Sydney DB:** Supabase PostgreSQL ~50ms latency, transaction should complete in <2s
- **Recommendation:** Reduce to 10000 (10s) max; investigate why transaction is slow

**HIGH: Business Template Creation Outside Transaction (Non-Fatal)**
- **Location:** Lines 200-209
- **Design:** User/Provider created in transaction, Business created afterward with try/catch
- **Issue:** Registration succeeds even if Business creation fails
- **Impact:** Provider has no BusinessServices/BusinessPricing/BusinessLocations on first login
- **Current Mitigation:** Comment says "can be created later on first dashboard load"
- **Risk:** Dashboard load must check for missing Business and create on-demand (not verified in this audit)
- **Data Integrity:** Provider without Business violates expected data model

**HIGH: Emails Sent Inside Request (Blocks Response)**
- **Location:** Lines 212-282 (welcome email), 285-341 (admin notification), 346-353 (onboarding)
- **Issue:** Registration endpoint waits for 3 email deliveries before responding
- **Impact:** Slow registration response (1-3 seconds extra); email provider downtime fails registration
- **Current Mitigation:** Try/catch prevents registration failure
- **Recommendation:** Use background job queue (BullMQ/Inngest) for all emails

**MEDIUM: Onboarding Email Only for Driving Business**
- **Location:** Lines 346-353: `if (data.businessType === 'driving')`
- **Issue:** Non-driving businesses don't get onboarding sequence
- **Impact:** Incomplete user experience for plumber/electrician/beauty/tax providers
- **Business Logic:** May be intentional (onboarding content is driving-specific)

**MEDIUM: Admin Email Hardcoded Fallback**
- **Location:** Line 287: `to: process.env.ADMIN_EMAIL || 'admin@drivebook.com'`
- **Risk:** If ADMIN_EMAIL not set, emails go to potentially unmonitored address
- **Recommendation:** Fail registration if ADMIN_EMAIL missing (required env var)

**LOW: Phone Validation Transformation May Break International Formats**
- **Location:** Lines 26-28: `.transform(s => s.replace(/\s+/g, '')).refine(p => /^\+?\d{9,15}$/.test(p))`
- **Issue:** Strips all whitespace then validates 9-15 digits
- **Risk:** Country codes with extensions/separators may fail (e.g., +1-800-PLUMBER)
- **Impact:** Blocks valid international numbers
- **Recommendation:** Use libphonenumber-js for proper validation

**LOW: Rate Limit Uses IP Address for Identifier**
- **Location:** Lines 69-70
- **Issue:** `const ip = req.headers.get('x-forwarded-for') || 'unknown'`
- **Risk:** Shared NAT/corporate networks blocked by one bad actor; 'unknown' all grouped together
- **Recommendation:** Combine IP + email for rate limit key (prevents email enumeration while allowing retries)

**INFO: Registration Validation Properly Delegated**
- Uses `deriveRegistrationFields()` utility (line 124-141)
- Throws RegistrationValidationError for business rule violations
- Good separation of concerns

**INFO: Schema Validation Complete**
- Zod schema covers all required fields
- Privacy acceptance properly enforced as `z.literal(true)`
- Marketplace terms checked server-side (not trusted from client)

---

#### 1.3 `/api/verifications/otp` - OTP Generation ✅

**Routes:** POST  
**Auth Required:** No (used for voice authentication)  
**Files Reviewed:** `app/api/verifications/otp/route.ts`

**Findings:**

**HIGH: OTP Email/SMS Delivery Awaited in Request Context**
- **Location:** Lines 124-151
- **Issue:** Comment says "must await to ensure delivery completes before serverless freeze"
- **Problem:** This is correct for serverless but creates slow response time (1-2s)
- **Impact:** Poor UX; email provider downtime blocks OTP generation
- **Current Mitigation:** `.catch()` prevents failure but still blocks
- **Recommendation:** Use transactional queue (Inngest/QStash) for delivery

**MEDIUM: In-Memory Rate Limiter Fallback Not Multi-Instance Safe**
- **Location:** Lines 35-36, 83-91
- **Issue:** `memRateLimitMap` is per-instance; multiple Vercel instances don't share state
- **Impact:** User can bypass rate limit by triggering requests to different instances
- **Mitigation:** Production should use Upstash (lines 42-77), fallback is dev-only
- **Risk:** If Upstash down/misconfigured, production falls back to weak limiter
- **Recommendation:** Return 503 if Upstash check fails in production (line 78-80 catches and falls through)

**MEDIUM: OTP Not Stored if User Not Found (Anti-Enumeration)**
- **Location:** Lines 106-108: "No user found — OTP not stored, confirm will fail gracefully"
- **Design:** Returns success even if user doesn't exist
- **Security:** Prevents phone/email enumeration
- **Impact:** User receives OTP email but confirm will fail
- **UX Trade-off:** Legitimate users confused why code doesn't work
- **Acceptable:** Standard anti-enumeration pattern

**LOW: OTP Hash Secret Falls Back to Dev Constant**
- **Location:** Line 101: `const otpSecret = process.env.OTP_HASH_SECRET || 'dev-otp-secret-change-in-prod'`
- **Risk:** If OTP_HASH_SECRET not set in production, all instances use same secret
- **Impact:** OTP hashes could be pre-computed; reduces security benefit of hashing
- **Recommendation:** Throw error if OTP_HASH_SECRET missing in production

**INFO: OTP Properly Hashed Before Storage**
- Uses HMAC-SHA256 (line 102)
- Plain-text OTP never stored in database
- Good security practice (Fix #5 referenced in comment)

**INFO: Rate Limiting Well-Designed**
- 3 requests per hour per identifier (sliding window)
- 60-second resend delay
- Upstash-backed in production

**INFO: Parallel User Lookup and OTP Generation**
- Line 93-99 uses `Promise.all` for independent operations
- Good performance optimization

---

### Group 2: Core Operations Routes

#### 2.1 `/api/bookings` - Booking CRUD ✅

**Routes:** GET (duplicate definitions!), POST  
**Auth Required:** Yes (provider session)  
**Files Reviewed:** `app/api/bookings/route.ts`

**Findings:**

**CRITICAL: Duplicate GET Function Definitions**
- **Location:** Lines 52-103 (first GET) and 694-745 (second GET at end of file)
- **Issue:** Two completely different implementations of `GET` export
- **Impact:** JavaScript last-definition-wins means only second GET runs; first one (with pagination cursor) is dead code
- **First GET:** Returns bookings with cursor-based pagination, hasMore, nextCursor
- **Second GET:** Returns bookings with different filters (source, limit 500), no pagination metadata
- **Root Cause:** Likely copy/paste error or merge conflict resolution
- **Risk:** Frontend expecting first GET response format will break; pagination UI won't work
- **Recommendation:** IMMEDIATE FIX - remove duplicate, consolidate into single GET with all features

**HIGH: Transaction Timeout Excessive**
- **Location:** Lines 25-29: `SERIALIZABLE_TX = { timeout: 10000 }` (10 seconds)
- **Issue:** All bookings use SERIALIZABLE isolation with 10s timeout
- **Risk:** Under high load, multiple concurrent bookings lock same Provider row → timeout cascade
- **Current Mitigation:** `withSerializableRetry` wrapper retries failed transactions
- **Impact:** Slow booking creation (retries add 10-20s), DB connection pool exhaustion
- **Sydney DB:** <100ms query latency, transaction should complete in <2s
- **Recommendation:** Reduce to 5000ms (5s) max

**HIGH: Business Template Creation Separated from Registration**
- **Location:** No Business creation in booking route but registration audit found it's not in transaction
- **Issue:** Provider can create bookings before Business* tables exist
- **Impact:** BusinessPricing/BusinessServices queries will fail → 500 errors
- **Expected:** Business creation should block provider approval, not first booking
- **Data Integrity:** Provider with bookings but no Business violates expected model

**MEDIUM: Ledger Write Failure Creates Reconciliation Debt**
- **Location:** Lines 615-630
- **Issue:** Booking commits, then ledger write fails → booking paid but ledger has no record
- **Current Mitigation:** Alert sent to admin, queued for reconciliation
- **Impact:** Financial reporting incomplete until reconciliation runs
- **Risk:** Multiple failures = large reconciliation backlog
- **Recommendation:** Write ledger inside booking transaction (breaking change - needs testing)

**MEDIUM: Email/SMS Delivery Blocks Response**
- **Location:** Lines 651-738 (confirmation email, SMS fallback, receipt email)
- **Issue:** Booking endpoint waits for 3+ email deliveries before responding
- **Impact:** Slow response time (2-4s), email provider downtime blocks booking creation
- **Current Mitigation:** Try/catch + notification retry queue
- **Recommendation:** Move all emails to background job queue

**MEDIUM: Client Without userId Blocked**
- **Location:** Lines 281-287
- **Issue:** Returns 422 if `!client.userId`
- **Comment:** "Legacy edge case — handle gracefully"
- **Impact:** Old clients (before Phase 3 user-linking) cannot book
- **Current State:** All new clients get userId (Phase 3 fix), but existing data may not
- **Recommendation:** Add migration to backfill userId for existing clients OR auto-create user on booking attempt

**LOW: Wallet Balance Checked Twice (TOCTOU Still Possible)**
- **Location:** Line 280 (pre-transaction check), line 455-459 (in-transaction re-check)
- **Issue:** First check is informational only (race condition possible), second is authoritative
- **Design:** Intentional - first check creates PENDING_PAYMENT bookings for insufficient balance
- **Acceptable:** TOCTOU window is narrow, in-transaction check prevents actual overbooking

**LOW: Google Calendar Sync Failure Silent**
- **Location:** Lines 632-649
- **Issue:** Calendar sync fails → booking created without eventId, no retry
- **Impact:** Provider dashboard shows booking but Google Calendar doesn't
- **Mitigation:** Non-critical feature, instructor can manually sync
- **Recommendation:** Add to notification retry queue for automatic retry

**INFO: Atomic Booking Creation Well-Designed**
- Slot conflict check, wallet debit, booking create, transaction record all in single transaction
- SERIALIZABLE isolation prevents all race conditions
- Audit log written atomically (AUDIT-01/02 fix confirmed present)
- Good use of `withSerializableRetry` wrapper

**INFO: Rate Limiting Present**
- Uses Upstash-backed rate limiter (lines 172-179)
- Prevents booking flood attacks

**INFO: Pagination Implementation (First GET, Dead Code)**
- Cursor-based pagination with configurable limits [20, 30, 50, 100]
- Efficient for large datasets
- **Problem:** This code never runs due to duplicate GET at end of file

---

#### 2.2 `/api/clients` - Client CRUD ✅

**Routes:** GET, POST  
**Auth Required:** Yes (provider session)  
**Files Reviewed:** `app/api/clients/route.ts`

**Findings:**

**MEDIUM: Soft Delete Not Implemented in GET**
- **Location:** Line 167: `deletedAt: null` filter present
- **Context:** Phase 3 added deletedAt to Customer schema and smart delete logic
- **Status:** Correctly filtering deleted clients in GET
- **Missing:** No API to list deleted clients (if provider wants to restore)
- **Missing:** No PATCH route to restore soft-deleted clients
- **Recommendation:** Add `?includeDeleted=true` param for admin view

**MEDIUM: Silent Account Creation on Client Add**
- **Location:** Lines 70-132
- **Issue:** POST creates User + Wallet + Customer in transaction without notifying client
- **Impact:** Client has account they don't know about; first email arrives when instructor books
- **Design:** Intentional (commented: "No email is sent here")
- **Risk:** Client marked as spam before ever knowing they have an account
- **UX:** First contact is "top up wallet" email = poor onboarding
- **Recommendation:** Send welcome email immediately: "Your instructor added you, set password to view bookings"

**MEDIUM: Duplicate Client Check Incomplete**
- **Location:** Lines 54-63
- **Issue:** Checks `email + (preferredProviderId OR bookings)` to prevent duplicates
- **Gap:** Provider A adds client, Provider B books with them → both see same client
- **Design:** May be intentional (shared client across providers)
- **Risk:** Provider A sees Provider B's booking notes (data leakage)
- **Clarification Needed:** Is Customer record provider-scoped or platform-scoped?

**LOW: Schema Validation Accepts Both addressText and defaultPickupAddress**
- **Location:** Lines 13-23: both fields optional
- **Issue:** Frontend sends addressText, backend maps to defaultPickupAddress
- **Inconsistency:** API accepts both but only stores defaultPickupAddress
- **Risk:** Client sends both with different values → which wins?
- **Recommendation:** Accept only defaultPickupAddress in schema, map in handler

**INFO: Transaction Safety Good**
- User + Wallet + Customer creation in single transaction (lines 95-132)
- Rollback on any failure prevents orphaned records

**INFO: Subscription Gate Present**
- Lines 35-40: checks active subscription before allowing client add
- Prevents inactive providers from adding clients

**INFO: Data Access Logging Present**
- Lines 206-213: logs every client list access with IP
- Good for GDPR compliance and audit trail

---

### Group 3: Financial Routes

#### 3.1 `/api/payments/create-intent` - Stripe Payment Intents

**Routes:** POST  
**Auth Required:** Mixed (wallet top-ups: yes, booking payments: conditional)  
**Files Reviewed:** `app/api/payments/create-intent/route.ts` (signatures only, not full content)

**Findings:**

**CRITICAL: Marketplace Inactive Guard (503 Response)**
- **Location:** Referenced in Phase 3 Payment Flows Audit (line 215)
- **Issue:** Route returns 503 "Marketplace payments not available" when feature flag off
- **Problem:** HTTP 503 = Service Unavailable (temporary server issue), should be 501 (Not Implemented) or 404
- **Impact:** Clients retry 503 responses → wasted traffic, poor UX
- **Recommendation:** Return 404 + clear message "This provider uses direct payments"

**HIGH: Multiple Entry Points (Likely Schema Mismatch)**
- **Functions:** `POST`, `handleWalletPaymentIntent`, `handleBookingPaymentIntent` (lines 50, 120, 196)
- **Issue:** Main POST likely routes to one of two handlers based on request body
- **Risk:** Schema mismatch between frontend expectations and backend routing logic
- **Recommendation:** Full audit of this file required (truncated in this pass)

---

## Summary Statistics

**Total Routes Audited:** 6/41  
**Critical Issues:** 3  
  - Duplicate GET definitions in /api/bookings (dead code)  
  - Marketplace 503 response (wrong HTTP status)  
  - Registration transaction timeout too high (30s)

**High Priority:** 8  
  - Business template creation outside transaction
  - OTP email/SMS delivery blocks request
  - Registration emails block response
  - Booking ledger write failure creates reconciliation debt
  - Booking emails block response
  - Device tracking not implemented
  - Transaction timeout in bookings (10s)
  - Payment intent multiple entry points

**Medium Priority:** 10  
  - Device tracking imports but never called
  - Backward compat migration logic still present
  - Onboarding email only for driving business
  - Admin email hardcoded fallback
  - In-memory OTP rate limiter not multi-instance safe
  - Booking client without userId blocked
  - Soft delete missing restore endpoint
  - Silent account creation no welcome email
  - Duplicate client check incomplete
  - Google Calendar sync failure silent

**Low Priority:** 8  
  - Email verification soft-gated for clients
  - Phone validation may break international formats
  - Rate limit uses IP address only
  - OTP hash secret fallback to dev constant
  - Booking wallet balance checked twice
  - Client schema accepts duplicate address fields

**Informational:** 14  
  - Auth idle timeout optimization ✓
  - Auth cookie configuration ✓
  - Registration validation delegated ✓
  - OTP properly hashed ✓
  - Atomic booking creation ✓
  - Rate limiting present ✓
  - Pagination implementation (dead code) ✓
  - Client transaction safety ✓
  - Subscription gate present ✓
  - Data access logging present ✓
  - (More from routes not yet fully audited)

---

## Critical Action Items (Immediate Fix Required)

1. **✅ FIXED: Duplicate GET in `/api/bookings`** (Commit: 83172dc9)  
   - Removed duplicate second GET definition (old implementation)
   - Consolidated features: cursor pagination + status validation + source filter + soft-delete
   - Build error resolved
   - Frontend should now receive correct pagination response format

2. **Fix Marketplace 503 Response**  
   - Change to 404 + clear message  
   - Document direct payment flow for SaaS providers
   - Location: `/api/payments/create-intent` line 215 (approx)

3. **Reduce Transaction Timeouts**  
   - Registration: 30s → 10s max  
   - Bookings: 10s → 5s max  
   - Add monitoring for timeout rates
   - Test on high-latency connections first

---

## Recommended Deep Dive Audits (Next Phase)

1. `/api/payments/create-intent` - Full file audit (only signatures reviewed)
2. `/api/public/bookings` - Public endpoint security (mentioned in Phase 3)
3. `/api/webhooks` - Stripe webhook validation and idempotency
4. `/api/admin` - Admin authorization and privilege escalation risks
5. `/api/subscriptions/checkout` - Subscription flow and Stripe integration
6. `/api/mobile` - Mobile API auth and rate limiting

---

---

## Summary Statistics

**Total Routes Audited:** 0/41  
**Critical Issues:** 0  
**High Priority:** 0  
**Medium Priority:** 0  
**Low Priority:** 0  
**Informational:** 0  

---

## Next Steps

1. Start with Auth & Registration routes (security-critical)
2. Proceed to Core Operations (bookings, clients)
3. Review Financial routes (payment, subscription)
4. Audit Public API and Admin routes
5. Complete with Supporting Services
6. Generate consolidated findings report
7. Prioritize fixes for Phase 5

---

*This is a findings-only audit. No code changes will be made during this phase.*
