# OWASP Top 10 Self-Assessment — DriveBook

This is your completed practical assessment for VU23215.
Keep this as RPL evidence.

---

## A01: Broken Access Control

**Present?** No — implemented correctly

**Evidence:**
- Every API route checks session before returning data
- `if (!session?.user?.instructorId) return 401`
- Booking queries filter by `instructorId: session.user.instructorId` — can't access another instructor's bookings
- Admin routes check `session.user.role !== 'ADMIN'` — instructors cannot access admin endpoints

**Remaining gap:**
- IDOR (Insecure Direct Object Reference) testing not formally performed
- Recommendation: manually test that `/api/bookings/[id]` returns 403 when called by a different authenticated instructor

---

## A02: Cryptographic Failures

**Present?** No — correctly implemented

**Evidence:**
- Passwords hashed with `bcrypt` (cost 10) — `lib/auth.ts`
- All traffic HTTPS via Vercel (HTTP → HTTPS redirect enforced)
- Session cookies: `HttpOnly: true, Secure: true (production), SameSite: lax`
- No sensitive data in localStorage or URL parameters
- Instructor documents stored in Cloudinary with signed URLs (expiring)

---

## A03: Injection

**Present?** No — Prisma parameterises all queries

**Evidence:**
- All database queries use Prisma ORM
- Prisma generates prepared statements — no string concatenation into SQL
- Example: `prisma.booking.findFirst({ where: { instructorId, date, time } })`
  — `instructorId`, `date`, and `time` are parameters, not concatenated strings

**Test to run:** Enter `'; DROP TABLE bookings; --` in a booking form field.
Expected result: Prisma will escape it, the query will return no results, no SQL execution.

---

## A04: Insecure Design

**Present?** Partially

**Evidence (protected):**
- Rate limiting on auth, booking, wallet, and webhook routes
- OTP verification required before cancel/reschedule
- Stripe signature verification on webhooks

**Gap identified:**
- No formal threat model document exists
- Password complexity requirements not enforced (minimum length only)
- No MFA for instructor accounts (important: instructors control payout bank details)

**Recommendation:** Add TOTP (Google Authenticator) as optional MFA for instructor accounts,
especially before payout settings can be changed.

---

## A05: Security Misconfiguration

**Present?** Partially (dev only)

**Evidence (protected):**
- `instrumentation.ts` validates critical env vars at startup
- Production fails to start if `NEXTAUTH_SECRET`, `STRIPE_SECRET_KEY`, etc. are missing or placeholders
- `next.config.js` has security headers (X-Frame-Options, X-Content-Type-Options)

**Gap:**
- Error messages in development expose stack traces — acceptable for dev, not for prod
- Verify: Next.js automatically suppresses stack traces in production (`NODE_ENV=production`)

---

## A06: Vulnerable and Outdated Components

**Present?** Unknown — not regularly audited

**Action required:**
```bash
cd drivebook
npm audit
```
Run this now and record the output. Fix any high/critical findings before going live.

Also check: `npm outdated` to see packages with available updates.

**DriveBook dependency risk:** The `axios/1.8.3` in the hybrid service should be checked — 
older axios versions had prototype pollution vulnerabilities.

---

## A07: Identification and Authentication Failures

**Present?** Partially

**Evidence (protected):**
- Bcrypt password hashing
- 7-day session expiry (not 30)
- HttpOnly cookies prevent JavaScript access to session token
- Rate limiting on login (5 attempts / 15 min)

**Gap:**
- No MFA
- No password complexity policy enforcement
- No "have I been pwned" check on registration
- Instructor accounts are high-value targets (control bank account details)

---

## A08: Software and Data Integrity Failures

**Present?** No — Stripe webhook signature verified

**Evidence:**
```typescript
// app/api/stripe/webhook/route.ts
const event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
```
If the signature doesn't match, the webhook is rejected before any processing.

This prevents an attacker from POSTing a fake `payment_intent.succeeded` event to
falsely trigger wallet credits.

---

## A09: Security Logging and Monitoring Failures

**Present?** Partially

**Evidence (protected):**
- `lib/services/auditLogger.ts` logs financial and admin actions
- Vercel and Railway log all HTTP requests

**Gap:**
- No automated alerting on suspicious patterns (e.g., 50 failed logins from one IP)
- No SIEM (Security Information and Event Management) tool
- Logs are not automatically reviewed — relies on manual inspection

**Recommendation:** Set up a webhook or cron job that queries the AuditLog table daily
and emails a summary of failed auth attempts and unusual financial actions.

---

## A10: Server-Side Request Forgery (SSRF)

**Present?** Low risk

**Evidence:**
- No user-provided URL fetching in the main app
- The AI bio generator calls OpenAI's API server-side, but the URL is hardcoded
  (`https://api.openai.com/...`) — not user-provided

**Remaining risk:**
- `app/api/instructor/profile/route.ts` — instructors can submit a `videoUrl` (YouTube/Vimeo)
- This URL is displayed as an embed, not fetched server-side — no SSRF risk
- But: validate that only YouTube/Vimeo domains are accepted to prevent embedding malicious iframes

---

## Overall Security Rating: **MEDIUM-LOW risk**

Critical gaps to address before launch:
1. Run `npm audit` and fix any high/critical findings
2. Add MFA option for instructor accounts (they control payout bank details)
3. Implement automated monitoring alerts on failed auth patterns
