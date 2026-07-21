# Platform Owner Guide

**Last Updated:** July 2026  
**For:** Platform owner (SUPER_ADMIN)

---

## Your Role

As platform owner you control:
- Subscription pricing and commission rates
- Instructor approval and suspension
- Payout processing and dispute resolution
- Staff (admin) account management
- Platform settings and integrations

---

## Access

Login at `/login` with your SUPER_ADMIN account.  
Bootstrap: `node create-admin.js` (requires `ADMIN_BOOTSTRAP_KEY` env var, disabled once used).

---

## Staff Management

Create admin accounts for staff via the admin panel. ADMIN accounts have full access except:
- Cannot create other admin accounts (SUPER_ADMIN only)
- Cannot change platform pricing (SUPER_ADMIN only)

---

## Subscription Tiers

| Tier | Monthly | Annual | Commission | Trial |
|------|---------|--------|------------|-------|
| BASIC | $29 | $290 | 15% | 14 days |
| PRO | $79 | $790 | 12% | 14 days |
| STUDIO | $129 | $1,290 | 11% | 14 days |
| BUSINESS | $199 | $1,990 | 10% | 30 days |

**Change rates:** `/admin/pricing` — rates apply to new bookings immediately.  
**Schedule future changes:** Rate Change Scheduler on the same page — instructors are notified before effective date.

Stripe price IDs for each tier are set in Vercel env vars. BUSINESS tier is "Coming Soon" until multi-instructor management is built.

---

## Weekly Financial Review

Use `docs/WEEKLY_RECONCILIATION_TEMPLATE.md` as the agenda.

Key checks:
1. Platform revenue this month vs last month (`/admin/revenue`)
2. Pending payouts to process (`/admin/payouts`)
3. Open disputes needing response (`/admin/disputes`)
4. Instructors with documents expiring in 30 days (`/admin/documents`)
5. Unverified ABNs — instructors with 47% withholding tax applied (`/admin/instructors`)

---

## Key Financial Rules

- **Commission locked at booking time** — rate changes never retroactively affect existing bookings
- **Withholding tax** — 47% applied if instructor has no verified ABN; 0% with verified ABN
- **Refund tiers** — ≥48h = 100%, 24–48h = 50%, <24h = 0%
- **Payout hold** — any booking under dispute has payout frozen until resolved
- **Platform ledger** — real-time balance visible on `/admin/revenue`

---

## Escalation Path

| Level | Who handles | When |
|-------|-------------|------|
| 1 | Admin staff | Routine approvals, support requests |
| 2 | Senior admin | Disputed payouts, large refunds, instructor suspension |
| 3 | You (Owner) | Chargeback disputes, policy changes, platform settings |

---

## Production Infrastructure

| Service | Provider | URL |
|---------|----------|-----|
| Main app | Vercel | drivebook.com.au |
| Database | Neon (PostgreSQL) | — |
| Voice AI | Railway | voice.drivebook.com.au |
| Redis | Upstash | — (session recovery) |
| Payments | Stripe | — |
| SMS/Voice | Twilio | — |
| File uploads | Cloudinary | — |

---

## Monitoring

- **Cron jobs:** `/admin/cron-jobs` — health of all scheduled tasks
- **Build errors:** Vercel deployment logs
- **Stripe:** dashboard.stripe.com — webhook health, dispute deadlines
- **Voice AI:** Railway logs, VAPI dashboard

---

## Before Going Live Checklist

- [ ] Set live Stripe keys + 8 price IDs in Vercel env vars
- [ ] Set `STRIPE_WEBHOOK_SECRET` for live webhook endpoint
- [ ] Verify `GOOGLE_REDIRECT_URI` in Google Cloud Console
- [ ] Set `NEXT_PUBLIC_VOICE_PHONE_NUMBER` (real AU number)
- [ ] Set Firebase env vars for mobile push notifications
- [ ] Set `VOICE_SERVICE_API_KEY` in Railway
- [ ] Configure Stripe Billing Portal (plan switching + proration)
- [ ] Submit sitemap to Google Search Console
- [ ] Replace placeholder ABN on `/about` page

Full pre-launch checklist: `docs/DOCROLEBASE/TODO.md` → Pre-Launch Config section.
