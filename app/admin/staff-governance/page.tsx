'use client';
import { AdminPageLayout } from '@/components/ui'

import React, { useState, useEffect } from 'react';
import AdminNav from '@/components/admin/AdminNav';
import Link from 'next/link';
import {
  AlertTriangle,
  DollarSign,
  Clock,
  TrendingUp,
  Users,
  Shield,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface GovernanceStats {
  totalTasks: number;
  tasksRequiringApproval: number;
  slaBreaches: number;
  escalations: number;
  totalRefunds: number;
  refundsThisWeek: number;
  refundPercentageOfRevenue: number;
  avgResolutionTime: number;
  tasksReopened: number;
  staffWorkloadImbalance: boolean;
}

export default function StaffGovernancePage() {
  const [stats, setStats] = useState<GovernanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetchGovernanceStats();
  }, []);

  const fetchGovernanceStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/staff-governance/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch governance stats:', error);
      setFetchError('Failed to load governance data. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminPageLayout title="Staff Governance" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'E' }]}>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {fetchError && (
          <div className="mb-6 bg-red-900/20 border border-red-700/50 rounded-xl px-4 py-3 text-sm text-red-400">
            {fetchError}
          </div>
        )}
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            Staff Governance Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor operational controls, financial authority, and audit compliance
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading governance data...</p>
          </div>
        ) : stats ? (
          <>
            {/* Critical Alerts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Tasks Requiring Approval */}
              <div className={`bg-card rounded-lg border border-border p-6 border-l-4 ${
                stats.tasksRequiringApproval > 0 ? 'border-orange-500' : 'border-green-500'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-semibold">Awaiting Approval</p>
                    <p className="text-3xl font-bold text-foreground mt-2">
                      {stats.tasksRequiringApproval}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Tasks requiring supervisor/owner approval
                    </p>
                  </div>
                  {stats.tasksRequiringApproval > 0 ? (
                    <AlertTriangle className="w-12 h-12 text-orange-500 opacity-50" />
                  ) : (
                    <CheckCircle className="w-12 h-12 text-green-500 opacity-50" />
                  )}
                </div>
              </div>

              {/* SLA Breaches */}
              <div className={`bg-card rounded-lg border border-border p-6 border-l-4 ${
                stats.slaBreaches > 0 ? 'border-red-500' : 'border-green-500'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-semibold">SLA Breaches</p>
                    <p className="text-3xl font-bold text-foreground mt-2">
                      {stats.slaBreaches}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Tasks that missed response/resolution SLA
                    </p>
                  </div>
                  {stats.slaBreaches > 0 ? (
                    <XCircle className="w-12 h-12 text-red-500 opacity-50" />
                  ) : (
                    <CheckCircle className="w-12 h-12 text-green-500 opacity-50" />
                  )}
                </div>
              </div>

              {/* Escalations */}
              <div className="bg-card rounded-lg border border-border p-6 border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-semibold">Escalations</p>
                    <p className="text-3xl font-bold text-foreground mt-2">
                      {stats.escalations}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Tasks escalated to supervisor/owner
                    </p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-purple-500 opacity-50" />
                </div>
              </div>
            </div>

            {/* Financial Monitoring */}
            <div className="bg-card rounded-lg border border-border mb-8">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <DollarSign className="w-6 h-6 text-emerald-400" />
                  Financial Monitoring
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Refunds (All Time)</p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      ${stats.totalRefunds.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Refunds This Week</p>
                    <p className="text-2xl font-bold text-orange-600 mt-1">
                      ${stats.refundsThisWeek.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">% of Revenue Refunded</p>
                    <p className={`text-2xl font-bold mt-1 ${
                      stats.refundPercentageOfRevenue > 10 ? 'text-destructive' : 'text-emerald-400'
                    }`}>
                      {stats.refundPercentageOfRevenue.toFixed(1)}%
                    </p>
                    {stats.refundPercentageOfRevenue > 10 && (
                      <p className="text-xs text-destructive mt-1">⚠️ Above 10% threshold</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="bg-card rounded-lg border border-border mb-8">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Clock className="w-6 h-6 text-primary" />
                  Performance Metrics
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Resolution Time</p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {stats.avgResolutionTime.toFixed(1)}h
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tasks Reopened</p>
                    <p className={`text-2xl font-bold mt-1 ${
                      stats.tasksReopened > 5 ? 'text-destructive' : 'text-emerald-400'
                    }`}>
                      {stats.tasksReopened}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Workload Balance</p>
                    <p className={`text-2xl font-bold mt-1 ${
                      stats.staffWorkloadImbalance ? 'text-orange-600' : 'text-emerald-400'
                    }`}>
                      {stats.staffWorkloadImbalance ? 'Imbalanced' : 'Balanced'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Governance Controls Status */}
            <div className="bg-card rounded-lg border border-border">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Shield className="w-6 h-6 text-purple-600" />
                  Governance Controls Status
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="font-semibold text-foreground">Financial Control Separation</p>
                        <p className="text-sm text-muted-foreground">Approval thresholds enforced</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-green-900/40 text-emerald-400 rounded-full text-sm font-semibold">
                      Active
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="font-semibold text-foreground">Task Closure Control</p>
                        <p className="text-sm text-muted-foreground">Resolution & audit requirements enforced</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-green-900/40 text-emerald-400 rounded-full text-sm font-semibold">
                      Active
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="font-semibold text-foreground">Automated Refund Calculation</p>
                        <p className="text-sm text-muted-foreground">System-calculated, not manual</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-green-900/40 text-emerald-400 rounded-full text-sm font-semibold">
                      Active
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="font-semibold text-foreground">Permission Matrix</p>
                        <p className="text-sm text-muted-foreground">Role-based access control enforced</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-green-900/40 text-emerald-400 rounded-full text-sm font-semibold">
                      Active
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="font-semibold text-foreground">SLA Enforcement</p>
                        <p className="text-sm text-muted-foreground">Automatic escalation enabled</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-green-900/40 text-emerald-400 rounded-full text-sm font-semibold">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex gap-4">
              <Link
                href="/admin/audit-log"
                className="px-6 py-3 bg-primary text-foreground rounded-lg hover:bg-primary/90 transition"
              >
                View Audit Log
              </Link>
              <Link
                href="/admin/payouts"
                className="px-6 py-3 bg-secondary text-foreground rounded-lg hover:bg-secondary transition"
              >
                Process Payouts
              </Link>
              <button
                onClick={fetchGovernanceStats}
                className="px-6 py-3 bg-emerald-600 text-foreground rounded-lg hover:bg-green-700 transition"
              >
                Refresh Data
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Failed to load governance data</p>
          </div>
        )}
      </div>
    </AdminPageLayout>
    </div>
  )
}
