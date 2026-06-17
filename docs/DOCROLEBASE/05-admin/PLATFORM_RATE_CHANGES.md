# Platform Rate Changes & Scheduled Updates

**Purpose:** Allow platform admins to schedule future commission rate changes with automatic enforcement and instructor notification.

**Status:** ✅ AS IS (Fully Implemented) | ⏳ AS IT SHOULD BE (Recommendations)

---

## AS IS: Current Implementation

### Database Model

**Location:** `prisma/schema.prisma`

```prisma
model PlatformRateChange {
  id              String    @id @default(cuid())
  tier            String    // BASIC | PRO | STUDIO | BUSINESS | ALL
  field           String    // basicCommissionRate | proCommissionRate | businessCommissionRate
  currentRate     Float
  newRate         Float
  effectiveDate   DateTime
  reason          String    // shown to instructors in the notification
  status          String    @default("PENDING") // PENDING | APPLIED | CANCELLED
  notifiedAt      DateTime?
  appliedAt       DateTime?
  createdBy       String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

### Cron Job Implementation

**Endpoint:** `GET /api/cron/apply-rate-changes`

**Schedule:** Daily at 00:05 UTC (10:05 AWST)

**Trigger Logic:**
1. Find all `PlatformRateChange` where `effectiveDate <= NOW()` and `status = PENDING`
2. For each change, update `PlatformSettings.[field]` with new rate
3. Mark change record as `APPLIED`
4. Notify all affected instructors:
   - In-app notification
   - Email notification
5. Create audit log entry

### Notification to Instructors

**In-App Notification:**
```
title: "Commission rate update — effective [DATE]"
message: "Your [TIER] commission rate has [increased/decreased] from X% to Y%. [REASON]"
link: "/dashboard/subscription"
```

**Email Notification:**
- Formatted HTML email
- Shows current rate → new rate with visual comparison
- Effective date
- Explanation/reason
- Note: existing bookings retain original rate, only new bookings use new rate
- Link to subscription dashboard

**Recipients:** All instructors on affected tier with:
- `approvalStatus = APPROVED`
- `isActive = true`
- `subscriptionTier` matching the change

### Data Flow

```
Admin creates change
    ↓
PlatformRateChange created (status: PENDING)
    ↓
Cron runs at scheduled time
    ↓
If effectiveDate <= now:
  • Update PlatformSettings
  • Mark as APPLIED
  • Send notifications
  • Create audit log
    ↓
Instructors receive email + in-app notification
```

### Example Change

**Create Request (hypothetical API):**
```json
{
  "tier": "BASIC",
  "field": "basicCommissionRate",
  "currentRate": 15,
  "newRate": 14,
  "effectiveDate": "2026-07-01T00:00:00Z",
  "reason": "Promotional adjustment for Q3 to support growth"
}
```

**Result in Database:**
```
id: rate_change_123
tier: BASIC
field: basicCommissionRate
currentRate: 15
newRate: 14
effectiveDate: 2026-07-01
reason: Promotional adjustment for Q3 to support growth
status: PENDING
createdBy: admin_user_456
createdAt: 2026-06-14 (now)
appliedAt: null
notifiedAt: null
```

**On Effective Date (July 1):**
- Cron job runs
- PlatformSettings.basicCommissionRate updated to 14
- PlatformRateChange.status → APPLIED
- All BASIC tier instructors notified

---

## AS IT SHOULD BE: Recommendations & Improvements

### 1. Admin UI for Rate Change Scheduling (High Priority)

**Issue:** No admin interface to schedule changes. Must be done via direct database access.

**Recommendation:** Create `/admin/rate-management` page

**Features:**
1. **View Scheduled Changes:**
   - Table showing all pending/applied changes
   - Columns: Tier | Field | Current Rate | New Rate | Effective Date | Status | Created By | Actions
   - Filter by tier, status, date range
   - Sort by effective date (upcoming first)

2. **Create New Change:**
   - Form with fields:
     - Tier (BASIC | PRO | STUDIO | BUSINESS | ALL)
     - Commission rate % (slider or input)
     - Effective date picker (must be future)
     - Reason for change (text field)
   - Preview: "You're changing BASIC from 15% → 14%, effective Jul 1, 2026"
   - Confirmation: "This will affect 234 active instructors"
   - Submit button

3. **Edit Pending Change:**
   - Only allow editing pending changes (before effective date)
   - Edit: effective date, reason, rate (with validation)
   - Cannot edit applied/cancelled changes

4. **Cancel Change:**
   - Only for pending changes
   - Set status to CANCELLED
   - Send notification to affected instructors: "The planned rate change has been cancelled"

5. **Audit Trail:**
   - Show all historical changes (including cancelled ones)
   - Track who created, who modified, timestamps

**UI Mockup:**
```
┌─ Rate Management ──────────────────────────────────┐
│                                                     │
│ [CREATE NEW RATE CHANGE] [EXPORT CSV]              │
│                                                     │
│ PENDING CHANGES (3)                                │
│ ┌─────────────────────────────────────────────┐    │
│ │ PRO | proCommissionRate | 12% → 11% | Jul 15│   │
│ │ Reason: Q3 promotion                        │    │
│ │ Affects: 567 instructors                    │    │
│ │ [Edit] [Cancel]                             │    │
│ └─────────────────────────────────────────────┘    │
│                                                     │
│ APPLIED CHANGES (14)                               │
│ [View History]                                     │
└─────────────────────────────────────────────────────┘
```

### 2. Bulk Rate Changes (Medium Priority)

**Issue:** Can only change one tier at a time. For platform-wide changes (e.g., 1% reduction across all tiers), must create 4 separate changes.

**Recommendation:**
- Add "Apply to multiple tiers" option
- Create multiple `PlatformRateChange` records in single transaction
- Example: reduce all tiers by 1%
  ```
  BASIC: 15% → 14%
  PRO: 12% → 11%
  STUDIO: 12% → 11%
  BUSINESS: 10% → 9%
  ```

### 3. Effective Date Scheduling (High Priority)

**Issue:** Can schedule far in future, but no calendar view of what rate will be on specific date.

**Recommendation:**
- Add "Rate calendar" showing effective rate by date
- Example:
  ```
  Jun 14 - Jun 30: BASIC = 15%
  Jul 1 - Aug 15: BASIC = 14%  (scheduled change)
  Aug 16 - ???: BASIC = 13%    (another scheduled change)
  ```

### 4. Rate Change Impact Analysis (Medium Priority)

**Issue:** Admin can't see impact of rate change on payout amounts.

**Recommendation:**
- Show projected payout impact for affected instructors
- Example:
  ```
  Average payout (BASIC tier): $487/week
  After 15% → 14% rate change: $477/week (↓ $10)
  Affected instructors: 234
  Total weekly platform savings: $2,340
  ```

### 5. Soft Launch / A/B Testing (Low Priority)

**Issue:** Can't test rate change with subset of users before full rollout.

**Recommendation:**
- Add "Percentage of users" field
- Roll out to 10% of BASIC instructors first, then ramp to 100%
- Track early impact on retention/churn before full launch

**Implementation:**
```prisma
model PlatformRateChange {
  ...
  rolloutPercentage: Float @default(100)  // 10 = 10% of users, 100 = all users
  rolloutSchedule: Json?                  // [{ date, percentage }]
}
```

### 6. Rate Change Notifications Improvement (Medium Priority)

**Issue:** Notification sent same day rate applies. Instructors want advance notice.

**Recommendation:**
- Send first notification 7 days before effective date
- Send reminder 24 hours before
- Send confirmation email on effective date

**Implementation:**
```prisma
model PlatformRateChange {
  ...
  notificationSentAt7Days: DateTime?
  notificationSentAt24Hours: DateTime?
  notificationSentAtEffectiveDate: DateTime?
}
```

### 7. Rate Change Approval Workflow (Low Priority)

**Issue:** Any admin can schedule rate changes. No approval gate.

**Recommendation:**
- Two-tier system: Create (department lead) + Approve (finance director)
- Rate changes require approval before becoming effective
- Audit trail shows who created, who approved, when

**Workflow:**
```
Department Lead creates change (status: PENDING_APPROVAL)
    ↓
Finance Director reviews, clicks [Approve]
    ↓
Status: SCHEDULED (ready for cron to apply on effective date)
    ↓
Cron applies on effective date
```

### 8. Rate Change Rollback (Medium Priority)

**Issue:** If rate change causes problems (e.g., mass cancellations), no easy rollback.

**Recommendation:**
- Admin can "rollback" a recently-applied change
- Creates reverse change with immediate effective date
- Notifications sent to affected instructors: "Rate change reversed"

**Implementation:**
```
Original: BASIC 15% → 14% (applied Jul 1)
Rollback: 14% → 15% (created Jul 2, applied immediately)
Status: ROLLED_BACK
```

### 9. Scheduled Rate Escalation (Medium Priority)

**Issue:** Multi-step rate changes (e.g., 15% → 14% → 13% over 3 months) require manual creation.

**Recommendation:**
- Create "rate escalation schedule"
- Example: "Reduce BASIC from 15% by 0.5% every month for 6 months"
- System auto-creates 6 rate changes

**Form:**
```
Starting rate: 15%
Change by: -0.5%
Frequency: Monthly
Duration: 6 months
Reason: Gradual transition to new pricing model
→ Creates 6 changes: Jul 1, Aug 1, Sep 1, Oct 1, Nov 1, Dec 1
```

### 10. Integration with Pricing Page (High Priority)

**Issue:** Public pricing page doesn't show future rate changes. Instructors discover change via email.

**Recommendation:**
- On pricing page, show "Effective [DATE]" under future rates
- Example:
  ```
  Current commission rates
  Basic: 15%
  Pro: 12%
  
  Effective July 1, 2026:
  Basic: 14%  ← New rate
  Pro: 11%    ← New rate
  ```

---

## Implementation Checklist

- [ ] Create `/admin/rate-management` page (view/create/edit/cancel)
- [ ] Add rate creation form with date picker
- [ ] Implement rate calendar visualization
- [ ] Add impact analysis (projected payout changes)
- [ ] Implement advance notifications (7d, 24h, effective date)
- [ ] Create approval workflow (2-tier: create + approve)
- [ ] Add rollback functionality
- [ ] Update pricing page to show future rates
- [ ] Create rate escalation scheduler
- [ ] Test cron applies changes correctly on effective date
- [ ] Test notifications sent to all affected instructors
- [ ] Audit trail for all rate changes

---

## Testing

### Scenario 1: Basic Rate Change

**Setup:**
- 50 BASIC tier instructors
- Create rate change: 15% → 14%, effective tomorrow

**Test:**
1. Verify change saved in `PlatformRateChange` table (status: PENDING)
2. Run cron manually (or wait for scheduled time)
3. Verify `PlatformSettings.basicCommissionRate` updated to 14%
4. Verify `PlatformRateChange.status` = APPLIED
5. Verify all 50 instructors received email notification
6. Verify in-app notification appears on dashboard
7. Verify audit log created

**Validation:**
```sql
SELECT * FROM "PlatformRateChange" WHERE id = 'rate_change_xyz';
-- Should show: status = 'APPLIED', appliedAt = [today], notifiedAt = [today]

SELECT "basicCommissionRate" FROM "PlatformSettings" WHERE key = 'default';
-- Should show: 14

SELECT COUNT(*) FROM "Notification" WHERE type = 'RATE_CHANGE';
-- Should show: >= 50
```

### Scenario 2: Cancel Before Effective Date

**Setup:**
- Rate change scheduled for 7 days from now
- Admin cancels it

**Test:**
1. Update status to CANCELLED
2. Cron does NOT apply (because status ≠ PENDING)
3. Send notification to instructors: "Rate change cancelled"

### Scenario 3: Multiple Tiers

**Setup:**
- Create rate changes for PRO (12% → 11%) and BUSINESS (10% → 9%), same effective date

**Test:**
1. Both changes applied by single cron run
2. PRO instructors notified only (not BASIC)
3. BUSINESS instructors notified only (not PRO)

---

## References

- **Schema Model:** `prisma/schema.prisma` → `PlatformRateChange`
- **Cron Job:** `app/api/cron/apply-rate-changes/route.ts`
- **Related:** PlatformSettings, Instructor commission rates
- **Environment:** Requires `CRON_SECRET` in `.env`

