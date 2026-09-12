# 04 — PREMIUM Tier (formerly BUSINESS)

**Status:** RENAMED — BUSINESS tier is now PREMIUM tier  
**Date:** August 18, 2026  
**Reason:** Clarifies that this tier is for solo instructors, not multi-instructor schools

---

## 📋 What Changed

### Tier Rename: BUSINESS → PREMIUM

**Why the rename?**
- BUSINESS tier was confusing — sounded like it was for schools, but was actually for solo instructors
- Features were 30% complete: solo instructor premium features ✅, multi-instructor management ❌
- Renaming to PREMIUM makes it clear: this is the highest tier for **solo instructors**

**What's the same:**
- ✅ Same price: $199/month or $1990/year
- ✅ Same commission: 10%
- ✅ Same trial period: 30 days
- ✅ Same features: business name, custom domain, dedicated phone line, white-label
- ✅ Same `accountType = 'BUSINESS'` for feature flags (unchanged)

**What's different:**
- ✅ Honest about multi-instructor: NOT included (coming in future SCHOOL tier)
- ✅ Clear limit: 1 instructor only
- ✅ No misleading promises about team management

---

## 🎯 PREMIUM Tier Features

### Solo Instructor Premium Features

**Branding & Identity:**
- ✅ Business name displays everywhere (emails, SMS, booking pages, AI receptionist)
- ✅ Custom domain support (e.g., `book.myschool.com.au`)
- ✅ Full white-label customization
- ✅ Custom logo and brand colors

**Communication:**
- ✅ Dedicated AI receptionist phone number
- ✅ Business name in all communications

**Financial:**
- ✅ 10% commission (lowest rate for solo instructors)
- ✅ 30-day trial period
- ✅ Commission-free mode available (admin-activated, contact support)

**Support:**
- ✅ Priority phone support
- ✅ API access

---

## ❌ What PREMIUM Does NOT Include

**Multi-Instructor Management:**
- ❌ Team instructor management
- ❌ School dashboard
- ❌ Team calendar
- ❌ Aggregate school reporting
- ❌ Organisation-level branding

**Note:** Multi-instructor features are planned for future **SCHOOL** and **ENTERPRISE** tiers (not yet available).

---

## 📂 Documentation Structure

### Current (PREMIUM Tier):
- `DOMAIN_SETUP.md` — Custom domain configuration
- `SETTINGS.md` — Business settings and branding

### Archived (Future SCHOOL Tier):
- `ORGANISATION_PLAN.md` — Multi-instructor architecture (not implemented)
- `DASHBOARD.md` — School dashboard spec (not implemented)
- `INSTRUCTORS.md` — Team management spec (not implemented)
- `TEAM_CALENDAR.md` — School calendar spec (not implemented)
- `REVENUE.md` — School revenue reporting (not implemented)
- `CLIENTS.md` — School client management (not implemented)

**Note:** Files marked "not implemented" are planning documents for future SCHOOL tier.

---

## 🔄 Migration Notes

### For Existing BUSINESS Tier Users:
- Your tier will be automatically renamed to PREMIUM in the database
- **No feature changes** — everything works exactly the same
- **No price changes** — same $199/month
- Your `accountType` stays as `BUSINESS` (this controls feature flags)

### For New Users:
- Subscribe to PREMIUM tier for solo instructor premium features
- If you need multi-instructor management, contact support about SCHOOL tier (coming soon)

---

## 🚀 Future: SCHOOL Tier (Not Yet Available)

**Planned for future release:**
- Multi-instructor management
- Organisation model
- School-level branding
- Team calendar and reporting
- Commission options: 12% per booking OR flat rate per instructor

**Interested?** Contact support to express interest. We'll notify you when it's available.

---

## 🔗 Related Documentation

- [Subscription System](../07-subscriptions/README.md)
- [Custom Domain Setup](./DOMAIN_SETUP.md)
- [Future SCHOOL Tier Plan](./FUTURE_SCHOOL_TIER.md)

---

**Last Updated:** August 18, 2026  
**Tier Status:** ✅ PREMIUM tier active and working  
**School Features:** ❌ Not yet available (future SCHOOL tier)
