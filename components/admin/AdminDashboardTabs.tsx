'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, Activity, Brain, Shield,
  AlertTriangle, DollarSign, Users, Calendar,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { BarChart, DonutChart, AreaChart, CHART_COLORS } from '@/components/ui/chart';
import { StatCard } from '@/components/ui';
import AdminHealthScore from './AdminHealthScore';
import AdminDailySummary from './AdminDailySummary';
import AdminInstructorRisk from './AdminInstructorRisk';
import AdminBriefHistory from './AdminBriefHistory';
import AdminWeeklyReport from './AdminWeeklyReport';
import AdminOperationsTimeline from './AdminOperationsTimeline';
import { toNumber } from '@/lib/utils/decimal-helpers';
import AdminAIChat from './AdminAIChat';
import BookingPaymentStatus from './BookingPaymentStatus';
import InstructorRetentionStatus from './InstructorRetentionStatus';
import AttentionItemList from './AttentionItemList';
import { constructDashboardSignals } from '@/lib/admin/dashboard-signals';
import { cn } from '@/lib/cn';
import { getStatusConfig } from '@/lib/config/booking-status';

interface DashboardProps {
  totalInstructors:         number;
  approvedInstructors:      number;
  pendingInstructors:       number;
  suspendedInstructors:     number;
  totalBookings:            number;
  bookingsThisMonth:        number;
  totalClients:             number;
  platformRevenueThisMonth: number;
  subMap:                   Record<string, number>;
  endedConfirmed:           number;
  expiringDocs:             number;
  unverifiedABNs:           number;
  openDisputes:             number;
  recentBookings:           any[];
  /** Optional 30-day revenue array for the trend chart */
  revenueHistory?:          { date: string; revenue: number }[];
  dataUnavailable?:         boolean;
}

export default function AdminDashboardTabs(props: DashboardProps) {
  const {
    totalInstructors, approvedInstructors, pendingInstructors,
    totalBookings, bookingsThisMonth, totalClients,
    platformRevenueThisMonth, subMap,
    endedConfirmed, expiringDocs, unverifiedABNs, openDisputes,
    recentBookings, revenueHistory,
    dataUnavailable = false,
  } = props;

  const alertCount =
    (pendingInstructors > 0 ? 1 : 0) +
    (endedConfirmed     > 0 ? 1 : 0) +
    (expiringDocs       > 0 ? 1 : 0) +
    (unverifiedABNs     > 0 ? 1 : 0) +
    (openDisputes       > 0 ? 1 : 0);

  /* ── Signals constructed via shared schema ── */
  const signals = constructDashboardSignals({
    pendingInstructors,
    endedConfirmed,
    expiringDocs,
    unverifiedABNs,
    openDisputes,
  });

  /* ── Subscription chart data ── */
  const subChartData = [
    { name: 'Basic',    value: subMap['BASIC']    ?? 0, color: CHART_COLORS.slate  },
    { name: 'Pro',      value: subMap['PRO']      ?? 0, color: CHART_COLORS.blue   },
    { name: 'Studio',   value: subMap['STUDIO']   ?? 0, color: CHART_COLORS.indigo },
    { name: 'Premium',  value: (subMap['PREMIUM'] ?? 0) + (subMap['PREMIUM'] ?? 0), color: CHART_COLORS.violet },
  ].filter(d => d.value > 0);

  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview" className="flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4" />
          Overview
          {alertCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{alertCount}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="operations" className="flex items-center gap-2">
          <Activity className="w-4 h-4" /> Operations
        </TabsTrigger>
        <TabsTrigger value="intelligence" className="flex items-center gap-2">
          <Brain className="w-4 h-4" /> Intelligence
        </TabsTrigger>
        <TabsTrigger value="risk" className="flex items-center gap-2">
          <Shield className="w-4 h-4" /> Risk Monitor
        </TabsTrigger>
      </TabsList>

      {/* ── Overview ──────────────────────────────────────────────────────── */}
      <TabsContent value="overview" className="space-y-6">

        {dataUnavailable && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <div>
              <AlertTitle>Dashboard data temporarily unavailable</AlertTitle>
              <AlertDescription>A database query failed. Figures may be zero or stale. Refresh to retry.</AlertDescription>
            </div>
          </Alert>
        )}

        {/* Platform health */}
        <AdminHealthScore />

        {/* Alerts */}
        {alertCount > 0 && (
          <AttentionItemList items={signals} />
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            title="Instructors"
            value={totalInstructors}
            icon={Users}
            sub={`${approvedInstructors} approved · ${pendingInstructors} pending`}
            color={pendingInstructors > 0 ? 'text-amber-400' : undefined}
            href="/admin/instructors"
          />
          <StatCard
            title="Bookings"
            value={totalBookings}
            icon={Calendar}
            sub={`+${bookingsThisMonth} this month`}
            href="/admin/bookings"
          />
          <StatCard
            title="Students"
            value={totalClients}
            icon={Users}
            href="/admin/clients"
          />
          <StatCard
            title="Revenue MTD"
            value={`$${platformRevenueThisMonth.toFixed(0)}`}
            icon={DollarSign}
            color="text-emerald-400"
            sub="Platform fees collected"
            href="/admin/revenue"
          />
        </div>

        {/* Revenue chart + Subscription donut */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {revenueHistory && revenueHistory.length > 1 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Last 30 days platform fees</CardDescription>
              </CardHeader>
              <CardContent>
                <AreaChart
                  data={revenueHistory}
                  xKey="date"
                  series={[{ key: 'revenue', color: CHART_COLORS.violet, label: 'Revenue' }]}
                  height={220}
                  format={v => `$${v}`}
                />
              </CardContent>
            </Card>
          )}

          {subChartData.length > 0 && (
            <Card className={revenueHistory && revenueHistory.length > 1 ? '' : 'lg:col-span-2'}>
              <CardHeader>
                <CardTitle>Subscription Mix</CardTitle>
                <CardDescription>Active tenants by tier</CardDescription>
              </CardHeader>
              <CardContent>
                <DonutChart data={subChartData} height={200} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/admin/instructors?status=PENDING', label: 'Pending Approvals', count: pendingInstructors, variant: 'warning' as const },
            { href: '/admin/payouts',   label: 'Process Payouts',  count: null,          variant: 'success' as const },
            { href: '/admin/bookings',  label: 'All Bookings',     count: totalBookings,  variant: 'info' as const },
            { href: '/admin/support',   label: 'Support Centre',   count: null,          variant: 'violet' as const },
          ].map(({ href, label, count, variant }) => (
            <Link key={href} href={href}>
              <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="p-4 text-center">
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  {count !== null && (
                    <p className={cn('text-xl font-bold mt-1', ({
                      warning: 'text-amber-400',
                      success: 'text-emerald-400',
                      violet:  'text-violet-400',
                      info:    'text-primary',
                    } as Record<string, string>)[variant] ?? 'text-primary')}>
                      {count}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Recent bookings table */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent Bookings</CardTitle>
            <Link href="/admin/bookings" className="text-xs text-primary hover:text-foreground transition-colors">
              View all →
            </Link>
          </CardHeader>

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-secondary/40">
                <tr>
                  {['Client', 'Provider', 'Date', 'Status', 'Source', 'Price'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentBookings.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No bookings yet</td></tr>
                ) : recentBookings.slice(0, 8).map((b: any) => {
                  const source      = b.source === 'offline' ? 'Offline' : b.paymentIntentId ? 'Platform · Stripe' : 'Platform · Wallet';
                  const sourceBadge = b.source === 'offline' ? 'warning' : 'info';
                  return (
                    <tr key={b.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">{b.customer?.name || b.customerName || '—'}</p>
                        <p className="text-xs text-muted-foreground">{b.customer?.phone || ''}</p>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{b.provider?.name || '—'}</td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">
                        {b.startTime ? new Date(b.startTime).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold', getStatusConfig(b.status).badge)}>
                          {getStatusConfig(b.status).label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={sourceBadge as any} className="text-[10px]">{source}</Badge>
                      </td>
                      <td className="px-5 py-3 font-semibold text-foreground">${toNumber(b.price || 0).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-border">
            {recentBookings.length === 0 ? (
              <div className="px-5 py-8 text-center text-muted-foreground">No bookings yet</div>
            ) : recentBookings.slice(0, 8).map((b: any) => (
              <div key={b.id} className="px-5 py-4 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{b.customer?.name || b.customerName || '—'}</p>
                    <p className="text-xs text-muted-foreground">{b.provider?.name || '—'}</p>
                  </div>
                  <p className="font-semibold text-foreground shrink-0">${toNumber(b.price || 0).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', getStatusConfig(b.status).badge)}>
                    {getStatusConfig(b.status).label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {b.startTime ? new Date(b.startTime).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </TabsContent>

      {/* ── Operations ─────────────────────────────────────────────────────── */}
      <TabsContent value="operations" className="space-y-6">
        <AdminDailySummary />
        <BookingPaymentStatus />
        <InstructorRetentionStatus />
        <AdminOperationsTimeline />
      </TabsContent>

      {/* ── Intelligence ──────────────────────────────────────────────────── */}
      <TabsContent value="intelligence" className="space-y-6">
        <AdminWeeklyReport />
        <AdminAIChat />
        <AdminBriefHistory />
      </TabsContent>

      {/* ── Risk ──────────────────────────────────────────────────────────── */}
      <TabsContent value="risk" className="space-y-6">
        <AdminInstructorRisk />
      </TabsContent>
    </Tabs>
  );
}
