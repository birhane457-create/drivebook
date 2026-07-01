# DriveBook Documentation Index

**Last Updated:** July 2026  
**Purpose:** Quick reference to find documentation by topic

---

## Quick Links by Role

### 👤 For Students/Clients
- **Booking a lesson:** `01-public/BOOKING_FLOW_COMPLETE.md`
- **How payments work:** `06-payments/WALLET.md`
- **Cancellations & refunds:** `06-payments/REFUNDS.md`
- **Dashboard features:** `02-student/DASHBOARD.md`
- **Awaiting Payment bookings:** `02-student/AWAITING_PAYMENT.md` ⭐ NEW

### 👨‍🏫 For Instructors
- **Dashboard overview:** `03-instructor/DASHBOARD.md`
- **Managing bookings:** `03-instructor/BOOKINGS.md`
- **Setting availability:** `03-instructor/AVAILABILITY.md`
- **Understanding payouts:** `06-payments/PAYOUTS.md`
- **Approval process:** `03-instructor/ONBOARDING_APPROVAL.md`
- **Subscription tiers:** `07-subscriptions/TIERS.md`
- **Stripe Connect setup:** `07-subscriptions/STRIPE_CONNECT_SETUP.md`

### 👔 For Admin/Support
- **Admin dashboard:** `05-admin/DASHBOARD.md`
- **Approval management:** `05-admin/INSTRUCTOR_APPROVALS.md`
- **Revenue tracking:** `05-admin/REVENUE.md`
- **Audit logs:** `05-admin/AUDIT_LOG.md`
- **Handling disputes:** `05-admin/DISPUTES.md`
- **Payouts process:** `06-payments/PAYOUTS.md`

### 🔧 For Developers
- **System overview:** `00-overview/SYSTEM_OVERVIEW.md`
- **All API endpoints:** `08-technical/API_REFERENCE.md`
- **Database schema:** `08-technical/CODEBASE_MAP.md`
- **Stripe integration:** `06-payments/STRIPE.md`
- **Security considerations:** `08-technical/SECURITY_ASSESSMENT.md`
- **UI design system:** `08-technical/STYLING.md`
- **SEO & sitemap:** `08-technical/SEO.md` ⭐ NEW
- **Cron jobs:** `08-technical/CRON_JOBS.md`
- **Blog system:** `01-public/BLOG.md` ⭐ NEW

---

## What Changed Recently (July 2026)

✅ **Security fixes, blog platform, SEO infrastructure complete:**
1. Auth gate for unapproved instructors; session 30d→7d
2. requireRole() DB-verified admin checks; MIME upload validation
3. Email/SMS retry queue with exponential backoff
4. Mobile push notifications (FCM, DeviceToken)
5. Blog: 23 posts, featured hero, tags, prev/next, related articles
6. Tag archive pages, RSS feed
7. Sitemap, robots.txt, Organization/WebSite JSON-LD
8. Instructor search language + vehicle type filters in UI
9. Batch booking security hardening
10. Dashboard JSX/encoding fixes

**See:** `00-overview/CHANGES.md` for detailed summary

---

## Browse by Feature

### Booking System
- `01-public/BOOKING_FLOW_COMPLETE.md` — Complete user journey (all 8 steps)
- `01-public/BOOKING_FLOW.md` — High-level overview
- `01-public/SLOT_PERSISTENCE_FIX.md` — How slots persist in database
- `01-public/RACE_CONDITION_FIX.md` — Double-booking prevention
- `01-public/BLOG.md` — Blog platform architecture & content ⭐ NEW
- `01-public/SUBDOMAIN_PAGE.md` — Instructor microsite booking
- `03-instructor/BOOKINGS.md` — Instructor perspective

### Payments & Wallet
- `06-payments/WALLET.md` — Wallet top-up & balance
- `06-payments/STRIPE.md` — Stripe integration details
- `06-payments/PAYOUTS.md` — How instructors get paid
- `06-payments/COMMISSIONS.md` — Platform fees & earnings split

### Subscriptions & Billing
- `07-subscriptions/TIERS.md` — Instructor subscription tiers
- `07-subscriptions/BILLING.md` — Billing cycle & invoicing
- `07-subscriptions/STRIPE_CONNECT_SETUP.md` — Payout setup instructions
- `07-subscriptions/TRIAL.md` — Trial period details

### Instructor Features
- `03-instructor/AVAILABILITY.md` — Calendar & time slot management
- `03-instructor/PDA_TESTS.md` — Practical driving assessment bookings
- `03-instructor/PRICING.md` — Setting hourly rates & packages
- `03-instructor/CLIENTS.md` — Managing student relationships

### Student Features
- `02-student/BOOKINGS.md` — View & manage bookings
- `02-student/AWAITING_PAYMENT.md` — Pending payment bookings management ⭐ NEW
- `02-student/WALLET.md` — Wallet & payment methods
- `02-student/NOTIFICATIONS.md` — Email & SMS notifications
- `02-student/REVIEWS.md` — Rating & review system

### Business/Admin
- `04-business/REVENUE.md` — Revenue reporting
- `04-business/INSTRUCTORS.md` — Instructor management
- `04-business/CLIENTS.md` — Client database
- `05-admin/DASHBOARD.md` — Admin dashboard features

---

## By Topic

### Email & Notifications
- `02-student/NOTIFICATIONS.md` — Email/SMS notification system
- `01-public/BOOKING_FLOW_COMPLETE.md` — Email sent when booking created
- **New Fix:** All booking methods now send email (see 00-overview/CHANGES.md)

### Pricing & Fees
- `06-payments/COMMISSIONS.md` — How 3.6% platform fee calculated
- `03-instructor/PRICING.md` — Instructor pricing options
- `07-subscriptions/BILLING.md` — Subscription fees

### Security & Verification
- `08-technical/SECURITY_ASSESSMENT.md` — Security considerations
- `03-instructor/ONBOARDING_APPROVAL.md` — Approval gates & verification
- `05-admin/DOCUMENTS.md` — Document verification process

### Troubleshooting
- `06-payments/REFUNDS.md` — Handling refunds & cancellations
- `05-admin/DISPUTES.md` — Dispute resolution process
- `05-admin/SUPPORT.md` — Support ticket management

---

## Organization Structure

```
docs/DOCROLEBASE/
├── 00-overview/              ← System overview & changes
│   ├── README.md
│   ├── CHANGES.md            ← ⭐ Latest updates (June 13)
│   ├── SYSTEM_OVERVIEW.md
│   └── ...
│
├── 01-public/                ← Public booking site
│   ├── BOOKING_FLOW_COMPLETE.md  ← ⭐ Updated with all 5 fixes
│   ├── SLOT_PERSISTENCE_FIX.md   ← New Fix #1
│   ├── RACE_CONDITION_FIX.md     ← New Fix #2
│   └── ...
│
├── 02-student/               ← Student dashboard & features
├── 03-instructor/            ← Instructor dashboard & features
├── 04-business/              ← Business/company features
├── 05-admin/                 ← Admin panel & management
├── 06-payments/              ← Payment processing & payouts
├── 07-subscriptions/         ← Subscription tiers & billing
└── 08-technical/             ← Developer documentation
```

---

## How to Use This Documentation

### I need to understand how [feature] works
→ Find it in "Browse by Feature" section above

### I need to implement [feature]
→ Check "08-technical/" folder for API & code references

### I need to explain to a user how to [task]
→ Find their role, then look in their section

### I want to know what changed recently
→ Read "00-overview/CHANGES.md"

### I'm troubleshooting a problem
→ Check "Troubleshooting" section above

---

## Recent Updates Summary

| Category | What Changed | When | Where |
|----------|--------------|------|-------|
| Dashboard | Students can see awaiting-payment bookings | June 13 | 02-student/AWAITING_PAYMENT.md ⭐ |
| Email | All booking methods now send notifications | June 13 | 01-public/BOOKING_FLOW_COMPLETE.md |
| Slots | Database persistence + auto-cleanup | June 13 | 01-public/SLOT_PERSISTENCE_FIX.md |
| Race Conditions | Atomic transactions | June 13 | 01-public/RACE_CONDITION_FIX.md |
| PDA Tests | Linked to parent booking | June 13 | 00-overview/CHANGES.md |
| Overview | Summary of all 6 fixes | June 13 | 00-overview/CHANGES.md |

---

## Key Files for Reference

**For understanding the system:**
- `00-overview/SYSTEM_OVERVIEW.md` — High-level architecture
- `00-overview/CHANGES.md` — What was updated and why

**For understanding booking flow:**
- `01-public/BOOKING_FLOW_COMPLETE.md` — Complete step-by-step journey
- `08-technical/API_REFERENCE.md` — All API endpoints

**For understanding payments:**
- `06-payments/WALLET.md` — How wallet works
- `06-payments/PAYOUTS.md` — How payouts work
- `06-payments/COMMISSIONS.md` — How platform fee calculated

**For understanding infrastructure:**
- `08-technical/CODEBASE_MAP.md` — File structure & organization
- `08-technical/STYLING.md` — UI design system
- `08-technical/SECURITY_ASSESSMENT.md` — Security considerations

---

## Quick Facts

- **Booking success rate:** ~90% (target: 95%+)
- **Platform fee:** 3.6% of booking total
- **Instructor payout:** 96.4% of lesson price (before Stripe fees)
- **Slot hold duration:** 10 minutes
- **Subscription trial:** 7 days free
- **Payout frequency:** Every Tuesday (48-hour settlement)

---

## Status

✅ All documentation up-to-date with code (July 2026)  
✅ Blog platform complete (23 posts, tags, RSS)  
✅ SEO infrastructure complete  
✅ Security fixes applied  
✅ TypeScript verification: 0 errors  
✅ Production-ready

---

**Last verified:** June 13, 2026  
**Next review:** When new features added  
**Maintained by:** Development Team
