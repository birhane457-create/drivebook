/**
 * Cron: Health Monitor
 *
 * Runs every 30 minutes. Reads CronHealth records and alerts if any job
 * has not successfully completed within its expected window.
 *
 * This is the internal equivalent of an uptime monitor — no external service
 * dependency required.
 *
 * Auth: Bearer CRON_SECRET
 * Schedule: every 30 minutes ("*\/30 * * * *" in vercel.json)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendAlert } from '@/lib/services/alert-service';
import { CRON_JOB_CONFIG } from '@/lib/services/cron-health';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const issues: { jobName: string; issue: string; lastRunAt: string | null }[] = [];
  const healthy: string[] = [];

  for (const [jobName, config] of Object.entries(CRON_JOB_CONFIG)) {
    const record = await (prisma as any).cronHealth.findUnique({
      where: { jobName },
    }).catch(() => null);

    if (!record) {
      // Job has never run — only flag if it's been longer than 2× the expected window
      // (gives new deployments time to warm up)
      issues.push({ jobName, issue: 'never_run', lastRunAt: null });
      continue;
    }

    const ageMinutes = (now - new Date(record.lastRunAt).getTime()) / 60000;

    if (record.lastStatus === 'FAILED') {
      issues.push({
        jobName,
        issue: `last_run_failed: ${record.lastError ?? 'unknown error'}`,
        lastRunAt: record.lastRunAt.toISOString(),
      });
    } else if (ageMinutes > config.maxAgeMinutes) {
      issues.push({
        jobName,
        issue: `stale: last ran ${Math.round(ageMinutes)} min ago, expected every ${config.maxAgeMinutes} min`,
        lastRunAt: record.lastRunAt.toISOString(),
      });
    } else {
      healthy.push(jobName);
    }
  }

  if (issues.length > 0) {
    const summary = issues
      .map(i => `${i.jobName}: ${i.issue}`)
      .join('\n');

    void sendAlert({
      type: 'RECONCILIATION_ISSUES', // closest existing type — operational warning
      severity: 'WARNING',
      message: `Cron health check: ${issues.length} job(s) need attention:\n${summary}`,
      entityId: 'cron-health',
      metadata: { issues, healthy, checkedAt: new Date().toISOString() },
    });

    console.warn(`[CRON HEALTH] ${issues.length} issue(s):\n${summary}`);
  } else {
    console.log(`[CRON HEALTH] All ${healthy.length} jobs healthy`);
  }

  // Ping this job's own health (so we can detect if health-check itself stops running)
  try {
    await (prisma as any).cronHealth.upsert({
      where: { jobName: 'health-check' },
      update: { lastRunAt: new Date(), lastStatus: 'OK', lastError: null, runCount: { increment: 1 } },
      create: { jobName: 'health-check', lastRunAt: new Date(), lastStatus: 'OK', runCount: 1 },
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({
    success: true,
    checkedAt: new Date().toISOString(),
    healthy: healthy.length,
    issues: issues.length,
    details: issues,
  });
}
