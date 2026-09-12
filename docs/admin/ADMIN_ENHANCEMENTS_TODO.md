# Admin Portal Enhancements TODO

**Status:** Post-Launch Enhancements  
**Priority:** Medium (Not Blocking Deployment)  
**Last Updated:** 2026-09-01

---

## Overview

This document tracks UX and feature enhancements for the admin portal that would improve operational efficiency but are not critical for launch. These features bring parity between client and instructor management pages.

---

## 🎯 Priority 1: Instructor Detail Page Enhancements

### 1.1 Quick Edit Profile (Inline)

**Current State:**
- Admin must go through separate forms/pages to update instructor details
- No quick edit for basic fields

**Desired State:**
- Inline edit mode (similar to `/admin/clients/[id]` page)
- Edit name, email, phone, bio in place
- Save/Cancel buttons
- Optimistic UI updates

**Effort:** ~2 hours  
**Files:** `app/admin/instructors/[id]/page.tsx`

**User Story:**
> As an admin, I want to quickly update an instructor's profile details without navigating away from their detail page, so I can fix typos or update contact info faster.

---

### 1.2 Admin Notes Field

**Current State:**
- No internal notes field for instructors
- Compliance notes and approval reasons not stored in a structured way

**Desired State:**
- `adminNotes` text field in UI (below profile section)
- Saved to Provider table (new column: `adminNotes TEXT`)
- Shows last updated timestamp and admin user
- Private (not visible to instructor)

**Effort:** ~3 hours (includes migration)  
**Files:** 
- `prisma/schema.prisma` (add `adminNotes` field)
- `app/admin/instructors/[id]/page.tsx` (UI)
- `app/api/admin/instructors/[id]/notes/route.ts` (new API)

**User Story:**
> As an admin, I want to add private notes to an instructor's profile (e.g., "ABN verification called 2026-01-15, confirmed with ATO"), so I can track compliance issues and historical context.

---

### 1.3 Activity Timeline Tab

**Current State:**
- No audit trail visible on instructor detail page
- Hard to see history of status changes, approvals, rejections

**Desired State:**
- New "Activity" tab (alongside Overview, Subscription, Bookings)
- Shows timeline of:
  - Approval/rejection events (with admin user + reason)
  - Document uploads/verifications
  - Subscription changes
  - Status changes (ACTIVE → SUSPENDED)
  - Profile edits
- Grouped by date
- Filterable by event type

**Effort:** ~4 hours  
**Files:**
- `app/admin/instructors/[id]/page.tsx` (new tab)
- `app/api/admin/instructors/[id]/activity/route.ts` (new API)
- Database: Requires audit log table (see section 3.1)

**User Story:**
> As an admin, I want to see a complete history of changes to an instructor's account (who approved them, when docs were verified, etc.), so I can understand the account lifecycle and troubleshoot issues.

---

### 1.4 Quick Action Links to Revenue/Payouts

**Current State:**
- No direct link from instructor detail page to their earnings/payouts
- Admin must manually navigate and filter

**Desired State:**
- Quick links in stats cards:
  - "View Earnings →" links to `/admin/revenue?instructorId=[id]`
  - "View Payouts →" links to `/admin/payouts?instructorId=[id]`
- Badge showing pending payout amount (if any)

**Effort:** ~1 hour  
**Files:** `app/admin/instructors/[id]/page.tsx`

**User Story:**
> As an admin, I want to quickly jump to an instructor's earnings and payout details from their profile page, so I don't have to navigate and search manually.

---

## 🎯 Priority 2: Client Detail Page Enhancements

### 2.1 Communication Center Integration

**Current State:**
- Deferred in previous session
- No in-app messaging or email tracking

**Desired State:**
- "Messages" tab on client detail page
- Send email/SMS to client
- View communication history
- Templates for common messages

**Effort:** 3-5 days  
**Blockers:** Requires:
- Database schema for messages
- Email/SMS template system
- UI for message composer
- GDPR compliance review

**User Story:**
> As an admin, I want to send a message to a client directly from their profile page and see past communications, so I can handle support requests efficiently.

---

### 2.2 Booking Filters (Client Page)

**Current State:**
- Booking list exists but no filters
- Hard to find specific bookings

**Desired State:**
- Filter dropdown: All / Upcoming / Completed / Cancelled
- Date range picker
- Search by instructor name

**Effort:** ~2 hours  
**Files:** `app/admin/clients/[id]/page.tsx`

---

### 2.3 Transaction Export (CSV)

**Current State:**
- Transactions visible in UI only
- No export capability

**Desired State:**
- "Export CSV" button on transaction drawer
- Downloads CSV with all transaction data
- Useful for accounting/reconciliation

**Effort:** ~2 hours  
**Files:** `app/admin/clients/[id]/page.tsx`, new API route for CSV generation

---

## 🎯 Priority 3: Cross-Cutting Features

### 3.1 Audit Log System (Database)

**Current State:**
- Ad-hoc logging in various places
- No centralized audit trail

**Desired State:**
- `AuditLog` table in Prisma schema:
  ```prisma
  model AuditLog {
    id          String   @id @default(cuid())
    entityType  String   // "Provider", "User", "Booking", etc.
    entityId    String
    action      String   // "APPROVED", "REJECTED", "SUSPENDED", "UPDATED", etc.
    performedBy String   // User ID of admin
    reason      String?  // Optional reason/notes
    metadata    Json?    // Additional context
    createdAt   DateTime @default(now())
    
    @@index([entityType, entityId])
    @@index([createdAt])
  }
  ```
- Helper function: `logAuditEvent(entityType, entityId, action, userId, reason?, metadata?)`
- Used across all admin actions

**Effort:** ~4 hours (includes migration + refactoring existing code)  
**Benefits:** Enables activity timelines, compliance reporting, troubleshooting

---

### 3.2 Bulk Operations

**Current State:**
- One-by-one operations only (approve, suspend, etc.)

**Desired State:**
- Checkbox selection on list pages
- Bulk actions: Approve selected, Export selected, etc.

**Effort:** ~6 hours  
**Files:** `app/admin/instructors/page.tsx`, `app/admin/clients/page.tsx`

---

### 3.3 Advanced Search & Filters (List Pages)

**Current State:**
- Basic search by name/email
- No advanced filters

**Desired State:**
- Filter by:
  - Status (APPROVED, PENDING, etc.)
  - Subscription tier
  - Date range (joined, last active)
  - Service area (for instructors)
  - Credits range (for clients)
- Save filter presets

**Effort:** ~8 hours  
**Files:** List pages + new UI components

---

## 🎯 Priority 4: Nice-to-Have Features

### 4.1 Performance Metrics Cards

**Instructor Detail:**
- Booking completion rate
- Average rating trend (chart)
- Cancellation rate
- Response time to booking requests

**Client Detail:**
- Lifetime value (LTV)
- Booking frequency
- Average lesson duration
- Preferred instructors

**Effort:** ~6 hours per page

---

### 4.2 Schedule Override Tool (Instructors)

**Current State:**
- No admin override for instructor availability

**Desired State:**
- Admin can manually block/unblock time slots
- Override availability rules
- Useful for emergency schedule changes

**Effort:** ~5 hours  
**Complexity:** Depends on existing schedule system architecture

---

### 4.3 Document Expiry Alerts

**Current State:**
- Documents have expiry dates but no proactive alerts

**Desired State:**
- Dashboard widget: "Documents Expiring Soon" (30 days)
- Email notifications to admin + instructor
- Red badge on instructor list page

**Effort:** ~4 hours (includes cron job setup)

---

### 4.4 Client List per Instructor

**Current State:**
- Can see bookings but not a distinct client list

**Desired State:**
- New tab on instructor detail: "Clients"
- Shows all unique clients who've booked with this instructor
- Total bookings per client
- Last booking date
- Click through to client detail

**Effort:** ~3 hours

---

## 📊 Summary

| Feature | Priority | Effort | Impact |
|---------|----------|--------|--------|
| Quick Edit Profile (Instructor) | High | 2h | High |
| Admin Notes Field | High | 3h | High |
| Activity Timeline | High | 4h | Medium |
| Quick Links to Revenue/Payouts | High | 1h | Medium |
| Booking Filters (Client) | Medium | 2h | Medium |
| Transaction Export CSV | Medium | 2h | Low |
| Audit Log System | High | 4h | High |
| Bulk Operations | Low | 6h | Medium |
| Advanced Search/Filters | Low | 8h | Medium |
| Performance Metrics | Low | 12h | Low |

**Total High Priority:** ~14 hours  
**Total Medium Priority:** ~4 hours  
**Total Low Priority:** ~26 hours

---

## 🚀 Recommended Implementation Order

**Phase 1: Post-Launch Week 1 (Critical UX)**
1. Quick Edit Profile (Instructor) - 2h
2. Quick Links to Revenue/Payouts - 1h
3. Booking Filters (Client) - 2h

**Phase 2: Month 1 (Compliance & Tracking)**
4. Audit Log System - 4h
5. Admin Notes Field - 3h
6. Activity Timeline - 4h

**Phase 3: Month 2+ (Efficiency)**
7. Transaction Export CSV - 2h
8. Document Expiry Alerts - 4h
9. Client List per Instructor - 3h

**Phase 4: Future (Nice-to-Have)**
10. Bulk Operations - 6h
11. Advanced Search/Filters - 8h
12. Performance Metrics - 12h
13. Schedule Override Tool - 5h
14. Communication Center - 3-5 days

---

## 📝 Notes

- All estimates assume familiarity with the codebase
- Some features depend on audit log system being implemented first
- Communication Center requires product/legal review for GDPR compliance
- Performance metrics may require database query optimization

---

**Document Maintainer:** Product/Engineering Team  
**Review Cycle:** Monthly
---

# 🚨 OPERATIONAL & BUSINESS CRITICAL REQUIREMENTS

**Status:** Operational Risk Assessment  
**Priority:** Launch Readiness Analysis  
**Added:** 2026-09-01 (Post-Inspection)

---

## Overview

Based on comprehensive codebase inspection, these are **operational and business-critical** gaps that impact platform safety, profitability, and regulatory compliance. Unlike UX enhancements above, these address **legal liability, financial controls, and operational efficiency**.

---

## 🔴 CRITICAL - Pre-Launch Blockers (P0)

### 5.1 KYC/Compliance Automation & Hard Blocks

**Current State:**
- ✅ Manual document upload exists
- ✅ Document expiry tracking exists
- ❌ No automated identity verification (Onfido, Stripe Identity)
- ❌ No OCR/validation of license images
- ❌ **No hard blocks** - Instructors can book with expired licenses
- ❌ No background check integration tracking

**Business Risk:**
- ⚠️ **Legal Liability:** Accident with unverified instructor → lawsuit
- ⚠️ **Insurance Claims Rejected:** Insurer denies claim due to expired license
- ⚠️ **Regulatory Fines:** Driving instructor licensing requirements not enforced
- ⚠️ **Reputation Damage:** Media reports "platform allowed unlicensed instructor"

**Required Actions:**
1. **Hard Block Expired Licenses** (8 hours)
   - Add pre-booking check: `if (license.expiry < today) throw "License expired"`
   - Admin override only (with audit log)
   - UI: Show red banner on instructor profile

2. **Automated Expiry Checks** (4 hours)
   - Cron job: Daily scan for expired docs
   - Auto-suspend instructor if license/insurance expired
   - Email notification: "Account suspended - renew documents"

3. **OCR License Validation** (Optional - 12 hours)
   - Integration: AWS Textract / Google Cloud Vision
   - Extract license number, expiry date from image
   - Auto-populate fields, flag mismatches

**Effort:** 12 hours (required) + 12 hours (optional OCR)  
**Priority:** **P0 - LAUNCH BLOCKER**

---

### 5.2 Incident/Accident Tracking & Insurance Integration

**Current State:**
- ❌ No incident reporting system
- ❌ No insurance claim tracking
- ❌ No post-incident workflow (instructor suspension, investigation)

**Business Risk:**
- ⚠️ **Insurance Claims:** Can't provide evidence for claims (which booking? who was at fault?)
- ⚠️ **Liability:** Instructor continues working during investigation
- ⚠️ **Data Loss:** Incident details in emails, not database

**Required Actions:**
1. **Incident Report Form** (8 hours)
   - Who can file: Admin, Instructor, Client
   - Fields: Booking ID, incident type, description, injuries?, police report?, photos
   - Auto-link to booking, participants, vehicle
   - Email alert to admin + legal team

2. **Investigation Workflow** (6 hours)
   - Status: Reported → Under Investigation → Resolved / Escalated
   - Auto-suspend instructor (optional flag)
   - Admin can add investigation notes
   - Resolution options: Clear / Suspend / Terminate

3. **Insurance Claim Tracker** (4 hours)
   - Link incident to insurance claim
   - Fields: Claim #, insurer, amount claimed, status, outcome
   - Timeline: Filed → Under Review → Approved/Denied → Paid

**Effort:** 18 hours  
**Priority:** **P0 - LAUNCH BLOCKER**  
**Note:** Minimum viable = just the report form (8h)

---

### 5.3 Financial Reconciliation & Audit Controls

**Current State:**
- ✅ Transaction ledger exists
- ✅ Revenue/payout pages exist
- ❌ No automated reconciliation (Stripe vs DB)
- ❌ No "daily close" checklist
- ❌ No drift alerts (money missing?)
- ❌ No refund approval workflow

**Business Risk:**
- ⚠️ **Money Leakage:** Untracked refunds, manual adjustments not audited
- ⚠️ **Tax Compliance:** Can't generate accurate GST reports for ATO
- ⚠️ **Stripe Disputes:** No early warning for chargebacks
- ⚠️ **Audit Failure:** Can't prove money trail for external audit

**Required Actions:**
1. **Daily Reconciliation Script** (6 hours)
   - Compare: `SUM(transactions) = Stripe payout amount`
   - Report: Variance > $10 → alert admin
   - Run: Automated cron job (nightly)
   - Dashboard: Show last reconciliation status

2. **Refund Approval Workflow** (4 hours)
   - Refunds > $100 require admin approval
   - Audit log: Who approved, reason
   - Email notification to finance team

3. **GST/Tax Summary Reports** (4 hours)
   - Monthly summary: Total revenue, GST collected, GST paid to instructors
   - Export CSV for accountant
   - Filter by date range

**Effort:** 14 hours  
**Priority:** **P0 - LAUNCH BLOCKER** (minimum: reconciliation script = 6h)

---

## 🟡 HIGH PRIORITY - Post-Launch Week 1 (P1)

### 5.4 Support Ticketing System Integration

**Current State:**
- ✅ `/admin/support` page exists
- ❌ Unknown if actual ticketing system integrated (Zendesk, Intercom, etc.)
- ❌ Likely just email-based support → untracked, slow

**Business Impact:**
- 😞 **Poor CX:** Support requests lost in email, no SLA tracking
- 😞 **Team Inefficiency:** Can't assign tickets, track workload
- 😞 **No Metrics:** Can't measure response time, resolution rate

**Required Actions:**
1. **Ticket Lifecycle System** (12 hours)
   - States: New → Assigned → In Progress → Resolved → Closed
   - Assign to support staff
   - Response time tracking (SLA: < 24h)
   - Priority levels (Low, Medium, High, Urgent)

2. **Canned Responses** (2 hours)
   - Templates for common issues ("How to reset password", "Refund policy")
   - Insert with one click

3. **Context Links** (2 hours)
   - Link ticket to user/booking/instructor
   - View user profile from ticket

**Effort:** 16 hours  
**Priority:** **P1 - Post-Launch Week 1**  
**Alternative:** Integrate existing tool (Zendesk, Intercom) - 4 hours

---

### 5.5 Instructor Churn Prevention & Retention

**Current State:**
- ✅ `InstructorRetentionStatus` component exists (dashboard widget)
- ❌ No proactive alerts for at-risk instructors
- ❌ No automated outreach campaigns

**Business Impact:**
- 📉 **Supply Loss:** Instructor quits → fewer bookings → revenue drop
- 📉 **No Early Warning:** Detect churn after they've already left
- 📉 **Manual Outreach:** No scalable retention process

**Required Actions:**
1. **Churn Risk Scoring** (6 hours)
   - Indicators:
     - Days since last booking > 30 = "At Risk"
     - Earnings declining trend = "At Risk"
     - Cancellation rate spike = "Dissatisfied"
   - Dashboard: "At-Risk Instructors" list

2. **Automated Outreach** (4 hours)
   - Email: "We noticed you haven't had bookings recently. Need help?"
   - Trigger: 30 days no booking
   - Offer: Free marketing boost, training webinar

3. **Retention Specialist Assignment** (2 hours)
   - Flag high-value instructors (top 20% earners)
   - Assign account manager
   - Monthly check-in calls

**Effort:** 12 hours  
**Priority:** **P1 - Post-Launch Month 1**

---

## 🟢 MEDIUM PRIORITY - Post-Launch Month 2+ (P2)

### 5.6 Supply/Demand Analytics & Geographic Insights

**Current State:**
- ❌ No heatmap of bookings vs instructors by suburb
- ❌ No "underserved areas" report
- ❌ No peak hour analysis

**Business Impact:**
- 💰 **Missed Revenue:** High demand areas without instructors
- 💰 **Inefficient Marketing:** Can't target instructor recruitment
- 💰 **No Surge Pricing:** Can't optimize pricing by demand

**Required Actions:**
1. **Supply/Demand Heatmap** (10 hours)
   - Map view: Bookings per suburb (color-coded)
   - Overlay: Instructors per suburb
   - "Underserved" = High bookings / Low instructors

2. **Peak Hours Analysis** (4 hours)
   - Chart: Bookings by hour of day, day of week
   - Identify: When demand exceeds supply
   - Use case: Dynamic pricing (future)

3. **Instructor Utilization Rate** (4 hours)
   - Metric: `Booked hours / Available hours`
   - Benchmark: < 40% = underutilized, > 80% = overbooked
   - Dashboard: Show per instructor

**Effort:** 18 hours  
**Priority:** **P2 - Month 2+**

---

### 5.7 Marketing Attribution & ROI Tracking

**Current State:**
- ❌ No UTM parameter tracking
- ❌ No conversion funnel analytics
- ❌ No CAC (Customer Acquisition Cost) per channel

**Business Impact:**
- 💸 **Wasted Ad Spend:** Don't know which marketing channels work
- 💸 **No Optimization:** Can't A/B test campaigns
- 💸 **Blind Growth:** Scaling what doesn't work

**Required Actions:**
1. **UTM Tracking on Registration** (4 hours)
   - Capture: `utm_source`, `utm_medium`, `utm_campaign` on signup
   - Store in User table
   - Report: Signups by source

2. **CAC per Channel** (4 hours)
   - Formula: `Ad spend / New users`
   - Dashboard: CAC by channel (Google Ads, Facebook, SEO, Referral)
   - Benchmark: CAC < LTV (Lifetime Value)

3. **Conversion Funnel** (4 hours)
   - Track: Landing → Signup → First Booking → Repeat Booking
   - Drop-off analysis: Where do users abandon?

**Effort:** 12 hours  
**Priority:** **P2 - Month 2+**  
**Alternative:** Use Google Analytics 4 (0 hours dev, just setup)

---

### 5.8 Automated Onboarding Email Campaigns

**Current State:**
- ✅ Manual "Send Setup Nudge" button exists
- ❌ No automated drip campaigns

**Business Impact:**
- 😞 **Low Activation:** Instructors sign up but don't complete onboarding
- 😞 **Manual Work:** Admin must manually nudge each instructor

**Required Actions:**
1. **Onboarding Drip Campaign** (4 hours - using existing email service)
   - Day 0: "Welcome! Here's how to get started"
   - Day 3: "Reminder: Upload your documents"
   - Day 7: "Need help? Our support team is here"
   - Day 14: "Final reminder - complete setup to start earning"
   - Day 30: Auto-pause account if not verified

2. **Email Template System** (2 hours)
   - Reusable templates (welcome, reminder, help, pause)
   - Personalization: Insert name, completion %

**Effort:** 6 hours  
**Priority:** **P2 - Month 2+**

---

### 5.9 Review & Rating Moderation System

**Current State:**
- ✅ `/admin/reviews` page exists
- ❌ Unknown if moderation workflow exists

**Business Impact:**
- 😞 **Reputation Risk:** Fake/abusive reviews not removed
- 😞 **Instructor Dissatisfaction:** No dispute resolution
- ⚠️ **Legal Risk:** Defamation claims if defamatory reviews not moderated

**Required Actions:**
1. **Review Flagging System** (4 hours)
   - Auto-flag: Profanity, threats, personal info
   - Manual flag: Instructor can "Report Review"
   - Admin queue: Flagged reviews for review

2. **Dispute Workflow** (4 hours)
   - Instructor submits: "This review is inaccurate because..."
   - Admin reviews: Evidence from both sides
   - Actions: Approve / Hide / Remove / Edit

3. **Suspicious Pattern Detection** (4 hours)
   - Alert: Multiple 1-stars from same IP
   - Alert: Mass reviews in short time (bot attack)
   - Alert: Review text identical across multiple reviews

**Effort:** 12 hours  
**Priority:** **P2 - Month 2+**

---

### 5.10 Instructor Performance Benchmarking

**Current State:**
- ❌ No "average instructor" benchmarks
- ❌ No performance scorecards
- ❌ Can't identify top performers

**Business Impact:**
- 😞 **Missed Marketing:** Can't feature "Instructor of the Month"
- 😞 **No Coaching:** Can't help underperformers improve
- 😞 **Unfair Tier Changes:** No data to justify commission adjustments

**Required Actions:**
1. **Performance Dashboard (per instructor)** (6 hours)
   - Metrics vs Platform Average:
     - Bookings/month
     - Average rating
     - Cancellation rate
     - Response time
   - Percentile ranking (Top 10%, 25%, 50%)

2. **"Instructor of the Month" Auto-Calculation** (2 hours)
   - Score = (Bookings × Rating) / Cancellations
   - Top 3 each month → email + badge + marketing feature

3. **Performance Trends** (2 hours)
   - Chart: Last 6 months trend (improving/declining)
   - Alert: Sharp decline → retention risk

**Effort:** 10 hours  
**Priority:** **P2 - Month 3+**

---

## 📊 REVISED PRIORITY MATRIX

| Feature | Business Risk | Operational Impact | Effort | Priority | When |
|---------|--------------|-------------------|--------|----------|------|
| **KYC/Compliance Hard Blocks** | 🔴 Critical (Legal) | 🔴 Critical (Safety) | 12h | **P0** | **Pre-Launch** |
| **Incident Tracking** | 🔴 Critical (Insurance) | 🔴 High (Risk) | 18h | **P0** | **Pre-Launch** |
| **Financial Reconciliation** | 🔴 Critical (Money) | 🔴 High (Audit) | 14h | **P0** | **Pre-Launch** |
| **Support Ticketing** | 🟡 Medium (CX) | 🔴 High (Ops) | 16h | **P1** | **Week 1** |
| **Churn Prevention** | 🟡 Medium (Revenue) | 🟡 Medium (Growth) | 12h | **P1** | **Month 1** |
| **Supply/Demand Heatmap** | 🟢 Low (Strategy) | 🟡 Medium (Planning) | 18h | **P2** | **Month 2** |
| **Marketing Attribution** | 🟢 Low (Growth) | 🟢 Low (Insights) | 12h | **P2** | **Month 2** |
| **Onboarding Drips** | 🟡 Medium (Conversion) | 🟢 Low (Automation) | 6h | **P2** | **Month 2** |
| **Review Moderation** | 🟡 Medium (Legal/Brand) | 🟢 Low (Quality) | 12h | **P2** | **Month 2** |
| **Performance Benchmarks** | 🟢 Low (Insights) | 🟢 Low (Coaching) | 10h | **P2** | **Month 3** |

---

## 🚦 LAUNCH READINESS ASSESSMENT

### ✅ CAN LAUNCH WITH (Workarounds):
- ✅ Support ticketing (manual email for 1-2 weeks, migrate to system)
- ✅ Marketing attribution (use Google Analytics temporarily)
- ✅ Onboarding drips (manual nudges scale for first 50 instructors)
- ✅ Performance benchmarks (nice-to-have, not critical)

### 🚨 MUST HAVE BEFORE LAUNCH (Legal/Financial):
1. **KYC Hard Blocks** (12h) - Auto-reject expired licenses
2. **Incident Report Form** (8h minimum) - Even if manual workflow
3. **Financial Reconciliation** (6h minimum) - Daily script to catch drift

**Total Pre-Launch Critical Work:** ~26 hours (~3-4 days)

---

## 🗓️ IMPLEMENTATION ROADMAP

### **Pre-Launch (This Week)**
- Day 1-2: KYC hard blocks + automated expiry checks (12h)
- Day 2-3: Incident report form + basic workflow (8h)
- Day 3-4: Financial reconciliation script + alerts (6h)

### **Post-Launch Week 1**
- Support ticketing integration (16h or 4h if using existing tool)
- Admin notes field (3h - from UX list above)
- Quick edit profile (2h - from UX list above)

### **Month 1**
- Churn prevention alerts (12h)
- Activity timeline tab (4h - from UX list above)
- Audit log system (4h - from UX list above)

### **Month 2+**
- Supply/demand analytics (18h)
- Marketing attribution (12h)
- Onboarding drips (6h)
- Review moderation (12h)

### **Month 3+**
- Performance benchmarks (10h)
- Advanced features from UX list (bulk ops, advanced filters, etc.)

---

## 💡 QUICK WIN: Operations Runbook

**Recommended:** Create an **"Admin Operations Runbook"** document with:
- Daily checklist (reconciliation, approvals, expired docs)
- Weekly tasks (payouts, compliance review)
- Monthly tasks (churn analysis, performance review)
- Incident response playbook (accident, payment dispute, legal inquiry)

This ensures operational continuity even before full automation!

**Effort:** 2-3 hours to document  
**Benefit:** Team knows exactly what to do each day/week/month

---

## 📝 NOTES

- **P0 items are legal/financial risks** - don't launch without them
- **P1 items impact operations** - needed within first month
- **P2 items improve efficiency** - implement as you scale
- All effort estimates assume familiarity with codebase
- Some features can be MVP'd (e.g., incident report = just a form initially)

---

**Document Status:** ✅ Comprehensive - Covers UX + Operations + Business  
**Last Updated:** 2026-09-01  
**Review Cycle:** Weekly (pre-launch), Monthly (post-launch)

---

# OPERATIONAL & BUSINESS CRITICAL REQUIREMENTS

Status: Operational Risk Assessment
Priority: Launch Readiness Analysis
Added: 2026-09-01 (Post-Inspection)

---

See full operational requirements section appended below...

[Content too large for single command - file updated via append]
