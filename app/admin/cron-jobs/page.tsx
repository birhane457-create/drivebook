'use client';
import { AdminPageLayout } from '@/components/ui'

/**
 * /admin/cron-jobs
 *
 * Cron job health dashboard.
 * Shows last run time, status, run count, and error for every registered job.
 * Auto-refreshes every 60 seconds. Manual refresh button always available.
 */

import { useEffect, useState, useCallback } from 'react';
import AdminNav from '@/components/admin/AdminNav';

type JobStatus = 'OK' | 'FAILED' | 'STALE' | 'NEVER_RUN';

interface CronJob {
  jobName: string;
  description: string;
  maxAgeMinutes: number;
  status: JobStatus;
  lastRunAt: string | null;
  lastError: string | null;
  runCount: number;
  ageMinutes: number | null;
  isStale: boolean;
}

interface Summary {
  total: number;
  ok: number;
  failed: number;
  stale: number;
  neverRun: number;
}

interface ApiResponse {
  jobs: CronJob[];
  summary: Summary;
  checkedAt: string;
}

function statusBadge(status: JobStatus) {
  switch (status) {
    case 'OK':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-900/50 text-emerald-300 border border-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          OK
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-900/50 text-destructive border border-red-700">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          FAILED
        </span>
      );
    case 'STALE':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-900/50 text-amber-300 border border-amber-700">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          STALE
        </span>
      );
    case 'NEVER_RUN':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary/70 text-muted-foreground border border-border">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          NEVER RUN
        </span>
      );
  }
}

function formatAge(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  // Display in browser's local timezone — admin may be anywhere in Australia
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function CronJobsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cron-jobs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastRefreshed(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load cron status');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + auto-refresh every 60s
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const summary = data?.summary;
  const hasIssues = summary && (summary.failed > 0 || summary.stale > 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminPageLayout title="Cron Jobs" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'S' }]}>
        <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cron Jobs</h1>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Automated background jobs — last refresh{' '}
              {lastRefreshed ? lastRefreshed.toLocaleTimeString('en-AU') : '…'}
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/70 border border-border rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground/60 mb-1">Total Jobs</p>
              <p className="text-2xl font-bold text-foreground">{summary.total}</p>
            </div>
            <div className={`bg-card border rounded-xl p-4 ${summary.ok === summary.total ? 'border-emerald-800' : 'border-border'}`}>
              <p className="text-xs text-muted-foreground/60 mb-1">Healthy</p>
              <p className={`text-2xl font-bold ${summary.ok === summary.total ? 'text-emerald-400' : 'text-foreground'}`}>{summary.ok}</p>
            </div>
            <div className={`bg-card border rounded-xl p-4 ${summary.failed > 0 ? 'border-red-800' : 'border-border'}`}>
              <p className="text-xs text-muted-foreground/60 mb-1">Failed</p>
              <p className={`text-2xl font-bold ${summary.failed > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{summary.failed}</p>
            </div>
            <div className={`bg-card border rounded-xl p-4 ${summary.stale > 0 ? 'border-amber-800' : 'border-border'}`}>
              <p className="text-xs text-muted-foreground/60 mb-1">Stale</p>
              <p className={`text-2xl font-bold ${summary.stale > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>{summary.stale}</p>
            </div>
          </div>
        )}

        {/* Alert banner */}
        {hasIssues && (
          <div className="flex items-start gap-3 bg-red-950/40 border border-red-800 rounded-xl px-4 py-3 mb-6">
            <span className="text-lg mt-0.5">🚨</span>
            <div>
              <p className="text-sm font-semibold text-destructive">Action required</p>
              <p className="text-sm text-destructive mt-0.5">
                {summary!.failed > 0 && `${summary!.failed} job${summary!.failed > 1 ? 's' : ''} failed. `}
                {summary!.stale > 0 && `${summary!.stale} job${summary!.stale > 1 ? 's' : ''} stale. `}
                Check the error details below and review Vercel function logs.
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-950/40 border border-red-800 rounded-xl px-4 py-3 mb-6 text-sm text-destructive">
            Failed to load: {error}
          </div>
        )}

        {/* Jobs table */}
        {loading && !data ? (
          <div className="text-center py-16 text-muted-foreground/60">Loading…</div>
        ) : (
          <div className="space-y-3">
            {data?.jobs.map((job) => (
              <div
                key={job.jobName}
                className={`bg-card border rounded-xl p-4 transition-colors ${
                  job.status === 'FAILED'
                    ? 'border-red-800'
                    : job.status === 'STALE'
                      ? 'border-amber-800'
                      : 'border-border'
                }`}
              >
                <div className="flex flex-wrap items-start gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {statusBadge(job.status)}
                      <span className="font-mono text-sm font-semibold text-foreground">{job.jobName}</span>
                    </div>
                    <p className="text-xs text-muted-foreground/60">{job.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-foreground">{formatAge(job.ageMinutes)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(job.lastRunAt)}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground/60">
                  <span>Runs: <span className="text-foreground font-medium">{job.runCount}</span></span>
                  <span>
                    Expected every:{' '}
                    <span className="text-foreground font-medium">
                      {job.maxAgeMinutes < 60
                        ? `${job.maxAgeMinutes}m`
                        : job.maxAgeMinutes < 1440
                          ? `${Math.round(job.maxAgeMinutes / 60)}h`
                          : `${Math.round(job.maxAgeMinutes / 1440)}d`}
                    </span>
                  </span>
                </div>

                {job.lastError && (
                  <div className="mt-3 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-destructive mb-1">Last error</p>
                    <p className="text-xs text-destructive font-mono break-all">{job.lastError}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">
          Auto-refreshes every 60 seconds · Times shown in AWST
        </p>
      </div>
      </AdminPageLayout>
    </div>
  ) 
}
