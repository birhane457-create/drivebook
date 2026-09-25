# VU23217 — DriveBook CIA Triad Examples

## Confidentiality in DriveBook

### What needs to be confidential
- Instructor bank account details (BSB, account number) — used for weekly payouts
- Student personal data (name, phone, email, pickup address)
- Payment card data — never stored (Stripe handles this, no raw card data in DriveBook DB)
- Session tokens (JWTs in HttpOnly cookies)

### How confidentiality is enforced
1. **Role-based access control** (`lib/auth.ts`)
   - Instructors can only see their own clients
   - Clients cannot see other clients
   - Admin-only routes check `session.user.role === 'ADMIN'`

2. **BSB masking** (from previous audit work)
   - Instructor bank BSB displayed as `•••-XXX` in list views
   - Full BSB only shown in the payout confirmation modal

3. **Cloudinary signed URLs** for documents
   - Instructor licence photos are not public URLs
   - Admin must call `/api/instructor/documents/[key]` which generates a time-limited signed URL
   - Even if someone finds the document key, the URL expires

---

## Integrity in DriveBook

### What needs to stay accurate and tamper-proof
- Wallet balances
- Transaction records (bookings, payouts, refunds)
- Instructor payout amounts

### How integrity is enforced
1. **Atomic database transactions** (`prisma.$transaction`)
   - Wallet debit and booking creation happen in a single transaction
   - If either fails, both roll back — impossible to debit wallet without creating a booking

2. **Idempotency keys** on Stripe webhooks
   - The same `payment_intent.succeeded` event can fire multiple times (Stripe retries)
   - The webhook records a `bookingIdempotencyKey` — if the same event arrives again, it's silently ignored
   - Prevents double-crediting a wallet on payment

3. **Audit log** (`lib/services/auditLogger.ts`)
   - Every financial action is written to an immutable AuditLog table
   - Tamper detection: you can reconstruct the correct wallet balance from the audit log independently

---

## Availability in DriveBook

### What must stay available
- The booking flow — if the site is down, instructors lose income
- Payment processing — Stripe downtime means customers can't pay
- The AI voice receptionist — if Railway is down, calls fail

### How availability is maintained
1. **Vercel CDN** — Next.js app served from edge locations globally
2. **Supabase connection pooling** — `pgbouncer=true` in DATABASE_URL prevents connection exhaustion
3. **Graceful degradation** on the dashboard page:
   - If supplementary queries fail, the page still loads with core data
   - `.catch(() => null)` pattern on each query so one failure doesn't crash the whole page
4. **Cron health monitoring** (`lib/services/cron-health.ts`)
   - Automated jobs are monitored; failures are logged and alertable

---

## Risk Assessment for DriveBook (your assignment-ready example)

| Asset | Threat | Likelihood | Impact | Risk Score | Control |
|-------|--------|------------|--------|------------|---------|
| Instructor bank details | Insider access | Low | High | Medium | Role-based access, BSB masking |
| Wallet balance | Double-debit | Low | High | Medium | Atomic transactions, idempotency |
| Booking system | DDoS | Medium | High | High | Rate limiting, Vercel DDoS protection |
| Student PII | Data breach | Low | High | Medium | HTTPS, encrypted at rest (Supabase) |
| Session tokens | Cookie theft | Low | High | Medium | HttpOnly, Secure, SameSite=Lax |
