# 11 — Release Management

---

## Release Types

| Type | Description | Approval | Deployment |
|---|---|---|---|
| Hotfix | Critical bug, security patch | SUPER_ADMIN verbal OK | Immediate |
| Minor | Bug fixes, small features, copy changes | ADMIN review | Scheduled |
| Major | New features, schema changes, new tier | Full checklist below | Planned window |
| Schema migration | DB column/table changes | SUPER_ADMIN sign-off | Maintenance window |

---

## Pre-Deployment Checklist

### Code:
- [ ] All tests passing (run `npm run build` — must succeed with 0 errors)
- [ ] No TypeScript errors (build fails on type errors — this is the gate)
- [ ] Environment variables documented for any new `.env` values
- [ ] New feature flags added to `10-audit-compliance.md` if applicable

### Database (if schema changes):
- [ ] Migration SQL file created in `prisma/migrations/`
- [ ] Migration uses `IF NOT EXISTS` — safe to re-run
- [ ] Migration tested locally or on a staging DB first
- [ ] `businessName`, `accountType`, `paymentMode` precedent — use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- [ ] Rollback SQL documented (what to do if migration needs reverting)
- [ ] Supabase backup confirmed recent before applying

### Payments:
- [ ] Stripe webhook endpoint confirmed active in Stripe dashboard
- [ ] Test payment intent creation (`/api/payments/create-intent`)
- [ ] Test Stripe webhook delivery (use Stripe CLI to replay events)

### Bookings:
- [ ] Test booking creation flow end-to-end
- [ ] Test cancellation and refund calculation
- [ ] Test availability slots rendering correctly

### Notifications:
- [ ] SMS confirmation fires on test booking
- [ ] Email receipt delivers

### AI / Voice:
- [ ] VAPI system prompt version matches deployed `drivebook-hybrid`
- [ ] Test call to AI receptionist completes a booking
- [ ] `drivebook-hybrid` service deployed and health check passes (`GET /health`)

---

## Deployment Procedure

1. **Create a backup**
   - Confirm Supabase has auto-backup from today
   - For major releases: take manual snapshot

2. **Apply DB migrations** (if any)
   ```bash
   # From a machine that can reach Supabase:
   npx prisma db push
   # OR via Supabase SQL editor — paste migration.sql content
   ```
   Verify with `prisma generate` — must succeed with no errors.

3. **Deploy to Vercel**
   - Push to `main` branch (Vercel auto-deploys)
   - OR trigger manual deploy from Vercel dashboard
   - Wait for build to complete — do not proceed if build fails

4. **Smoke test immediately after deploy**
   - [ ] `GET /api/health` returns 200
   - [ ] Homepage loads
   - [ ] Login works (admin account)
   - [ ] `GET /api/auth/session` returns valid session
   - [ ] Test booking page loads for one instructor
   - [ ] Admin dashboard loads: `/admin`
   - [ ] Copilot responds: `/admin/copilot`

5. **Monitor for 30 minutes**
   - Watch Vercel function logs for errors
   - Check Stripe dashboard for webhook failures
   - Check `/admin/cron-jobs` that scheduled jobs are healthy

6. **Close release**
   - Update `docs/DOCROLEBASE/00-overview/CHANGES.md` with what changed
   - Update feature flags in `10-audit-compliance.md` if features were enabled
   - Update `HARDCODED_VALUES.md` if any values changed

---

## Rollback Procedure

### Vercel rollback (no DB changes):
1. Go to Vercel dashboard → Deployments
2. Find the last working deployment
3. Click "..." → Promote to Production
4. Verify with smoke test

### DB rollback (if schema was changed):
1. Run the rollback SQL (must be pre-written before deploy)
2. Regenerate Prisma client: `npx prisma generate`
3. Redeploy the previous application version

### Emergency rollback (P0):
1. SUPER_ADMIN: immediately promote previous Vercel deployment
2. If DB migration is the cause: run rollback SQL from Supabase SQL editor
3. Notify affected users if downtime > 5 minutes
4. Log incident in `drivebook-hybrid/docs/incidents/`

---

## Rollback SQL Template

Every migration should have a companion rollback. Document here when a migration is created:

```sql
-- Rollback for: 20260717000001_add_business_name
ALTER TABLE "Instructor" DROP COLUMN IF EXISTS "businessName";

-- Rollback for: 20260718000001_add_account_type_payment_mode
ALTER TABLE "Instructor" DROP COLUMN IF EXISTS "accountType";
ALTER TABLE "Instructor" DROP COLUMN IF EXISTS "paymentMode";
```

---

## Post-Release Monitoring

After any major release, monitor these for 24 hours:

| Signal | Where | Alert if |
|---|---|---|
| 5xx error rate | Vercel logs | > 1% of requests |
| Payment failures | Stripe dashboard | Any spike |
| Booking creation errors | `/api/public/bookings/bulk` logs | Any 500s |
| Webhook delivery | Stripe dashboard | Failed deliveries |
| Cron health | `/admin/cron-jobs` | Any failed runs |
| Auth errors | Vercel logs | 401 spike |

---

## Environment Variable Changes

When adding a new `.env` variable:

1. Add to `.env.example` with a description
2. Document in `HARDCODED_VALUES.md` if it controls a business value
3. Set in Vercel dashboard (Settings → Environment Variables) for production
4. Set in Vercel dashboard for Preview environment
5. Confirm `validateEnv.ts` check exists if the variable is required at startup

**Never commit `.env` to git.** It contains production secrets.
