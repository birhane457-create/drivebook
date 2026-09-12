# DriveBook Documentation

**Status:** ✅ Current  
**Last Updated:** 2026-09-01

---

**Welcome!** This is the main documentation hub for the DriveBook platform.

## Quick Start

- **New Developer?** → Start with [DOCROLEBASE/INDEX.md](./DOCROLEBASE/INDEX.md)
- **Need test accounts?** → See [TEST_USERS.md](./TEST_USERS.md)
- **Setting up Stripe?** → See [STRIPE_SETUP_GUIDE.md](./STRIPE_SETUP_GUIDE.md)
- **Mobile app?** → See [mobile/START_HERE.md](./mobile/START_HERE.md)

## Documentation Structure

### DOCROLEBASE/ (Main Documentation)

**This is the authoritative, living documentation organized by role.**

`
DOCROLEBASE/
├── INDEX.md               ← Start here! Navigation hub
├── 00-overview/           ← System architecture & glossary
├── 01-public/             ← Public booking flow & SEO
├── 02-student/            ← Student dashboard features
├── 03-instructor/         ← Instructor dashboard & features
├── 04-business/           ← Multi-provider features (coming soon)
├── 05-admin/              ← Admin panel documentation
├── 06-payments/           ← Wallet, payouts, receipts
├── 07-subscriptions/      ← Tiers, billing, trials
└── 08-technical/          ← API reference, webhooks, security
`

**Key documents:**
- [DOCROLEBASE/INDEX.md](./DOCROLEBASE/INDEX.md) - Master index by role & feature
- [DOCROLEBASE/00-overview/SYSTEM_OVERVIEW.md](./DOCROLEBASE/00-overview/) - Architecture overview
- [DOCROLEBASE/08-technical/CODEBASE_MAP.md](./DOCROLEBASE/08-technical/) - Code navigation
- [DOCROLEBASE/08-technical/API_REFERENCE.md](./DOCROLEBASE/08-technical/) - All API endpoints

### Root Docs (Quick Reference)

| File | Purpose |
|------|---------|
| [README.md](../README.md) | Project overview & setup |
| [TEST_USERS.md](./TEST_USERS.md) | Test account credentials |
| [NAVIGATION_ARCHITECTURE.md](./NAVIGATION_ARCHITECTURE.md) | Route structure |
| [BOOKING_SYSTEM.md](./BOOKING_SYSTEM.md) | Booking flow overview |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | UI components & styling |
| [STRIPE_SETUP_GUIDE.md](./STRIPE_SETUP_GUIDE.md) | Stripe configuration |
| [TWILIO_SETUP_GUIDE.md](./TWILIO_SETUP_GUIDE.md) | SMS configuration |
| [SUBDOMAIN_SYSTEM.md](./SUBDOMAIN_SYSTEM.md) | White-label setup |
| [SUBSCRIPTION_SYSTEM.md](./SUBSCRIPTION_SYSTEM.md) | Tier & billing |
| [PUBLIC_BOOKING_FLOW.md](./PUBLIC_BOOKING_FLOW.md) | Public API |
| [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md) | Business overview |

### Specialized Areas

- **mobile/** - Mobile app (Capacitor) documentation
- **newplan/** - Feature planning & roadmap
- **operations/** - Operational procedures
- **pr/** - PR-ready feature documentation
- **archive/** - Historical/deprecated docs

### .kiro/steering/ (AI Agent Instructions)

Auto-loaded by Kiro IDE when working on the project:
- platform-model.md - Core mental model & quick facts
- doc-sync.md - Documentation update rules

## By Role

### I'm a Student
- How do I book a lesson? → [DOCROLEBASE/01-public/BOOKING_FLOW_COMPLETE.md](./DOCROLEBASE/01-public/)
- How does the wallet work? → [DOCROLEBASE/06-payments/WALLET.md](./DOCROLEBASE/06-payments/)
- Refund policy? → [DOCROLEBASE/06-payments/REFUNDS.md](./DOCROLEBASE/06-payments/)

### I'm an Instructor
- Dashboard overview → [DOCROLEBASE/03-instructor/DASHBOARD.md](./DOCROLEBASE/03-instructor/)
- How do payouts work? → [DOCROLEBASE/06-payments/PAYOUTS.md](./DOCROLEBASE/06-payments/)
- Setting up branding → [DOCROLEBASE/03-instructor/BRANDING.md](./DOCROLEBASE/03-instructor/)
- Subscription tiers → [DOCROLEBASE/07-subscriptions/TIERS.md](./DOCROLEBASE/07-subscriptions/)

### I'm an Admin
- Admin dashboard → [DOCROLEBASE/05-admin/DASHBOARD.md](./DOCROLEBASE/05-admin/)
- Approving instructors → [DOCROLEBASE/05-admin/INSTRUCTOR_APPROVALS.md](./DOCROLEBASE/05-admin/)
- Revenue tracking → [DOCROLEBASE/05-admin/REVENUE.md](./DOCROLEBASE/05-admin/)

### I'm a Developer
- System overview → [DOCROLEBASE/00-overview/SYSTEM_OVERVIEW.md](./DOCROLEBASE/00-overview/)
- Codebase map → [DOCROLEBASE/08-technical/CODEBASE_MAP.md](./DOCROLEBASE/08-technical/)
- API reference → [DOCROLEBASE/08-technical/API_REFERENCE.md](./DOCROLEBASE/08-technical/)
- Security → [DOCROLEBASE/08-technical/SECURITY_ASSESSMENT.md](./DOCROLEBASE/08-technical/)

## Quick Facts

| Property | Value |
|----------|-------|
| **Framework** | Next.js 14 (App Router) |
| **Database** | PostgreSQL + Prisma |
| **Auth** | NextAuth.js |
| **Payments** | Stripe + Stripe Connect |
| **Timezone** | Australia/Perth (AWST, UTC+8) |
| **Currency** | AUD |
| **Platform Fee** | 3.6% of booking total |
| **Commission** | 10-15% (tier-dependent) |

## Recent Updates

### Instructor Directory (2026-09-01)
- New /instructors route with auto-search
- 17,396 suburbs with autocomplete
- See: [pr/INSTRUCTORS_DIRECTORY_IMPLEMENTATION.md](./pr/)

### Decimal Migration (2026-08)
- All currency calculations use Decimal.js
- Ensures precision in financial transactions

## Support

- **Email**: support@drivebook.com.au
- **Documentation Issues**: Update DOCROLEBASE and sync steering files
- **Code Issues**: Check [DOCROLEBASE/08-technical/](./DOCROLEBASE/08-technical/)

---

**Last Updated:** 2026-09-01  
**Maintained By:** Development Team  
**Source of Truth:** DOCROLEBASE/
