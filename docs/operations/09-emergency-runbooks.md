# 09 — Emergency Runbooks

---

## Incident Severity Matrix

| Level | Name | Description | Response | Escalation |
|---|---|---|---|---|
| **P0** | Platform offline | Entire site/API unreachable | 15 min | SUPER_ADMIN immediately |
| **P1** | Payments unavailable | Stripe webhook failure, checkout broken | 30 min | ADMIN + SUPER_ADMIN |
| **P2** | Bookings unavailable | Cannot create/view bookings | 30 min | ADMIN |
| **P3** | Admin/instructor bug | Dashboard feature broken | 2 hours | ADMIN |
| **P4** | UI issue | Visual/minor functional bug | 8 hours | Any |

**P0 and P1 must be documented in** `drivebook-hybrid/docs/incidents/` using the incident template.

---

## P0 — Platform Offline

**Symptoms:** All pages return 5xx, Vercel status red, DB unreachable.

**Steps:**
1. Check [Vercel Status](https://www.vercel-status.com/) and [Supabase Status](https://status.supabase.com/)
2. If Vercel: no action required from us — monitor and wait
3. If Supabase: check DB connection string, check if pooler is up (`aws-1-ap-northeast-1.pooler.supabase.com:6543`)
4. If code issue: check last deployment, roll back via Vercel dashboard (Deployments → previous → Promote)
5. Communicate ETA on status page if down > 15 min
6. Do NOT attempt DB migrations during an outage

---

## Stripe Outage

**Symptoms:** Payment intents failing, checkout not loading, webhook 5xx.

**Steps:**
1. Check [Stripe Status](https://status.stripe.com/)
2. **Disable new payments:**
   - Set a global maintenance notice (or toggle booking acceptance off for all instructors via bulk admin action)
3. Keep all bookings in `PENDING_PAYMENT` — do not expire them
4. Do NOT manually capture payments or mark bookings as paid
5. When Stripe recovers: reconciliation cron (`reconcile-stripe`) will auto-confirm missed webhooks on next run
6. If cron doesn't catch all: manually review Stripe dashboard for `payment_intent.succeeded` events that have no corresponding confirmed booking
7. Log incident

**Do NOT:**
- Manually set booking status to `CONFIRMED` — let the webhook do it
- Issue manual refunds during the outage — wait for resolution

---

## Twilio / SMS Outage

**Symptoms:** SMS not sending, AI receptionist calls dropping, OTP not delivered.

**Steps:**
1. Check [Twilio Status](https://status.twilio.com/)
2. **AI Receptionist fallback:**
   - Update VAPI system prompt to direct callers to book online at `drivebook.com.au`
   - Add a fallback message: "Our phone booking line is temporarily unavailable. Please book online or contact support@drivebook.com.au"
3. **OTP fallback:**
   - For cancellations/reschedules: allow email OTP if implemented, or escalate to admin-assisted cancellation
4. **Email confirmations:**
   - Email confirmation is always sent in addition to SMS — students will have received email confirmation
5. Queue SMS messages for retry when Twilio recovers (retry service: `lib/services/notificationRetry.ts`)
6. Log incident

---

## AI Receptionist Offline

**Symptoms:** Calls not being answered, VAPI dashboard shows errors.

**Steps:**
1. Check VAPI dashboard status
2. Check `drivebook-hybrid` service status (Railway or wherever deployed)
3. If `drivebook-hybrid` is down: restart the service
4. If VAPI is down: calls will not be answered — update instructor dashboard notification
5. Students can still book online at `drivebook.com.au` and via instructor subdomain
6. Inform affected PRO+ instructors via email

**Voice line status** — update in admin: `/admin/voice-lines` → set status to `SUSPENDED` temporarily to prevent unanswered calls.

---

## Database Maintenance Mode

**Before any planned maintenance:**
1. Announce downtime window (minimum 1 hour notice for > 5 min downtime)
2. Set Vercel environment variable `MAINTENANCE_MODE=true` if implemented
3. Pause cron jobs that write to DB (`cleanup-expired-bookings`, `weekly-payouts`)
4. Take manual DB snapshot before starting
5. Complete maintenance
6. Verify DB connectivity: run `GET /api/health`
7. Re-enable cron jobs
8. Verify `prisma generate` if schema changed
9. Monitor for 15 minutes

**During maintenance:**
- Do NOT process payouts
- Do NOT run reconciliation
- Keep Vercel deployment paused if possible

---

## Failed Weekly Payout Run

**Symptoms:** Tuesday payout cron returns failures, instructors not paid.

**Steps:**
1. Check payout summary in `/admin/payouts` for failed entries
2. For each failure: check the reason (Stripe error, missing account, dispute hold)
3. For Stripe errors: retry via Stripe dashboard or admin payout trigger
4. For missing accounts: send onboarding reminder email
5. For dispute holds: do not retry — hold stands until dispute resolved
6. Log outcome in audit log

**If cron crashed entirely** (no run at all):
1. Manually trigger via `/api/cron/weekly-payouts` with `Bearer CRON_SECRET` header
2. Monitor logs for completion

---

## Communication Templates

### P0 — Status page update:
```
[DriveBook Status Update]
We are currently experiencing a service disruption affecting [component].
Our team is investigating. We will provide an update in 30 minutes.
Started: [time]
```

### P1 — Payment issue (instructor email):
```
Subject: Temporary Payment Processing Issue

Hi [name],
We're aware of a temporary issue affecting payment processing.
New bookings will be held in pending status until resolved.
Your existing confirmed bookings are not affected.
We expect this to be resolved by [time].
```
