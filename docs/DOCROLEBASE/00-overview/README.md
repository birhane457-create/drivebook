# DriveBook Documentation Hub

**Platform:** drivebook.com.au  
**Last Updated:** March 2026  
**Governing Law:** Western Australia  

---

## What is DriveBook?

DriveBook is a platform connecting driving instructors with learner drivers in Australia. It handles booking, payments, subscriptions, and instructor management.

---

## Documentation by Role

### 01-public — No login required
| File | Covers |
|------|--------|
| [LANDING_PAGE.md](../01-public/LANDING_PAGE.md) | `/` homepage — structure, copy decisions, component map |
| [BOOKING_FLOW.md](../01-public/BOOKING_FLOW.md) | `/book` search page + `/book/[instructorId]` profile & booking form |
| [PAYMENT_PAGE.md](../01-public/PAYMENT_PAGE.md) | `/booking/[id]/payment` — Stripe payment |
| [SUBDOMAIN_PAGE.md](../01-public/SUBDOMAIN_PAGE.md) | `/subdomain/[slug]` — instructor white-label page |

### 02-student — Logged-in student (CLIENT role)
| File | Covers |
|------|--------|
| [DASHBOARD.md](../02-student/DASHBOARD.md) | Student home, progress overview |
| [WALLET.md](../02-student/WALLET.md) | Wallet balance, top-up, transaction history |
| [BOOKINGS.md](../02-student/BOOKINGS.md) | View, reschedule, cancel bookings |
| [REVIEWS.md](../02-student/REVIEWS.md) | Leave and view lesson reviews |
| [SETTINGS.md](../02-student/SETTINGS.md) | Profile, password, notifications |

### 03-instructor — Solo instructor (INSTRUCTOR role)
| File | Covers |
|------|--------|
| [DASHBOARD.md](../03-instructor/DASHBOARD.md) | Instructor home, stats, quick actions |
| [BOOKINGS.md](../03-instructor/BOOKINGS.md) | Manage bookings, reschedule, check-in |
| [EARNINGS.md](../03-instructor/EARNINGS.md) | Weekly/daily earnings, payout schedule |
| [CHECK_IN.md](../03-instructor/CHECK_IN.md) | Mobile check-in flow |
| [CLIENTS.md](../03-instructor/CLIENTS.md) | Client list, add/edit, book on behalf |
| [AVAILABILITY.md](../03-instructor/AVAILABILITY.md) | Working hours, exceptions |
| [PRICING.md](../03-instructor/PRICING.md) | Hourly rate, packages, lesson durations |
| [BRANDING.md](../03-instructor/BRANDING.md) | Logo, colors, subdomain, social links |
| [SETTINGS.md](../03-instructor/SETTINGS.md) | Profile, vehicle, documents, notifications |

### 04-business — Driving school / multi-instructor (BUSINESS tier)
| File | Covers |
|------|--------|
| [DASHBOARD.md](../04-business/DASHBOARD.md) | School overview, team stats |
| [INSTRUCTORS.md](../04-business/INSTRUCTORS.md) | Add/manage team instructors |
| [TEAM_CALENDAR.md](../04-business/TEAM_CALENDAR.md) | Combined availability view |
| [CLIENTS.md](../04-business/CLIENTS.md) | School-wide client management |
| [REVENUE.md](../04-business/REVENUE.md) | School revenue reporting |
| [SETTINGS.md](../04-business/SETTINGS.md) | School profile, domain, branding |
| [DOMAIN_SETUP.md](../04-business/DOMAIN_SETUP.md) | Custom domain configuration |

### 05-admin — Platform admin (ADMIN / SUPER_ADMIN role)
| File | Covers |
|------|--------|
| [DASHBOARD.md](../05-admin/DASHBOARD.md) | Platform stats, subscription overview, all admin page index |
| [INSTRUCTOR_APPROVALS.md](../05-admin/INSTRUCTOR_APPROVALS.md) | Approve/reject/suspend instructors, ABN verification gate |
| [DOCUMENTS.md](../05-admin/DOCUMENTS.md) | Document compliance overview + per-instructor review |
| [BOOKINGS.md](../05-admin/BOOKINGS.md) | All bookings — complete, no-show, cancel, action drawer |
| [CLIENTS.md](../05-admin/CLIENTS.md) | Client list, wallet management, booking management |
| [CREDITS.md](../05-admin/CREDITS.md) | Aggregate credit stats, zero/negative balance monitoring |
| [REVENUE.md](../05-admin/REVENUE.md) | Date-range revenue, transactions, refunds, CSV export |
| [PAYOUTS.md](../05-admin/PAYOUTS.md) | Eligible/withheld/disputed payouts, split resolution |
| [DISPUTES.md](../05-admin/DISPUTES.md) | Dispute resolution workflow |
| [REVIEWS.md](../05-admin/REVIEWS.md) | Review moderation |
| [SUPPORT.md](../05-admin/SUPPORT.md) | Quick links and operator reference |
| [STAFF_GOVERNANCE.md](../05-admin/STAFF_GOVERNANCE.md) | Governance controls, SLA monitoring, financial oversight |
| [SETTINGS.md](../05-admin/SETTINGS.md) | Platform settings, pricing, commission |
| [AUDIT_LOG.md](../05-admin/AUDIT_LOG.md) | Full history of all financial and admin actions |

### 06-payments — Financial flows
| File | Covers |
|------|--------|
| [STRIPE.md](../06-payments/STRIPE.md) | Stripe integration, webhooks, Price IDs |
| [WALLET.md](../06-payments/WALLET.md) | Client wallet mechanics |
| [REFUNDS.md](../06-payments/REFUNDS.md) | Refund tiers and policy |
| [COMMISSIONS.md](../06-payments/COMMISSIONS.md) | Per-tier commission rates, DB-driven |
| [PAYOUTS.md](../06-payments/PAYOUTS.md) | Instructor payout eligibility |

### 07-subscriptions — Instructor plans
| File | Covers |
|------|--------|
| [TIERS.md](../07-subscriptions/TIERS.md) | BASIC / PRO / BUSINESS feature comparison |
| [TRIAL.md](../07-subscriptions/TRIAL.md) | Trial period mechanics |
| [BILLING.md](../07-subscriptions/BILLING.md) | Monthly/annual billing, Stripe portal |
| [UPGRADE_FLOW.md](../07-subscriptions/UPGRADE_FLOW.md) | Upgrade/downgrade/cancel flows |

### 08-technical — API & Database
| File | Covers |
|------|--------|
| [CODEBASE_MAP.md](../08-technical/CODEBASE_MAP.md) | Feature-grouped map of every file — where to find anything |
| [DATABASE_SCHEMA.md](../01-architecture/DATABASE_SCHEMA.md) | Full Prisma schema reference |
| [API_REFERENCE.md](../08-technical/API_REFERENCE.md) | All API routes by domain |
| [WEBHOOKS.md](../08-technical/WEBHOOKS.md) | Stripe webhook handling |

---

## Deep-Reference Docs (stay in original locations — richer than role-based summaries)

| File | Why it's the authoritative source |
|------|----------------------------------|
| `docs/00-foundation/STATE_MACHINE.md` | Full booking state diagram + transition table + validTransitions code |
| `docs/00-foundation/FINANCIAL_DOCTRINE.md` | Ledger reconstruction, reconciliation code, payout protection, wallet optimistic locking |
| `docs/BOOKING_SYSTEM.md` | Complete booking system — all 10 sections, edge cases, concurrency patterns |
| `docs/SUBSCRIPTION_SYSTEM.md` | Full subscription API docs, known gaps log, Stripe integration status |
| `docs/SUBDOMAIN_SYSTEM.md` | DNS setup, middleware code, local dev, SEO meta, branding tiers detail |
| `docs/PUBLIC_BOOKING_FLOW.md` | Voice service bookings, rate limiting deep dive, production checklist |
| `docs/01-architecture/DATABASE_SCHEMA.md` | Full Prisma schema with all fields and data integrity rules |
| `docs/04-legal/CANCELLATION_POLICY.md` | Legal display requirements, dispute evidence, policy versioning |

---

## System Documentation (Cross-Cutting)

| File | Covers |
|------|--------|
| [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md) | Platform purpose, core principles, roles, key constraints |
| [SYSTEM_FLOWS.md](./SYSTEM_FLOWS.md) | End-to-end flows: booking, cancellation, no-show, dispute, reconciliation, ABN, onboarding |
| [STATE_MACHINES.md](./STATE_MACHINES.md) | All entity state diagrams: booking, instructor, transaction, payout, ABN, wallet |
| [SYSTEM_OF_RECORD.md](./SYSTEM_OF_RECORD.md) | Authoritative data source per domain — resolves conflicts |
| [CONTROL_GUARANTEES.md](./CONTROL_GUARANTEES.md) | What the system guarantees and the mechanism enforcing each |
| [FAILURE_HANDLING.md](./FAILURE_HANDLING.md) | How failures are detected, alerted, and manually recovered |
| [GLOSSARY.md](./GLOSSARY.md) | Term definitions |

---

## Quick Reference

- **Timezone:** Australia/Perth (AWST, UTC+8)
- **Currency:** AUD
- **GST:** 10% (included in displayed prices)
- **Commission:** BASIC 15% / PRO 12% / BUSINESS 10% (DB-configurable via `/admin/pricing`)
- **Trial:** BASIC/PRO 14 days, BUSINESS 30 days
- **Refund window:** ≥48h full / 24–48h 50% / <24h none
- **Slot hold:** 10 minutes (`PENDING_PAYMENT` → `EXPIRED`)
