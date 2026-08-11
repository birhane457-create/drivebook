/**
 * GET /api/admin/cron-jobs
 *
 * Returns live status for all registered cron jobs.
 * Used by the /admin/cron-jobs dashboard page.
 *
 * Auth: ADMIN or SUPER_ADMIN session required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CRON_JOB_CONFIG } from '@/lib/services/cron-health';

import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();

  // Load all CronHealth records in one query
  const records = await prisma.cronHealth.findMany();
  const recordMap = new Map(records.map((r) => [r.jobName, r]));

  const jobs = Object.entries(CRON_JOB_CONFIG).map(([jobName, config]) => {
    const record = recordMap.get(jobName) as any;

    if (!record) {
      return {
        jobName,
        description: config.description,
        maxAgeMinutes: config.maxAgeMinutes,
        status: 'NEVER_RUN' as const,
        lastRunAt: null,
        lastError: null,
        runCount: 0,
        ageMinutes: null,
        isStale: false,
      };
    }

    const ageMinutes = Math.round((now - new Date(record.lastRunAt).getTime()) / 60000);
    const isStale = record.lastStatus === 'OK' && ageMinutes > config.maxAgeMinutes;

    return {
      jobName,
      description: config.description,
      maxAgeMinutes: config.maxAgeMinutes,
      status: record.lastStatus === 'FAILED'
        ? 'FAILED'
        : isStale
          ? 'STALE'
          : 'OK',
      lastRunAt: record.lastRunAt,
      lastError: record.lastError ?? null,
      runCount: record.runCount ?? 0,
      ageMinutes,
      isStale,
    };
  });

  const summary = {
    total: jobs.length,
    ok: jobs.filter(j => j.status === 'OK').length,
    failed: jobs.filter(j => j.status === 'FAILED').length,
    stale: jobs.filter(j => j.status === 'STALE').length,
    neverRun: jobs.filter(j => j.status === 'NEVER_RUN').length,
  };

  return NextResponse.json({ jobs, summary, checkedAt: new Date().toISOString() });
}
