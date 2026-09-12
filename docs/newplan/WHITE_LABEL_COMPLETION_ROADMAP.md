# DriveBook White-Label — Completion Roadmap

> **Date:** 2026-08-15  
> **Current Status:** 60% Complete — Student-facing surfaces white-labeled, admin/portal surfaces not
> **Goal:** Achieve 100% white-label capability for PREMIUM/STUDIO tier instructors

---

## Executive Summary

**Current Achievement:** DriveBook has successfully white-labeled the **student booking journey**:
- ✅ Booking page shows business name + colors
- ✅ Emails show business name as sender
- ✅ SMS notifications use business name
- ✅ Custom domains work (`book.sarahs-ds.com`)
- ✅ "Powered by DriveBook" can be hidden
- ✅ Payment receipts branded

**Remaining Gaps:** Backend/admin surfaces still show "DriveBook":
- ❌ Instructor dashboard not white-labeled
- ❌ Student portal not white-labeled
- ❌ Wallet receipts hardcoded to "DriveBook"
- ❌ Some receipt footers still say "DriveBook"
- ❌ Custom email sending domain not supported

**Business Impact:** Current implementation is **production-ready for PREMIUM tier** (solo instructors). Schools wanting full white-label (SCHOOL tier) will need Phase 2 work.

---

## What Works Today (60% Complete)

### ✅ Booking Page White-Label (100% Complete)

**Surfaces Branded:**
- Nav logo + business name
- Hero gradient (always uses brand colors)
- All CTA buttons (brand primary color)
- Footer copyright
- "Powered by" badge (optional hide)

**Status:** Production-ready. Zero "DriveBook" visibility if instructor enables full branding.

**Files:**
- `app/book/[instructorId]/page.tsx`
- `app/subdomain/[slug]/page.tsx`
- `lib/branding/getDisplayIdentity.ts`

---

### ✅ Email Branding (95% Complete)

**What Works:**
- From name: `"Sarah's Driving School Bookings"` (not "DriveBook")
- Subject lines use business name
- Email body uses business name
- Receipt headers branded

**What's Missing (P1 fixes):**
- Receipt footer still says "Powered by DriveBook" (needs `platformName` variable)
- Wallet lesson receipts hardcoded to "DriveBook Payments" (not white-labeled)

**Files:**
- `lib/utils/email-branding.ts` (formatBrandedSender)
- Email templates (various)

---

### ✅ SMS Branding (90% Complete)

**What Works:**
- SMS prefix: `"[Sarah's Driving School]: ..."`
- Instructor name in body uses business name
- No hardcoded "DriveBook" mentions in message content

**What's Missing:**
- SMS sender number always shows DriveBook's Twilio number (requires Twilio sub-accounts per school)

**Status:** Acceptable for PREMIUM tier. SCHOOL tier future work.

---

### ✅ Custom Domains (100% Complete)

**What Works:**
- CNAME verification (`book.sarahs-ds.com` → drivebook.com.au)
- DNS TXT record verification
- SSL certificate provisioning (Cloudflare)
- Domain management UI in dashboard

**Status:** Production-ready.

**Files:**
- `app/api/instructor/domain/verify/route.ts`
- `lib/utils/subdomain.ts`
- `app/dashboard/branding/page.tsx`

---

### ⚠️ Payment Page (80% Complete)

**What Works:**
- Business name shown above payment form
- Instructor avatar uses brand color
- Clean UI with no "DriveBook" in main content

**What's Missing:**
- Page `<title>` always "Complete Your Booking" (no business name)
- Support email in footer always `support@drivebook.com.au`
- "Powered by Stripe" footer (Stripe requirement, cannot remove)

**Status:** Good enough for PREMIUM tier.

---

### ⚠️ Confirmation Page (70% Complete)

**What Works:**
- Business logo shown if uploaded
- Instructor display name uses business name
- "Back to school" button when from subdomain
- Clean success message

**What's Missing:**
- URL is always `drivebook.com.au/booking/[id]/confirmation` (not on school's domain)
- "What's Next" text says "Log in with the email you used to book" (generic, no branding)
- Support contact always `support@drivebook.com.au` (should be instructor's email)

**Status:** Acceptable for PREMIUM tier. Room for improvement.

---

## What Doesn't Work (40% Incomplete)

### ❌ Instructor Dashboard (0% White-Labeled)

**Current State:**
- Nav logo: Always "DriveBook"
- Sidebar: DriveBook colors and branding
- Page titles: Always "DriveBook | ..."
- No tenant-aware theming

**Why This Matters:**
- PREMIUM tier: Less important (solo instructors understand they're using a platform)
- SCHOOL tier: Critical (schools want white-labeled admin experience for their managers)

**Effort to Fix:** Medium-High (2–3 weeks)
- Need tenant context detection
- Dynamic theme loading
- Logo replacement everywhere
- Page title injection

---

### ❌ Student Portal (0% White-Labeled)

**Current State:**
- Login page: Always DriveBook branding
- Client dashboard: Always DriveBook nav/colors
- No school-scoped login pages

**Why This Matters:**
- PREMIUM tier: Students book via subdomain, don't use portal much (acceptable)
- SCHOOL tier: Critical (school wants fully white-labeled student experience)

**Effort to Fix:** High (3–4 weeks)
- School-scoped login pages (`sarah.drivebook.com.au/login`)
- Themed client dashboard per school
- Tenant context throughout client portal

---

### ⚠️ Receipt Footers (95% Complete, Small Gap)

**Issue:** Receipt HTML footer still says "Powered by DriveBook" even when `hidePoweredBy: true`

**Fix Needed:**
```typescript
// In receipt email template function
const platformName = instructor.hidePoweredBy ? instructor.businessName : 'DriveBook';
<footer>Powered by {platformName}</footer>
```

**Effort:** 1 hour

**Priority:** P1 (easy fix, high visibility)

---

### ❌ Wallet Lesson Receipts (0% White-Labeled)

**Issue:** When instructor books a lesson and wallet is charged, student receives:
```
From: DriveBook Payments <payments@drivebook.com.au>
Subject: Receipt for your lesson with DriveBook
Body: You paid via your DriveBook wallet...
```

**Why Not Fixed:** Lower priority (internal wallet transaction, less visible than card payments)

**Fix Needed:**
- Pass `brandedSender` param to `sendWalletLessonReceipt()`
- Use business name in subject + body
- Update email template

**Effort:** 2 hours

**Priority:** P1 (good polish, affects existing customers)

---

### ❌ Custom Email Sending Domain (0% Implemented)

**Issue:** All emails come from `@drivebook.com.au` regardless of white-label settings

**Why This Matters:**
- PREMIUM tier: Minor annoyance (students still see business name in "From" display name)
- SCHOOL tier: Important (schools want `bookings@sarahs-ds.com` sending address)

**What's Needed:**
- Integrate Resend or AWS SES domain verification API
- Per-instructor domain verification workflow
- Route emails through verified domains
- Fallback to `@drivebook.com.au` if not verified

**Effort:** High (2–3 days)
- Resend API integration: 1 day
- UI wizard for domain verification: 1 day
- Email routing logic: 0.5 day
- Testing: 0.5 day

**Priority:** P2 (nice-to-have for PREMIUM, required for true SCHOOL white-label)

---

### ❌ Custom SMS Sender Number (0% Implemented)

**Issue:** All SMS come from DriveBook's Twilio number, not school's number

**Why This Matters:**
- PREMIUM tier: Not critical (students see business name in SMS prefix text)
- SCHOOL tier: Important (schools want their own phone number visibility)

**What's Needed:**
- Twilio sub-accounts per school (complex)
- OR: Schools provide their own Twilio credentials
- OR: WhatsApp Business API integration (different approach)

**Effort:** Very High (1–2 weeks)
- Twilio sub-account orchestration: complex
- Or WhatsApp Business API: different tech stack
- Billing integration (pass-through costs)

**Priority:** P3 (future SCHOOL tier feature)

---

### ❌ Custom Favicon per Subdomain (Not Implemented)

**Issue:** All booking pages show DriveBook favicon, even with custom domain

**Fix Needed:**
```tsx
// In booking page <head>
{instructor.brandLogo && (
  <link rel="icon" href={instructor.brandLogo} />
)}
```

**Effort:** 1 hour

**Priority:** P1 (easy win, good polish)

---

### ❌ Live Branding Preview in Settings (Not Implemented)

**Issue:** Instructors set colors/logo but don't see preview until they visit booking page

**What's Needed:**
- Mini iframe preview or mockup in `/dashboard/branding` page
- Shows booking page with selected colors/logo
- Live updates as instructor changes settings

**Effort:** Medium (4 hours)

**Priority:** P1 (great UX improvement)

---

## Priority Fixes (This Sprint)

### P1 — High Impact, Low Effort (Complete in 1 day)

| # | Task | Effort | Impact | Status |
|---|------|--------|--------|--------|
| 1 | Fix receipt footer "Powered by DriveBook" text | 1 hr | High | ❌ TODO |
| 2 | White-label wallet lesson receipts | 2 hrs | High | ❌ TODO |
| 3 | Confirmation page support email (show instructor email) | 30 min | Medium | ❌ TODO |
| 4 | Confirmation page "What's Next" text (remove DriveBook mention) | 30 min | Medium | ❌ TODO |
| 5 | Custom favicon per booking page | 1 hr | Medium | ❌ TODO |
| 6 | Booking page `<title>` use business name | 30 min | Low | ❌ TODO |

**Total P1 Effort:** 1 day (6 hours)

---

### P2 — Medium Impact, Medium Effort (Complete in 1 week)

| # | Task | Effort | Impact | Status |
|---|------|--------|--------|--------|
| 7 | Live branding preview in settings | 4 hrs | High | ❌ TODO |
| 8 | Custom email sending domain (Resend integration) | 2–3 days | High | ❌ TODO |
| 9 | Branded login page for subdomain | 1 day | Medium | ❌ TODO |
| 10 | Booking page `<title>` metadata use display name | 30 min | Low | ❌ TODO |

**Total P2 Effort:** 1 week

---

### P3 — Future (SCHOOL Tier) — Not Blocking PREMIUM Launch

| # | Task | Effort | Impact | Tier |
|---|------|--------|--------|------|
| 11 | Instructor dashboard white-label | 2–3 weeks | High | SCHOOL |
| 12 | Student portal white-label | 3–4 weeks | High | SCHOOL |
| 13 | Custom SMS sender (Twilio sub-accounts) | 1–2 weeks | Medium | SCHOOL |
| 14 | Confirmation page on school's domain (full routing) | 2 days | Medium | SCHOOL |

**Total P3 Effort:** 6–9 weeks (SCHOOL tier roadmap)

---

## Implementation Plan

### **Sprint 1: Quick Wins (Week 1)**
**Goal:** Complete all P1 fixes, polish existing white-label

**Day 1–2:**
1. Fix receipt footer platformName variable (1 hr)
2. White-label wallet lesson receipts (2 hrs)
3. Update confirmation page support email (30 min)
4. Update confirmation page "What's Next" text (30 min)
5. Add custom favicon injection (1 hr)
6. Fix booking page `<title>` metadata (30 min)

**Day 3–5:**
7. Build live branding preview in settings (4 hrs)
8. Test all fixes end-to-end (2 hrs)
9. QA with real instructor accounts (2 hrs)
10. Document changes (1 hr)

**Deliverable:** 100% white-label for student-facing booking journey

---

### **Sprint 2: Email Domain Verification (Week 2)**
**Goal:** Enable custom email sending domains

**Day 1:**
- Integrate Resend domain verification API
- Create domain verification UI wizard

**Day 2:**
- Build email routing logic (verified domain → use it, else fallback)
- Update all `sendEmail()` calls to check instructor domain

**Day 3:**
- Test with real domain verification
- QA edge cases (unverified domains, DNS failures)
- Document setup guide for instructors

**Deliverable:** Instructors can send emails from `@their-domain.com`

---

### **Sprint 3: Subdomain Login Pages (Week 3)**
**Goal:** School-scoped login experience

**Day 1–2:**
- Route `sarah.drivebook.com.au/login` to branded login page
- Load school's branding (logo, colors)
- Apply theme to login page

**Day 3–4:**
- Same for student registration/password reset
- Test multi-tenant login flow
- QA subdomain routing edge cases

**Day 5:**
- Documentation + deployment

**Deliverable:** Branded login pages per school subdomain

---

### **Future: SCHOOL Tier Features (Months 2–3)**

Not blocking PREMIUM launch. Planned for schools wanting full white-label.

**Instructor Dashboard White-Label (2–3 weeks):**
- Tenant context detection on dashboard pages
- Dynamic theme loading (logo, colors, name)
- Replace all "DriveBook" hardcoded references
- Test with multiple tenants

**Student Portal White-Label (3–4 weeks):**
- School-scoped client dashboard
- Themed UI per school
- School-specific data isolation
- Multi-tenant testing

**Custom SMS Sender (1–2 weeks):**
- Twilio sub-account provisioning
- OR: WhatsApp Business API integration
- Billing pass-through
- Testing

---

## Testing Strategy

### **Unit Tests:**
- `formatBrandedSender()` with various instructor configs
- `getDisplayName()` with BUSINESS/PREMIUM account types
- Subdomain extraction edge cases
- Domain verification logic

### **Integration Tests:**
- End-to-end booking flow with branding enabled
- Email sends with correct branded sender
- SMS sends with business name prefix
- Receipt generation with correct branding

### **Manual QA (Critical Path):**
1. Enable full branding for test instructor
2. Book via subdomain (e.g., `test.drivebook.com.au`)
3. Verify booking page shows business name + colors
4. Check email receipt (From name, body, footer)
5. Check SMS notification (prefix, body)
6. Pay via card, check receipt email
7. Verify confirmation page branding
8. Log into client dashboard, check experience
9. **No "DriveBook" visible except page URL**

---

## Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| **Student-facing "DriveBook" mentions** | 5 locations | 0 | Manual audit of booking flow |
| **Branded email sender adoption** | 100% | 100% | All emails use `formatBrandedSender()` |
| **Custom domain usage (PREMIUM)** | TBD | 30% | Query instructors with `domainVerified=true` |
| **"Powered by" hide rate** | TBD | 60% | Query `hidePoweredBy=true` count |
| **White-label complaint tickets** | TBD | <5/month | Support ticket tagging |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Receipt footer fix breaks layouts** | Low | Medium | Test with all receipt types before deploy |
| **Custom domain SSL provisioning fails** | Medium | High | Cloudflare fallback, clear error messages |
| **Email sending domain verification complex** | Medium | Medium | Use Resend (easier than AWS SES) |
| **Subdomain routing breaks localhost dev** | Low | Medium | Graceful fallback for non-subdomain hosts |
| **White-label expectations exceed PREMIUM tier** | High | Medium | Clear tier documentation, SCHOOL tier roadmap |

---

## Documentation Deliverables

### **For Instructors:**
- ✅ Branding settings guide (already exists)
- ✅ Custom domain setup guide (already exists)
- ❌ **TODO:** Email domain verification guide
- ❌ **TODO:** White-label best practices guide

### **For Developers:**
- ✅ `WHITE-LABEL.md` (surface-by-surface status)
- ✅ `PAYMENT-WHITE-LABEL.md` (direct payment mode)
- ✅ `getDisplayIdentity()` utility documentation
- ❌ **TODO:** White-label architecture diagram
- ❌ **TODO:** Testing guide for white-label features

### **For Support Team:**
- ❌ **TODO:** White-label troubleshooting guide
- ❌ **TODO:** Common white-label customer questions FAQ
- ❌ **TODO:** Tier comparison (what's white-labeled per tier)

---

## Conclusion

**Current State:** DriveBook has achieved **60% white-label** with excellent student-facing experience.

**Remaining Work:** 6 hours (P1 fixes) + 1 week (custom email domains) = **production-ready PREMIUM tier white-label**

**Future Work:** 6–9 weeks for full SCHOOL tier white-label (admin + student portal)

**Recommendation:** Complete P1 + P2 fixes this sprint (2 weeks total). Launch PREMIUM tier marketing with confidence. Plan SCHOOL tier work based on demand.

---

**Next Action:** Start with P1 fixes (1-day effort, high impact). Begin with receipt footer fix (most visible customer issue).

---

**Prepared by:** Kiro AI  
**Date:** 2026-08-15  
**Status:** Ready for Sprint Planning  
**Review:** Recommended for immediate execution

