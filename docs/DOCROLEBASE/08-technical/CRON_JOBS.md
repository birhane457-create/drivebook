# Cron Jobs & Scheduled Tasks

**Purpose:** Automated background jobs for cleanup, payouts, notifications, and health monitoring.

**Status:** ✅ AS IS (10 jobs implemented) | ⏳ AS IT SHOULD BE (Recommendations)

---

## AS IS: Current Implementation

### Overview

**Architecture:** HTTP-triggered cron endpoints (not traditional background workers)

**Trigger Method:** External cron service calls HTTP endpoint with `Authorization: Bearer CRON_SECRET` header

**Location:** `app/api/cron/*/route.ts` (10 endpoints)

**Health Tracking:** `CronHealth` model — each job pings table on completion

### Cron Jobs (10 total)

#### 1. **Weekly Payouts** 
- **Endpoint:** `GET /api/cron/weekly-payouts`
- **Schedule:** Every Tuesday at 2:00 AM AWST (6:00 PM Monday UTC)
- **Cron Expression:** `0 18 * * 1`
- **Purpose:** Process automatic instructor payouts for completed bookings
- **Eligibility Filters:**
  - Stripe Connect account fully onboarded (chargesEnabled + payoutsEnabled)
  - No open chargeback freeze (payoutHold = false)
  - Last booking ended > 48 hours ago (dispute buffer)
  - ABN verified OR withholding tax applied
- **Action:** Build + execute payout for each instructor, notify if pending
- **Failure Handling:** Records status in `CronHealth` table, sends alert

#### 2. **Slot Reservation Cleanup**
- **Endpoint:** `GET /api/cron/slot-cleanup`
- **Schedule:** Every 5-10 minutes (external service configurable)
- **Trigger:** Manual or external cron service
- **Purpose:** Delete expired slot reservations to prevent table bloat
- **Expiry:** 10 minutes after creation (`SlotReservation.expiresAt`)
- **Query:** Deletes all where `expiresAt < NOW()`
- **Health Ping:** Updates `CronHealth` on success/failure

#### 3. **Apply Rate Changes**
- **Endpoint:** `GET /api/cron/apply-rate-changes`
- **Schedule:** Daily at 00:05 UTC (10:05 AWST)
- **Cron Expression:** `5 0 * * *`
- **Purpose:** Apply scheduled commission rate changes to `PlatformSettings`
- **Trigger:** Finds all `PlatformRateChange` where `effectiveDate <= NOW()` and `status = PENDING`
- **Action:** 
  - Update `PlatformSettings` with new rate
  - Mark change as APPLIED
  - Send email + in-app notification to all affected instructors
  - Audit log entry
- **Scope:** Changes filtered by tier (BASIC/PRO/BUSINESS)

#### 4. **Health Check Monitor**
- **Endpoint:** `GET /api/cron/health-check`
- **Schedule:** Every 30 minutes
- **Cron Expression:** `*/30 * * * *`
- **Purpose:** Monitor all cron jobs and alert if any are stale/failing
- **Monitors:**
  - If job never run → flag (allow 2× grace period for new deploys)
  - If last run failed → flag with error
  - If last run > `maxAgeMinutes` ago → flag as stale
- **Action:** Send alert if any jobs unhealthy
- **Self-Monitoring:** Also pings its own `CronHealth` (meta: health-check job monitoring itself)

#### 5. **Document Expiry Check**
- **Endpoint:** `GET /api/cron/document-expiry-check`
- **Schedule:** Daily at 08:00 AWST
- **Purpose:** Alert instructors whose documents (license, insurance, etc.) are expiring soon
- **Check:** Documents expiring in next 30 days
- **Action:** 
  - Create DOCUMENT_EXPIRY tasks (auto-assigned to staff)
  - Send in-app + email notifications to instructors
  - Audit log

#### 6. **Lesson Reminders**
- **Endpoint:** `GET /api/cron/lesson-reminders`
- **Schedule:** Daily at 14:00 AWST (send reminders for lessons next day)
- **Purpose:** Send SMS + email reminders to clients/instructors
- **Filter:** Bookings 24 hours away with status CONFIRMED
- **Action:** Send reminders, update `smsCheckOutSent` flag

#### 7. **Recheck ABN Verification**
- **Endpoint:** `GET /api/cron/recheck-abn`
- **Schedule:** Weekly (day/time TBD)
- **Purpose:** Re-verify instructor ABNs in case status changed in ATO registry
- **Action:** Query ATO API for each unverified ABN, update `abnStatus` / `abnVerified`

#### 8. **Reconcile Stripe**
- **Endpoint:** `GET /api/cron/reconcile-stripe`
- **Schedule:** Weekly (day/time TBD)
- **Purpose:** Reconcile Stripe records with platform ledger
- **Action:** 
  - Find charges created but not in `Transaction` table
  - Find transfers created but not linked to payout
  - Create reconciliation report
  - Alert if discrepancies found

#### 9. **Notifications / Cleanup**
- **Endpoint:** `GET /api/cron/notifications` (GET for check, POST to send)
- **Schedule:** As-needed (manual trigger)
- **Purpose:** Send queued notifications, clean up old notifications
- **Action:** Batch send via email/SMS service, delete read > 90 days old

#### 10. **Slot Cleanup (Alternative)**
- **Endpoint:** `GET /api/cron/cleanup-expired-bookings` ⚠️ May be duplicate
- **Purpose:** May be redundant with slot-cleanup job
- **Status:** Verify if both needed or consolidate

---

## Cron Job Configuration

### Authorization

**Header Required:** `Authorization: Bearer CRON_SECRET`

**CRON_SECRET:** 
- Set in `.env` as random string (40+ chars recommended)
- Example: `CRON_SECRET=your_super_secret_token_here`
- ⚠️ Do NOT commit to repo — use environment variables only

### External Cron Services (Options)

**Option 1: Vercel Crons** (Recommended for Vercel-hosted apps)
- Defined in `vercel.json` (check project root)
- Built-in, no external service required
- Free tier included

**Option 2: EasyCron**
- Free HTTP cron service (easycron.com)
- POST to your endpoint with cron expression
- Provides uptime monitoring

**Option 3: Node-Cron (Self-Hosted)**
- Run a background worker (e.g., separate Node.js process)
- Use `node-cron` package for scheduling
- More control, requires infrastructure

**Option 4: AWS EventBridge / Lambda**
- Enterprise-grade scheduling
- Integrates with CloudWatch monitoring

### CronHealth Model

**Purpose:** Track when each cron job last ran and alert if stale

**Fields:**
```typescript
model CronHealth {
  jobName: string      // e.g. "weekly-payouts", "health-check"
  lastRunAt: DateTime  // when the job last completed
  lastStatus: string   // "OK" | "FAILED"
  lastError?: string   // error message if FAILED
  runCount: number     // total runs since deploy
}
```

**Helper Functions:** (in `lib/services/cron-health.ts`)

```typescript
// Called at end of successful cron job
await pingCronHealth('weekly-payouts');

// Called if cron job fails
await failCronHealth('weekly-payouts', error);
```

---

## AS IT SHOULD BE: Recommendations & Improvements

### 1. Consolidated Cron Dashboard (High Priority)

**Issue:** Cron health scattered across logs. No visibility into job status.

**Recommendation:**
- Create admin page `/admin/cron-jobs` showing:
  - Each job, last run time, status, run count
  - Next scheduled run (if using Vercel crons)
  - Ability to manually trigger test run
  - Alert history

**UI Fields:**
```
| Job Name | Last Run | Status | Next Run | Run Count | Manual Trigger |
|----------|----------|--------|----------|-----------|----------------|
| weekly-payouts | 2m ago | ✅ OK | Tue 2am | 45 | [Run Now] |
| health-check | 5m ago | ✅ OK | 30m | 892 | [Run Now] |
| slot-cleanup | FAILED | ❌ | 10m | 15 | [Run Now] |
```

### 2. Configurable Schedules (High Priority)

**Issue:** Cron schedules hardcoded in job comments. Changing requires code deploy.

**Recommendation:**
- Add `CronJobSchedule` table with:
  - Job name
  - Cron expression (UNIX cron format)
  - Enabled/disabled toggle
  - Timezone
- Admin page to edit schedules without code change
- Restart cron service on schedule change

### 3. Job Retry Logic (High Priority)

**Issue:** If cron job fails, no automatic retry. Admin must manually trigger.

**Recommendation:**
- Add retry configuration to each job:
  ```json
  {
    "jobName": "weekly-payouts",
    "maxRetries": 3,
    "retryDelayMs": 300000,  // 5 minutes
    "retryBackoffMultiplier": 2
  }
  ```
- Implement exponential backoff: 5 min → 10 min → 20 min
- Store retry attempts in `CronHealth.metadata`

### 4. Job Dependencies (Medium Priority)

**Issue:** Some jobs should not run until others complete (e.g., reconcile-stripe after weekly-payouts).

**Recommendation:**
- Add `CronJobSchedule.dependsOn` field
- Health-check validates dependencies before alerting
- Example:
  ```
  reconcile-stripe depends on weekly-payouts
  health-check runs after all other jobs
  ```

### 5. Partial Failure Handling (Medium Priority)

**Issue:** If payout fails for 1 instructor out of 100, whole job marked FAILED.

**Recommendation:**
- Track success/failure per entity (not whole job)
- Store detailed result:
  ```json
  {
    "jobName": "weekly-payouts",
    "totalInstructors": 100,
    "successCount": 98,
    "failureCount": 2,
    "failedInstructors": [
      { "id": "inst_123", "reason": "stripe account not onboarded" }
    ]
  }
  ```
- Alert only if failure rate > threshold (e.g., > 5%)

### 6. Job Timeout Handling (Medium Priority)

**Issue:** Long-running jobs may timeout (serverless platforms have limits).

**Recommendation:**
- Add `maxDurationMs` to each job config
- If job takes > duration, force timeout and rollback
- Example: weekly-payouts has 60-second limit (process in batches)

**Implementation:**
```typescript
const timeout = setTimeout(() => {
  throw new Error('Job timeout exceeded (60 seconds)');
}, 60000);

try {
  // Do work
} finally {
  clearTimeout(timeout);
}
```

### 7. Job Batching for Large Datasets (Medium Priority)

**Issue:** Weekly payouts tries to process all instructors at once — may timeout on large dataset.

**Recommendation:**
- Process in batches of 10-20 instructors per cron run
- Track progress with `lastProcessedInstructorId`
- Next run continues where previous left off
- Repeat until all instructors processed

**Tracking:**
```typescript
model CronHealth {
  ...
  lastProcessedId?: string  // for resumable jobs
  batchSize: number         // instructors per run
}
```

### 8. Notification Delivery Guarantee (High Priority)

**Issue:** Email/SMS notifications sent from cron may fail silently.

**Recommendation:**
- Use reliable delivery queue (e.g., Bull, AWS SQS)
- Cron enqueues notifications, separate worker processes queue
- If worker fails, retry with exponential backoff
- Log all delivery attempts in audit trail

### 9. Cron Event Webhooks (Low Priority)

**Issue:** External systems (analytics, monitoring) can't react to cron events.

**Recommendation:**
- Add webhook trigger on cron start/end
- POST to admin-configured URLs with job details
- Example: Slack notification when health-check fails

### 10. Vercel Crons Adoption (High Priority)

**Issue:** Unclear if using Vercel crons or external service.

**Recommendation:**
- Check/update `vercel.json` with all jobs
- Vercel crons free and built-in — no external service needed
- Example `vercel.json`:
  ```json
  {
    "crons": [
      {
        "path": "/api/cron/weekly-payouts",
        "schedule": "0 18 * * 1"
      },
      {
        "path": "/api/cron/health-check",
        "schedule": "*/30 * * * *"
      }
    ]
  }
  ```

---

## Testing Cron Jobs

### Manual Test (Development)

```bash
# Test endpoint with valid CRON_SECRET
curl -X GET http://localhost:3000/api/cron/slot-cleanup \
  -H "Authorization: Bearer test_secret_123"

# Response:
# {
#   "success": true,
#   "message": "Slot cleanup completed",
#   "deletedCount": 5,
#   "timestamp": "2026-06-14T12:30:45.000Z"
# }
```

### Health Check

```bash
# Check health status of all jobs
curl -X GET http://localhost:3000/api/cron/health-check \
  -H "Authorization: Bearer test_secret_123"

# Response:
# {
#   "success": true,
#   "checkedAt": "2026-06-14T12:30:45.000Z",
#   "healthy": 8,
#   "issues": 2,
#   "details": [
#     {
#       "jobName": "reconcile-stripe",
#       "issue": "stale: last ran 125 min ago, expected every 60 min",
#       "lastRunAt": "2026-06-14T10:25:00.000Z"
#     }
#   ]
# }
```

### Database Check

```sql
-- View last run time for each job
SELECT jobName, lastRunAt, lastStatus, runCount FROM "CronHealth" 
ORDER BY lastRunAt DESC;

-- Expected output (all within their expected windows):
-- | jobName           | lastRunAt            | lastStatus | runCount |
-- |-------------------|----------------------|------------|----------|
-- | health-check      | 2026-06-14 12:30:00 | OK         | 892      |
-- | slot-cleanup      | 2026-06-14 12:28:00 | OK         | 2145     |
-- | weekly-payouts    | 2026-06-08 02:00:00 | OK         | 12       |
-- | apply-rate-changes| 2026-06-14 00:05:00 | OK         | 8        |
```

---

## Monitoring & Alerts

### Alert Conditions

1. **Job Never Run:** New deploy, cron not yet triggered
   - Grace period: 2× expected window
   - Action: Investigate deployment

2. **Job Failed:** Last run had error
   - Action: Check error message, fix, trigger manual run

3. **Job Stale:** Last run older than expected window
   - Action: Check external cron service (may be down), or infrastructure issue

4. **Health Check Itself Failed:** Can't detect if health-check running
   - Action: CRITICAL — investigate immediately

### Alert Channels (Recommended)

- **Slack:** `/admin/notifications` posts to Slack #ops
- **PagerDuty:** For CRITICAL alerts (health-check failed, payouts failed)
- **Email:** For MEDIUM alerts (stale jobs)
- **Dashboard:** Always visible on `/admin/cron-jobs`

---

## References

- **Code Location:** `app/api/cron/`
- **Health Tracking:** `lib/services/cron-health.ts`
- **Database Model:** `prisma/schema.prisma` → `CronHealth`
- **Vercel Crons Docs:** https://vercel.com/docs/cron-jobs
- **UNIX Cron Format:** https://crontab.guru/

---

## Implementation Checklist

- [ ] Verify all 10 cron jobs documented above exist in codebase
- [ ] Create `/admin/cron-jobs` dashboard for visibility
- [ ] Consolidate `vercel.json` with all job schedules
- [ ] Implement retry logic for failed jobs
- [ ] Add job timeout handling (60 second limit)
- [ ] Test weekly-payouts doesn't timeout on large dataset
- [ ] Set up Slack alerts for failed jobs
- [ ] Document CRON_SECRET rotation policy
- [ ] Add batch processing for reconcile-stripe
- [ ] Test health-check detection of stale jobs
- [ ] Add manual trigger button to each job

