# DriveBook Documentation Index

**Purpose:** Quick reference to find documentation by topic.  
This index reflects the current state of the system â€” not history.

> **AI Agent:** Before any code change, read `.kiro/steering/platform-model.md` and `.kiro/steering/doc-sync.md`. Both are auto-loaded by Kiro.

---

## By Role

### Students / Clients
- Booking a lesson â†’ `01-public/BOOKING_FLOW_COMPLETE.md`
- Payments & wallet â†’ `06-payments/WALLET.md`
- Cancellations & refunds â†’ `06-payments/REFUNDS.md`
- Client dashboard â†’ `02-student/DASHBOARD.md`
- Awaiting payment â†’ `02-student/AWAITING_PAYMENT.md`

### Instructors / Providers
- Dashboard â†’ `03-instructor/DASHBOARD.md`
- Schedule (Today / Week / Agenda) â†’ `03-instructor/SCHEDULE.md`
- Bookings â†’ `03-instructor/BOOKINGS.md`
- Availability â†’ `03-instructor/AVAILABILITY.md`
- Earnings & payouts â†’ `06-payments/PAYOUTS.md`
- Approval & onboarding â†’ `03-instructor/ONBOARDING_APPROVAL.md`
- Subscription tiers â†’ `07-subscriptions/TIERS.md`
- Stripe Connect setup â†’ `07-subscriptions/STRIPE_CONNECT_SETUP.md`
- Branding, logo, domain â†’ `03-instructor/BRANDING.md`
- Marketing flyer & business cards â†’ `03-instructor/MARKETING.md`

### Admin
- Dashboard â†’ `05-admin/DASHBOARD.md`
- Instructor approvals â†’ `05-admin/INSTRUCTOR_APPROVALS.md`
- Revenue â†’ `05-admin/REVENUE.md`
- Audit log â†’ `05-admin/AUDIT_LOG.md`
- Disputes â†’ `05-admin/DISPUTES.md`
- Payouts â†’ `06-payments/PAYOUTS.md`

### Developers
- System overview â†’ `00-overview/SYSTEM_OVERVIEW.md`
- Codebase map â†’ `08-technical/CODEBASE_MAP.md`
- All API endpoints â†’ `08-technical/API_REFERENCE.md`
- Stripe & webhooks â†’ `06-payments/STRIPE.md`, `08-technical/WEBHOOKS.md`
- Security â†’ `08-technical/SECURITY_ASSESSMENT.md`
- Rate limiting â†’ `08-technical/RATE_LIMITING.md`
- Cron jobs â†’ `08-technical/CRON_JOBS.md`
- UI design system â†’ `08-technical/STYLING.md`

---

## By Feature Area

### Booking System
- Complete user journey â†’ `01-public/BOOKING_FLOW_COMPLETE.md`
- High-level overview â†’ `01-public/BOOKING_FLOW.md`
- Slot persistence â†’ `01-public/SLOT_PERSISTENCE_FIX.md`
- Double-booking prevention â†’ `01-public/RACE_CONDITION_FIX.md`
- Instructor microsite â†’ `01-public/SUBDOMAIN_PAGE.md`
- Instructor view â†’ `03-instructor/BOOKINGS.md`

### Payments & Wallet
- Wallet mechanics â†’ `06-payments/WALLET.md`
- Stripe integration â†’ `06-payments/STRIPE.md`
- Instructor payouts â†’ `06-payments/PAYOUTS.md`
- Commission rates â†’ `06-payments/COMMISSIONS.md`
- Receipts â†’ `06-payments/RECEIPTS.md`
- Webhooks â†’ `08-technical/WEBHOOKS.md`

### Subscriptions & Billing
- Tier comparison (BASIC/PRO/STUDIO/PREMIUM) â†’ `07-subscriptions/TIERS.md`
- Billing & invoicing â†’ `07-subscriptions/BILLING.md`
- Trial mechanics â†’ `07-subscriptions/TRIAL.md`
- Upgrade/downgrade/cancel â†’ `07-subscriptions/UPGRADE_FLOW.md`
- Trial enforcement â†’ `07-subscriptions/TRIAL_ENFORCEMENT.md`

### Branding & White-Label
- Provider branding (logo, colours, slug) â†’ `03-instructor/BRANDING.md`
- Public booking page (subdomain) â†’ `01-public/SUBDOMAIN_PAGE.md`
- Custom domain setup â†’ `04-business/DOMAIN_SETUP.md`
- Display name rules â†’ `.kiro/steering/platform-model.md`

### Multi-Vertical / Business Model
- Platform mental model â†’ `.kiro/steering/platform-model.md`
- Multi-provider features â†’ `04-business/` âš ï¸ **Coming Soon â€” BUSINESS tier not yet implemented**

### Security
- Security scorecard & controls â†’ `08-technical/SECURITY_ASSESSMENT.md`
- Rate limiting â†’ `08-technical/RATE_LIMITING.md`
- Fraud signals & device tracking â†’ `operations/07-security-fraud.md`
- Approval gates â†’ `03-instructor/ONBOARDING_APPROVAL.md`
- Document verification â†’ `05-admin/DOCUMENTS.md`

### Voice AI / Receptionist
- Integration guide â†’ `08-technical/VOICE_AI_RECEPTIONIST.md`
- Booking API voice fields â†’ `01-public/BOOKING_FLOW_COMPLETE.md`

---

## Deep-Reference Docs

These are authoritative sources â€” richer than the role-based summaries above.

| File | Why authoritative |
|------|------------------|
| `docs/00-foundation/STATE_MACHINE.md` | Full booking state diagram, transition table, validTransitions code |
| `docs/00-foundation/FINANCIAL_DOCTRINE.md` | Ledger reconstruction, reconciliation, payout protection, wallet locking |
| `docs/SUBSCRIPTION_SYSTEM.md` | Full subscription API docs, Stripe integration, payment mode |
| `docs/SUBDOMAIN_SYSTEM.md` | DNS setup, middleware, branding tiers, custom domain flow |
| `docs/PUBLIC_BOOKING_FLOW.md` | Voice service bookings, rate limiting, production checklist |
| `docs/01-architecture/DATABASE_SCHEMA.md` | Full Prisma schema with all fields and integrity rules |
| `docs/04-legal/CANCELLATION_POLICY.md` | Legal requirements, dispute evidence, policy versioning |

---

## Quick Facts

| Property | Value |
|----------|-------|
| Timezone | `Australia/Perth` (AWST, UTC+8) |
| Currency | AUD |
| Platform fee | 3.6% of booking total |
| Commission | BASIC 15% / PRO 12% / STUDIO 11% / PREMIUM 10% |
| Trial | BASIC/PRO/STUDIO 14 days Â· PREMIUM 30 days |
| Slot hold | 10 minutes (`PENDING_PAYMENT` â†’ `EXPIRED`) |
| Refund window | â‰¥48h full Â· 24â€“48h 50% Â· <24h none |
| Payout frequency | Weekly (Tuesdays, 48h settlement) |
| ABN withholding | 47% withheld if no ABN (remitted to ATO) |

---

## Directory Structure

```
docs/DOCROLEBASE/
â”œâ”€â”€ 00-overview/        â† system overview, glossary, flows, state machines
â”œâ”€â”€ 01-public/          â† public booking, subdomain, SEO
â”œâ”€â”€ 02-student/         â† student dashboard
â”œâ”€â”€ 03-instructor/      â† instructor dashboard & features
â”œâ”€â”€ 04-business/        â† multi-provider (âš ï¸ Coming Soon)
â”œâ”€â”€ 05-admin/           â† admin panel
â”œâ”€â”€ 06-payments/        â† wallet, commissions, payouts, receipts
â”œâ”€â”€ 07-subscriptions/   â† tiers, billing, trial
â””â”€â”€ 08-technical/       â† webhooks, codebase map, API reference

.kiro/steering/         â† AI agent standing instructions (always loaded)
  â”œâ”€â”€ platform-model.md   â† core mental model + quick facts
  â””â”€â”€ doc-sync.md         â† doc update rules

docs/newplan/           â† planning notes (NOT living docs â€” do not update)
```

---

## Status

| Area | Status |
|------|--------|
| TypeScript | âœ… 0 errors |
| Public booking flow | âœ… Complete â€” `getDisplayName()` wired everywhere |
| White-label (PREMIUM) | âœ… Complete â€” business name on all public surfaces |
| BUSINESS tier (multi-provider) | â³ Coming Soon â€” UI placeholder only |
| DIRECT payment mode | â³ Phase 2 â€” blocked by `assertPlatformPaymentMode()` |
| Steering files | âœ… `platform-model.md`, `doc-sync.md` |
