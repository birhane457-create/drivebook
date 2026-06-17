# Cron Health Monitoring & Alerting

**Purpose:** Track cron job execution health and alert when jobs fail or become stale.

**Status:** ✅ AS IS (Partially Implemented) | ⏳ AS IT SHOULD BE (Recommendations)

---

## AS IS: Current Implementation

### Database Model

**Location:** `prisma/schema.prisma`

```prisma
model CronHealth {
  id          String    @id @default(cuid())
  jobName     String    @unique            // e.g. "cleanup-expired-bookings"
  lastRunAt   DateTime                     // when the job last completed successfully
  lastStatus  String    @default("OK")    // OK | FAILED
  lastError   String?                     // error message if FAILED
  runCount    Int       @default(0)
  updatedAt   DateTime  @updatedAt

  @@index([jobName])
}
```

### How It Works

**Every cron job at completion:**
1. Calls `pingCronHealth(jobName)` on success
2. Calls `failCronHealth(jobName, error)` on failure

**Health Check Cron:**
1. Runs every 30 minutes
2. Reads `CronHealth` table
3. Alerts if any job:
   - Never run (new job, hasn't been triggered yet)
   - Failed (last run had error)
   - Stale (last run older than expected window)
4. Sends alert if issues found

### Health Check Endpoint

**Endpoint:** `GET /api/cron/health-check`

**Schedule:** Every 30 minutes

**Auth:** Requires `Authorization: Bearer CRON_SECRET`

**Response (Success):**
```json
{
  "success": true,
  "checkedAt": "2026-06-14T12:30:00.000Z",
  "healthy": 8,
  "issues": 2,
  "details": [
    {
      "jobName": "reconcile-stripe",
      "issue": "stale: last ran 125 min ago, expected every 60 min",
      "lastRunAt": "2026-06-14T10:25:00.000Z"
    },
    {
      "jobName": "slot-cleanup",
      "issue": "last_run_failed: Timeout exceeded",
      "lastRunAt": "2026-06-14T12:20:00.000Z"
    }
  ]
}
```

### Alert Conditions

| Condition | Severity | Action |
|-----------|----------|--------|
| Job never run | WARNING | Investigate deployment (maybe cron not triggered yet) |
| Last run failed | ERROR | Fix error, manually trigger retry |
| Last run stale | WARNING | Check external cron service (may be down) |
| Health-check itself failed | CRITICAL | INVESTIGATE IMMEDIATELY |

### Current Limitations

**Issue #1: Job Configuration Hardcoded**
- Expected intervals not defined in system
- Health check uses hardcoded intervals per job
- Can't change without code change

**Issue #2: Alert Distribution Unclear**
- Health check calls `sendAlert()` but implementation incomplete
- Not clear where alerts go (Slack? Email? Dashboard?)

**Issue #3: No Dashboard Visibility**
- Only way to check health is via API endpoint
- Admins have no visibility into job status
- Must manually curl endpoint to check

**Issue #4: No Failure Recovery**
- Failed job not automatically retried
- Admin must manually trigger retry
- No exponential backoff

**Issue #5: Aggregate Health Score**
- No way to tell "overall platform health"
- No SLA tracking (e.g., "99.9% jobs completed on time")

---

## AS IT SHOULD BE: Recommendations & Improvements

### 1. Cron Health Dashboard (High Priority)

**Issue:** No visibility into cron job status. Admins can't see health at a glance.

**Recommendation:** Create `/admin/cron-health` dashboard

**Display:**

```
┌─ CRON HEALTH DASHBOARD ──────────────────────────┐
│                                                    │
│ OVERALL STATUS: ✅ HEALTHY (8/10 jobs)           │
│ Last checked: 2 minutes ago                       │
│                                                    │
│ RECENT ALERTS (2)                                 │
│ ┌────────────────────────────────────────────┐    │
│ │ ⚠️  reconcile-stripe stale                  │    │
│ │    Last run: 125 min ago (expected: 60)    │    │
│ │    [Manual Trigger] [Acknowledge]          │    │
│ │ ❌ slot-cleanup failed                      │    │
│ │    Error: Timeout exceeded                 │    │
│ │    [Retry] [View Logs]                     │    │
│ └────────────────────────────────────────────┘    │
│                                                    │
│ ALL CRON JOBS                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ Job | Status | Last Run | Next Run | Count │   │
│ │────────────────────────────────────────────│   │
│ │ weekly-payouts | ✅ OK | 2m ago | Tue 2am | 45 │   │
│ │ health-check | ✅ OK | 5m ago | 30m | 892 │   │
│ │ slot-cleanup | ❌ FAILED | 10m ago | 10m | 15  │   │
│ │ apply-rate-changes | ✅ OK | 1h ago | 00:05 | 8 │   │
│ │ ... (more jobs) ...                        │   │
│ └─────────────────────────────────────────────┘   │
│                                                    │
│ MANUAL ACTIONS                                    │
│ [Run All Jobs Now] [View Logs] [Settings]       │
└────────────────────────────────────────────────────┘
```

**Features:**
1. **Overall Health:** Green/Yellow/Red status (based on failure count)
2. **Recent Alerts:** Show last 5 issues
3. **Job List:** Status, last run, next run, total runs
4. **Manual Trigger:** Button to run any job immediately (for testing/recovery)
5. **Acknowledge:** Mark alerts as acknowledged (hide from list but track)
6. **Settings:** Configure max age per job, alert thresholds

### 2. Job Configuration Tracking (High Priority)

**Issue:** Expected run intervals hardcoded in health-check. If job schedule changes, health check doesn't know.

**Recommendation:** Create `CronJobConfig` table

```prisma
model CronJobConfig {
  id              String   @id @default(cuid())
  jobName         String   @unique
  description     String
  endpoint        String   // /api/cron/weekly-payouts
  schedule        String   // cron expression: "0 18 * * 1"
  expectedMaxAgeMinutes Int    // alert if not run in this many minutes
  enabled         Boolean @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**Data Example:**
```sql
INSERT INTO "CronJobConfig" (jobName, endpoint, schedule, expectedMaxAgeMinutes, enabled)
VALUES 
  ('weekly-payouts', '/api/cron/weekly-payouts', '0 18 * * 1', 1440, true),
  ('health-check', '/api/cron/health-check', '*/30 * * * *', 45, true),
  ('slot-cleanup', '/api/cron/slot-cleanup', '*/10 * * * *', 15, true);
```

**Benefits:**
- Update expected max age without code change
- Enable/disable jobs from admin panel
- Easily see what all jobs are configured

### 3. Alert Channel Configuration (High Priority)

**Issue:** Alert destination unclear. Assuming `sendAlert()` but not integrated.

**Recommendation:** Create configurable alert channels

```prisma
model AlertChannel {
  id          String   @id @default(cuid())
  type        String   // SLACK | EMAIL | PAGERDUTY | WEBHOOK
  destination String   // slack channel URL, email, API key, etc.
  severity    String   // WARNING | ERROR | CRITICAL (which severities to alert on)
  enabled     Boolean @default(true)
  createdAt   DateTime @default(now())
}
```

**Admin UI to Configure:**
```
┌─ ALERT CHANNELS ──────────────────────────────┐
│                                                │
│ [+ ADD CHANNEL]                               │
│                                                │
│ Slack: #ops-alerts (ERROR, CRITICAL)         │
│ [Edit] [Test] [Delete]                       │
│                                                │
│ Email: ops@drivebook.com (CRITICAL only)     │
│ [Edit] [Test] [Delete]                       │
│                                                │
│ PagerDuty: (CRITICAL only)                   │
│ [Edit] [Test] [Delete]                       │
│                                                │
└────────────────────────────────────────────────┘
```

**Test Channel:** Button to send test alert (verify integration works)

### 4. Automatic Job Retry (High Priority)

**Issue:** Failed job sits in FAILED state until admin manually retries.

**Recommendation:** Implement exponential backoff retry

**Retry Strategy:**
1. Job fails → record error in `CronHealth.lastError`
2. Wait 5 minutes, retry
3. If fails again → wait 10 minutes, retry
4. If fails again → wait 20 minutes, retry
5. After 3 failures, stop retrying and send CRITICAL alert

**Implementation:**
```prisma
model CronHealth {
  ...
  failureCount    Int @default(0)
  lastFailedAt    DateTime?
  nextRetryAt     DateTime?  // when to retry if failed
}
```

**Retry Logic (in health-check):**
```typescript
for (const job of allJobs) {
  if (job.lastStatus === 'FAILED' && job.nextRetryAt <= now) {
    // Trigger manual retry of this job
    await fetch(`/api/cron/${jobName}`, {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
    });
  }
}
```

### 5. SLA Tracking & Reporting (Medium Priority)

**Issue:** No metrics on job reliability. Can't answer "how often does weekly-payouts complete successfully?"

**Recommendation:** Track execution metrics in `CronHealth`

```prisma
model CronHealth {
  ...
  // Execution metrics (rolling 30-day window)
  totalRuns30d     Int @default(0)
  successfulRuns30d Int @default(0)
  failedRuns30d    Int @default(0)
  avgDurationMs    Int?
  maxDurationMs    Int?
  successRate      Float?  // computed: successfulRuns30d / totalRuns30d
}
```

**Reports:**
- Job completion rate (last 7 days, 30 days, 90 days)
- Trending reliability (is it getting better or worse?)
- SLA compliance: "weekly-payouts hit 99.9% SLA"

### 6. Execution Time Tracking (Medium Priority)

**Issue:** Don't know if jobs are slow. Can't detect performance degradation.

**Recommendation:** Track job duration

```typescript
// At start of job
const startTime = Date.now();

// ... do work ...

// At end of job
const durationMs = Date.now() - startTime;

await pingCronHealth('weekly-payouts', { durationMs });
```

**Use Cases:**
- Alert if job takes > 60 seconds (timeout risk on serverless)
- Track trend: is slot-cleanup getting slower over time?
- Identify bottlenecks: which job consumes most resources?

### 7. Job Dependencies & Ordering (Medium Priority)

**Issue:** Some jobs should run in sequence (e.g., reconcile-stripe after weekly-payouts).

**Recommendation:** Define job dependencies

```prisma
model CronJobConfig {
  ...
  dependsOn       String?  // jobName to run before this one
}
```

**Workflow:**
```
weekly-payouts → reconcile-stripe → health-check
(processes payouts) (verifies they match) (checks all OK)
```

**Health Check Validation:**
- If dependency hasn't run successfully, don't run this job
- Alert: "reconcile-stripe skipped because weekly-payouts failed"

### 8. Manual Job Triggering (Medium Priority)

**Current:** No way for admin to manually run a job (except calling API directly).

**Recommendation:** Add buttons on health dashboard

**UI:**
```
[Job Name] | Status | Last Run | [Run Now] [View Logs]
```

**When Clicked:**
1. Call endpoint with valid CRON_SECRET
2. Show real-time output / logs
3. Display result: success or error
4. Option to retry if failed

### 9. Structured Logging (Medium Priority)

**Issue:** Job logs mixed with application logs. Hard to debug.

**Recommendation:** Structured job logs in separate table

```prisma
model CronJobLog {
  id          String   @id @default(cuid())
  jobName     String
  status      String   // SUCCESS | FAILED | TIMEOUT
  durationMs  Int
  itemsProcessed Int?  // for jobs with countable work (e.g., 50 payouts)
  error       String?
  logs        String?  // JSON-encoded log lines
  createdAt   DateTime @default(now())
}
```

**Log Output Example:**
```json
{
  "jobName": "weekly-payouts",
  "status": "SUCCESS",
  "durationMs": 45230,
  "itemsProcessed": 47,
  "logs": [
    "{ level: 'info', msg: 'Starting payout run', timestamp: '2026-06-14T02:00:00Z' }",
    "{ level: 'info', msg: 'Found 50 eligible instructors', timestamp: '2026-06-14T02:00:02Z' }",
    "{ level: 'warn', msg: 'Instructor inst_123 missing stripe account', timestamp: '2026-06-14T02:00:05Z' }",
    "{ level: 'info', msg: 'Processed 47 payouts successfully', timestamp: '2026-06-14T02:00:45Z' }"
  ]
}
```

**Benefits:**
- View logs without accessing server logs
- Search by job name, date range
- Debug job failures quickly

### 10. Proactive Failure Detection (Low Priority)

**Issue:** Only react to failures after they happen.

**Recommendation:** Detect anomalies

**Examples:**
- Job always processes 50 items. Today processed 5. Alert: "Unusual low throughput"
- Job always finishes in 30 seconds. Today took 120 seconds. Alert: "Performance degradation"
- Weekly-payouts usually runs for 45 instructors. Today 0. Alert: "Possible query bug"

**Implementation:**
- Track baseline metrics (rolling average over 30 days)
- Alert if current run deviates > 2σ (2 standard deviations)
- Machine learning optional (overkill for MVP)

---

## Implementation Checklist

### Phase 1: Visibility (Week 1)
- [ ] Create `/admin/cron-health` dashboard
- [ ] Display all jobs with status, last run, next run
- [ ] Show recent alerts/issues
- [ ] Implement manual job trigger

### Phase 2: Configuration (Week 2)
- [ ] Create `CronJobConfig` table
- [ ] Add admin UI for job config
- [ ] Load expected intervals from config instead of hardcoding
- [ ] Create alert channel configuration page

### Phase 3: Reliability (Week 3)
- [ ] Implement automatic retry logic with exponential backoff
- [ ] Create `CronJobLog` table for structured logging
- [ ] Add execution time tracking
- [ ] Display job logs on dashboard

### Phase 4: Metrics (Week 4)
- [ ] Track 30-day success rate
- [ ] Calculate SLA compliance
- [ ] Create reporting dashboard
- [ ] Add trending analysis (reliability over time)

---

## Testing

### Test 1: Job Failure & Retry

**Setup:**
- Configure slot-cleanup to retry 3 times

**Test:**
1. Simulate job failure (kill process or return error)
2. Verify `CronHealth.lastStatus = FAILED`
3. Wait 5 minutes
4. Health-check should auto-retry
5. If still fails, wait 10 minutes and retry again
6. After 3 failures, send alert

**Verification:**
```sql
SELECT jobName, lastStatus, failureCount, nextRetryAt FROM "CronHealth" WHERE jobName = 'slot-cleanup';
-- Should show: FAILED, failureCount = 1, nextRetryAt = now + 5 min
```

### Test 2: Stale Job Detection

**Setup:**
- weekly-payouts should run every Tuesday (every 7 days)
- Set to not run for 8 days

**Test:**
1. Verify health-check alerts "weekly-payouts stale: 8 days since last run"
2. Verify alert sent to configured channels
3. Verify dashboard shows warning

### Test 3: Manual Trigger

**Setup:**
- Click "Run Now" on weekly-payouts from dashboard

**Test:**
1. Job executes immediately
2. Dashboard shows "Running..." status
3. After completion, shows result and logs
4. `CronHealth` updated with new run time

---

## References

- **Schema Model:** `prisma/schema.prisma` → `CronHealth`
- **Health Check Endpoint:** `app/api/cron/health-check/route.ts`
- **Helper Functions:** `lib/services/cron-health.ts`
- **Alert Service:** `lib/services/alert-service.ts`

