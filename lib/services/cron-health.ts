/**
 * Cron Health Service
 *
 * Every cron job calls pingCronHealth() on successful completion and
 * failCronHealth() on error. The health-check cron reads these records
 * and alerts if any job hasn't run within its expected window.
 *
 * Gap 19 fix: failCronHealth() now fires sendAlert() immediately on failure
 * so admins are notified at the point of failure rather than waiting up to
 * 30 minutes for the health-check cron to detect it.
 *
 * Usage in a cron route:
 *
 *   import { pingCronHealth, failCronHealth } from '@/lib/services/cron-health'
 *
 *   try {
 *     // ... do work ...
 *     await pingCronHealth('cleanup-expired-bookings')
 *   } catch (err) {
 *     await failCronHealth('cleanup-expired-bookings', err)
 *     throw err
 *   }
 */

import { prisma } from '@/lib/prisma';
import { sendAlert } from '@/lib/services/alert-service';

export async function pingCronHealth(jobName: string): Promise<void> {
  try {
    await (prisma as any).cronHealth.upsert({
      where: { jobName },
      update: {
        lastRunAt: new Date(),
        lastStatus: 'OK',
        lastError: null,
        runCount: { increment: 1 },
      },
      create: {
        jobName,
        lastRunAt: new Date(),
        lastStatus: 'OK',
        runCount: 1,
      },
    });
  } catch (err) {
    // Non-fatal — health tracking must never break the cron itself
    console.error(`[CRON HEALTH] Failed to ping health for ${jobName}:`, err);
  }
}

export async function failCronHealth(jobName: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  try {
    await (prisma as any).cronHealth.upsert({
      where: { jobName },
      update: {
        lastRunAt: new Date(),
        lastStatus: 'FAILED',
        lastError: message,
        runCount: { increment: 1 },
      },
      create: {
        jobName,
        lastRunAt: new Date(),
        lastStatus: 'FAILED',
        lastError: message,
        runCount: 1,
      },
    });
  } catch (err) {
    console.error(`[CRON HEALTH] Failed to record failure for ${jobName}:`, err);
  }

  // Gap 19: fire an immediate alert so admin doesn't have to wait up to 30 min
  // for the health-check cron to detect this failure.
  // sendAlert is throttled (1 per hour per job) so repeated failures don't spam.
  // Never throws — alert failure must not re-raise from the cron catch block.
  void sendAlert({
    type: 'RECONCILIATION_ISSUES',
    severity: 'CRITICAL',
    message: `Cron job "${jobName}" failed: ${message}`,
    entityId: `cron:${jobName}`,
    metadata: { jobName, error: message, failedAt: new Date().toISOString() },
  });
}

/**
 * Expected run intervals per job (in minutes).
 * If a job hasn't run within maxAgeMinutes, it's considered stale.
 */
export const CRON_JOB_CONFIG: Record<string, { maxAgeMinutes: number; description: string }> = {
  'cleanup-expired-bookings':  { maxAgeMinutes: 15,    description: 'Expires PENDING_PAYMENT bookings after 10 min' },
  'lesson-reminders':          { maxAgeMinutes: 1500,  description: 'Sends 24h lesson reminders (daily at 10pm UTC)' },
  'document-expiry-check':     { maxAgeMinutes: 10080, description: 'Alerts on expiring documents (weekly)' },
  'recheck-abn':               { maxAgeMinutes: 10080, description: 'Re-verifies instructor ABNs (weekly)' },
  'reconcile-stripe':          { maxAgeMinutes: 1500,  description: 'Stripe payment reconciliation (daily at 3am AWST)' },
  'apply-rate-changes':        { maxAgeMinutes: 1500,  description: 'Applies scheduled commission rate changes (daily)' },
  'weekly-payouts':            { maxAgeMinutes: 10080, description: 'Automatic Stripe Connect payouts (Tuesday 2am AWST)' },
  'check-trial-expiry':        { maxAgeMinutes: 1500,  description: 'Marks TRIAL subscriptions as EXPIRED when trial ends (daily)' },
  'send-trial-expiry-alerts':  { maxAgeMinutes: 1500,  description: 'Sends trial expiry warnings and notifications (daily)' },
  'notification-retry':        { maxAgeMinutes: 10,    description: 'Retries failed email/SMS sends with exponential backoff (every 5 min)' },
};
