# Future SCHOOL Tier — Multi-Instructor Management

**Status:** PLANNED — Not yet implemented  
**Target Release:** TBD (when demand justifies development)  
**Estimated Effort:** 4-6 weeks  
**Date:** August 18, 2026

---

## 📋 Overview

**SCHOOL tier** is a planned future subscription tier for driving schools with multiple instructors.

**Current State:**
- ❌ Not implemented
- ❌ No Organisation model in database
- ❌ No school dashboard
- ❌ No team management features

**Why It's Separate from PREMIUM:**
- PREMIUM = Solo instructor with premium features (implemented ✅)
- SCHOOL = Multi-instructor driving school (planned ❌)

---

## 🎯 Proposed Tier Structure

### **SCHOOL Tier**
**Price:** $299/month or $2990/year  
**Commission:** 12% per booking  
**Max Instructors:** 10  
**Target:** Small driving schools (2-10 instructors)

**Features:**
- Everything in PREMIUM
- Organisation-level account
- Multi-instructor management
- School dashboard (separate from solo dashboard)
- Team calendar
- Aggregate school reporting
- School-level branding inheritance
- Instructor permissions system

### **ENTERPRISE Tier**
**Price:** $799/month or $7990/year  
**Commission:** 10% per booking  
**Max Instructors:** Unlimited  
**Target:** Large driving schools (10+ instructors)

**Features:**
- Everything in SCHOOL
- Unlimited instructors
- Lower commission (10%)
- Advanced analytics
- API access for integrations
- Dedicated account manager
- Priority onboarding

---

## 🏗️ Required Implementation

### **Phase 1: Database Schema** (2 days)

Add Organisation model:

```prisma
model Organisation {
  id String @id @default(cuid())
  name String
  slug String @unique
  customDomain String?
  
  // Subscription
  subscriptionTier String @default("SCHOOL") // SCHOOL | ENTERPRISE
  subscriptionStatus String @default("TRIAL")
  trialEndsAt DateTime?
  maxInstructors Int @default(10)
  
  // Branding
  brandLogo String?
  brandColorPrimary String?
  brandColorSecondary String?
  
  // Stripe
  stripeCustomerId String?
  stripeAccountId String?
  
  // Relations
  owner Instructor @relation("OrganisationOwner", fields: [ownerId], references: [id])
  ownerId String
  instructors Instructor[] @relation("OrganisationInstructors")
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Instructor {
  // Add organisation relationship
  organisationId String?
  organisation Organisation? @relation("OrganisationInstructors", fields: [organisationId], references: [id])
  ownedOrganisation Organisation? @relation("OrganisationOwner")
  
  // Add role for team instructors
  organisationRole String? // OWNER | ADMIN | INSTRUCTOR
}
```

### **Phase 2: School Dashboard** (5-7 days)

New route: `/school-dashboard`

**Pages:**
- `/school-dashboard` — Overview (team stats, today's bookings across all instructors)
- `/school-dashboard/team` — Instructor management
- `/school-dashboard/team/invite` — Invite new instructor
- `/school-dashboard/team/[id]` — Manage instructor details
- `/school-dashboard/calendar` — Team calendar (all instructors)
- `/school-dashboard/bookings` — All school bookings
- `/school-dashboard/clients` — Shared client pool
- `/school-dashboard/revenue` — School revenue analytics
- `/school-dashboard/settings` — School settings

### **Phase 3: Team Management** (7-10 days)

**Features:**
- Invite instructor by email
- Set instructor permissions (can book, can edit clients, etc.)
- Assign instructor to bookings
- Remove instructor from school
- Transfer clients between instructors
- View instructor performance metrics

### **Phase 4: Money Flow** (5-7 days)

**Recommended: Platform-controlled payments**
- Student → DriveBook → School (weekly payout)
- Commission deducted before payout
- Same Stripe Connect flow as solo instructors
- Guaranteed collection, simpler accounting

**API Routes:**
- `/api/organisations` — CRUD for organisations
- `/api/organisations/[id]/instructors` — Team management
- `/api/organisations/[id]/revenue` — School earnings
- `/api/organisations/[id]/subscription` — School subscription management

### **Phase 5: AI Phone Routing** (3-4 days)

**Dynamic identity injection:**
- School's dedicated number → School's AI assistant
- Assistant answers with school name (not instructor name)
- Can route to specific instructor or take booking for any available instructor

**Implementation:**
- Add Twilio webhook handler: `/api/voice/incoming/route.ts`
- Look up phone number → find organisation
- Inject school identity into VAPI assistant
- Handle routing logic

---

## 💰 Commission & Pricing Models

### **Model 1: Per-Booking Commission** (Recommended)
- SCHOOL: 12% commission + $299/month base
- ENTERPRISE: 10% commission + $799/month base
- **Pros:** Fair, scales with usage, predictable for DriveBook
- **Cons:** School pays commission on every booking

### **Model 2: Flat Rate Per Instructor**
- $50/month per instructor + $99 base
- Zero commission
- **Pros:** Predictable for schools
- **Cons:** Complex to manage, less revenue at scale

### **Model 3: Hybrid**
- Lower base ($199/mo) + lower commission (5%)
- **Pros:** Balanced risk
- **Cons:** More complex pricing

**Recommendation:** Model 1 (per-booking commission) — proven model, aligns with solo instructor flow.

---

## 🔄 Money Flow Options

### **Option A: DriveBook Controls Payment** (Recommended)
**Flow:** Student → DriveBook Stripe → School (weekly payout)

**Pros:**
- ✅ Guaranteed commission collection
- ✅ Simpler for schools (no invoicing)
- ✅ Same flow as solo instructors
- ✅ Industry standard (Uber, Airbnb, DoorDash model)

**Cons:**
- ⚠️ DriveBook holds funds briefly
- ⚠️ School doesn't see money immediately

### **Option B: School Controls Payment**
**Flow:** Student → School Stripe → School invoiced monthly by DriveBook

**Pros:**
- ✅ School controls cash flow
- ✅ Money goes directly to school

**Cons:**
- ❌ Risk of non-payment
- ❌ Complex invoicing and collections
- ❌ Requires different Stripe setup

**Recommendation:** Option A — simpler, proven, guarantees revenue.

---

## 📋 Implementation Checklist

### **Database:**
- [ ] Add Organisation model to schema
- [ ] Add organisationId to Instructor
- [ ] Add organisationRole to Instructor
- [ ] Create migration script
- [ ] Seed test organisation data

### **Backend:**
- [ ] Organisation CRUD APIs
- [ ] Team management APIs
- [ ] School revenue aggregation
- [ ] School subscription management
- [ ] Invitation system (email)
- [ ] Permissions system

### **Frontend:**
- [ ] School dashboard layout
- [ ] Team management UI
- [ ] Instructor invitation flow
- [ ] School calendar component
- [ ] School revenue charts
- [ ] School settings page

### **AI & Communication:**
- [ ] Twilio webhook for incoming calls
- [ ] Dynamic VAPI identity injection
- [ ] School-branded email templates
- [ ] School-branded SMS templates

### **Payments:**
- [ ] School Stripe Connect onboarding
- [ ] School payout calculation
- [ ] Commission deduction logic
- [ ] School earnings dashboard

### **Mobile App:**
- [ ] School tier UI
- [ ] Team instructor list
- [ ] School stats widget

---

## 🚀 Go-to-Market Strategy

### **Phase 1: Soft Launch (Beta)**
- Invite 3-5 schools for beta testing
- Free for first 3 months
- Collect feedback on feature gaps
- Refine based on real usage

### **Phase 2: Public Launch**
- Announce SCHOOL tier on website
- Marketing: "Built for schools, not solo instructors"
- Testimonials from beta schools
- Pricing: $299/mo, 12% commission, max 10 instructors

### **Phase 3: Scale**
- Add ENTERPRISE tier for larger schools
- Build integrations (Xero, MYOB)
- Add advanced analytics
- Consider white-label reselling

---

## 📊 Success Metrics

**MVP Success:**
- 5 schools signed up within 3 months
- 30+ instructors managed via SCHOOL tier
- 90% retention after 6 months
- Positive feedback on team management

**Scale Success:**
- 20 schools signed up within 12 months
- 100+ instructors managed
- Average 5 instructors per school
- $6,000+ MRR from SCHOOL tier alone

---

## 🔗 Related Documentation

- [Organisation Plan (detailed architecture)](./ORGANISATION_PLAN.md)
- [School Dashboard Spec](./DASHBOARD.md)
- [Team Management Spec](./INSTRUCTORS.md)
- [School Commission Models](../../SCHOOL_COMMISSION_MODELS.md)
- [School Money Flow](../../SCHOOL_MONEY_FLOW.md)

---

## ❓ FAQ

**Q: When will SCHOOL tier be available?**  
A: When there's demand. If you're interested, contact support. We'll notify you when it's ready.

**Q: Can I upgrade from PREMIUM to SCHOOL?**  
A: Yes! When SCHOOL tier launches, you'll be able to upgrade. Your existing bookings and clients will transfer.

**Q: Will PREMIUM lose features when SCHOOL launches?**  
A: No. PREMIUM stays exactly the same — it's for solo instructors. SCHOOL is a separate tier.

**Q: Can I try SCHOOL tier before paying?**  
A: Yes, 30-day free trial just like other tiers.

**Q: What's the difference between SCHOOL and ENTERPRISE?**  
A: SCHOOL = max 10 instructors, 12% commission. ENTERPRISE = unlimited instructors, 10% commission, dedicated support.

---

**Last Updated:** August 18, 2026  
**Status:** Planning document — not yet implemented  
**Next Step:** Wait for demand, then prioritize based on user requests
