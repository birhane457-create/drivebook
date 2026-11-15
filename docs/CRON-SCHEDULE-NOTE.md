# Cron Job Schedules — Hobby Plan Constraint

## Current state (Vercel Hobby)

Vercel Hobby limits cron jobs to a maximum of **once per day**. The schedules in `vercel.json`
reflect this constraint, not the intended operational cadence of each job.

## Intended schedules (Vercel Pro)

When the project moves from Hobby to Pro, update `vercel.json` cron expressions:

| Route | Current (Hobby) | Intended (Pro) |
|-------|----------------|----------------|
| `/api/cron/slot-cleanup` | `0 4 * * *` (daily) | `*/10 * * * *` (every 10 min) |
| `/api/cron/notifications` | `0 8 * * *` (daily) | `*/15 * * * *` (every 15 min) |
| `/api/cron/notification-retry` | `0 6 * * *` (daily) | `*/5 * * * *` (every 5 min) |
| All other cron routes | daily | daily (unchanged) |

## Important

- Do **not** change job business logic to accommodate the Hobby schedule.
- Each job is safe against duplicate invocations (idempotent) and missed executions.
- The Hobby schedules mean slot reservations may persist up to 24 hours past expiry
  and notification retries may be delayed up to 24 hours — acceptable for pre-launch.
