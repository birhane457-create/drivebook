'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, Activity, Brain, Shield,
  AlertTriangle, Clock, DollarSign, Users, Calendar,
} from 'lucide-react'
import AdminHealthScore from './AdminHealthScore'
import AdminDailySummary from './AdminDailySummary'
import AdminInstructorRisk from './AdminInstructorRisk'
import AdminBriefHistory from './AdminBriefHistory'
import AdminWeeklyReport from './AdminWeeklyReport'
import AdminOperationsTimeline from './AdminOperationsTimeline'
import AdminAIChat from './AdminAIChat'
import BookingPaymentStatus from './BookingPaymentStatus'
import InstructorRetentionStatus from './InstructorRetentionStatus'

// Types passed in from the server component
interface DashboardProps {
  // Stats
  totalInstructors: number
  approvedInstructors: number
  pendingInstructors: number
  suspendedInstructors: number
  totalBookings: number
  bookingsThisMonth: number
  totalClients: number
  platformRevenueThisMonth: number
  subMap: Record<string, number>
  // Alerts
  endedConfirmed: number
  expiringDocs: number
  unverifiedABNs: number
  openDisputes: number
  // Recent bookings
  recentBookings: any[]
}

type Tab = 'overview' | 'operations' | 'intelligence' | 'risk'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',      label: 'Overview',      icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'operations',    label: 'Operations',    icon: <Activity className="w-4 h-4" /> },
  { id: 'intelligence',  label: 'Intelligence',  icon: <Brain className="w-4 h-4" /> },
  { id: 'risk',          label: 'Risk Monitor',  icon: <Shield className="w-4 h-4" /> },
]

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED:  'bg-green-900/40 text-green-300',
  COMPLETED:  'bg-blue-900/40 text-blue-300',
  PENDING:    'bg-yellow-900/40 text-yellow-300',
  CANCELLED:  'bg-red-900/40 text-red-300',
}

export default function AdminDashboardTabs(props: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const {
    totalInstructors, approvedInstructors, pendingInstructors,
    totalBookings, bookingsThisMonth, totalClients,
    platformRevenueThisMonth, subMap,
    endedConfirmed, expiringDocs, unverifiedABNs, openDisputes,
    recentBookings,
  } = props

  const alertCount = (pendingInstructors > 0 ? 1 : 0) +
    (endedConfirmed > 0 ? 1 : 0) + (expiringDocs > 0 ? 1 : 0) +
    (unverifiedABNs > 0 ? 1 : 0) + (openDisputes > 0 ? 1 : 0)

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-800 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap -mb-px ${
              activeTab === tab.id
                ? 'border-violet-500 text-violet-300'
                : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
            }`}
          >
            {tab.icon}
            {tab.label}
            {/* Alert badge on Overview tab */}
            {tab.id === 'overview' && alertCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-red-900/40 text-red-300 border border-red-700/50">
                {alertCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">

          {/* Health Score */}
          <AdminHealthScore />

          {/* Alerts */}
          {alertCount > 0 && (
            <div className="space-y-2">
              {pendingInstructors > 0 && (
                <Alert color="amber" icon="👩‍🏫" href="/admin/instructors?status=PENDING" action="Review now →">
                  {pendingInstructors} instructor{pendingInstructors > 1 ? 's' : ''} awaiting approval
                </Alert>
              )}
              {endedConfirmed > 0 && (
                <Alert color="violet" icon="📐" href="/admin/bookings" action="Go to Bookings →">
                  {endedConfirmed} lesson{endedConfirmed > 1 ? 's' : ''} ended but still CONFIRMED — mark complete to release payouts
                </Alert>
              )}
              {expiringDocs > 0 && (
                <Alert color="yellow" icon="⚠️" href="/admin/documents" action="Review Docs →">
                  {expiringDocs} instructor{expiringDocs > 1 ? 's have' : ' has'} documents expiring within 30 days
                </Alert>
              )}
              {unverifiedABNs > 0 && (
                <Alert color="orange" icon="🧾" href="/admin/instructors" action="Verify ABNs →">
                  {unverifiedABNs} approved instructor{unverifiedABNs > 1 ? 's have' : ' has'} unverified ABN — 47% withholding applies
                </Alert>
              )}
              {openDisputes > 0 && (
                <Alert color="red" icon="⚠️" href="/admin/disputes" action="Review Disputes →">
                  {openDisputes} open chargeback{openDisputes > 1 ? 's' : ''} — payouts frozen pending resolution
                </Alert>
              )}
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={<Users className="w-4 h-4 text-violet-400" />} label="Instructors" value={totalInstructors}
              sub={`${approvedInstructors} approved · ${pendingInstructors} pending`} />
            <StatCard icon={<Calendar className="w-4 h-4 text-blue-400" />} label="Bookings" value={totalBookings}
              sub={`+${bookingsThisMonth} this month`} />
            <StatCard icon={<Users className="w-4 h-4 text-emerald-400" />} label="Students" value={totalClients} />
            <StatCard icon={<DollarSign className="w-4 h-4 text-green-400" />} label="Revenue (MTD)"
              value={`$${platformRevenueThisMonth.toFixed(0)}`} sub="Platform fees collected" valueColor="text-green-400" />
          </div>

          {/* Subscription breakdown */}
          <div className="bg-slate-900 rounded-xl border border-slate-800">
            <div className="px-5 py-4 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100">Subscription Breakdown</h2>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { tier: 'BASIC',    label: 'Basic',    price: '$29/mo',  color: 'bg-slate-800 text-slate-300' },
                { tier: 'PRO',      label: 'Pro',      price: '$79/mo',  color: 'bg-blue-900/20 text-blue-300' },
                { tier: 'STUDIO',   label: 'Studio',   price: '$129/mo', color: 'bg-indigo-900/20 text-indigo-300' },
                { tier: 'BUSINESS', label: 'Business', price: '$199/mo', color: 'bg-violet-900/20 text-violet-300' },
              ].map(({ tier, label, price, color }) => (
                <div key={tier} className={`rounded-xl p-4 text-center ${color}`}>
                  <p className="text-xs font-medium mb-1 opacity-70">{label}</p>
                  <p className="text-2xl font-bold">{subMap[tier] ?? 0}</p>
                  <p className="text-xs opacity-50 mt-1">{price}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: '/admin/instructors?status=PENDING', label: 'Pending Approvals', count: pendingInstructors, color: 'border-amber-700/50 bg-amber-900/20 text-amber-300' },
              { href: '/admin/payouts',   label: 'Process Payouts',  count: null, color: 'border-green-700/50 bg-green-900/20 text-green-300' },
              { href: '/admin/bookings',  label: 'All Bookings',     count: totalBookings, color: 'border-blue-700/50 bg-blue-900/20 text-blue-300' },
              { href: '/admin/support',   label: 'Support Centre',   count: null, color: 'border-violet-700/50 bg-violet-900/20 text-violet-300' },
            ].map(({ href, label, count, color }) => (
              <Link key={href} href={href} className={`border rounded-xl p-4 text-center hover:opacity-80 transition ${color}`}>
                <p className="text-sm font-semibold">{label}</p>
                {count !== null && <p className="text-xl font-bold mt-1">{count}</p>}
              </Link>
            ))}
          </div>

          {/* Recent bookings */}
          <div className="bg-slate-900 rounded-xl border border-slate-800">
            <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-sm font-semibold text-slate-100">Recent Bookings</h2>
              <Link href="/admin/bookings" className="text-xs text-blue-400 hover:text-blue-300 transition">View all →</Link>
            </div>
            
            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-950">
                  <tr>
                    {['Client', 'Instructor', 'Date', 'Status', 'Source', 'Price'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {recentBookings.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">No bookings yet</td></tr>
                  ) : recentBookings.slice(0, 5).map((b: any) => {
                    let sourceBadge = 'Platform'
                    let sourceBadgeColor = 'bg-blue-900/40 text-blue-300'
                    if (b.source === 'offline') {
                      sourceBadge = `Offline · ${b.offlinePaymentMethod === 'cash' ? 'Cash' : b.offlinePaymentMethod === 'bank_transfer' ? 'Bank' : 'Other'}`
                      sourceBadgeColor = 'bg-amber-900/40 text-amber-300'
                    } else if (b.paymentIntentId) {
                      sourceBadge = 'Platform · Stripe'
                      sourceBadgeColor = 'bg-blue-900/40 text-blue-300'
                    } else if (b.status === 'CONFIRMED' || b.status === 'COMPLETED') {
                      sourceBadge = 'Platform · Wallet'
                      sourceBadgeColor = 'bg-emerald-900/40 text-emerald-300'
                    } else if (b.status === 'PENDING_PAYMENT') {
                      sourceBadge = 'Awaiting Payment'
                      sourceBadgeColor = 'bg-orange-900/40 text-orange-300'
                    }
                    return (
                      <tr key={b.id} className="hover:bg-slate-800/60 transition">
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-100">{b.client?.name || b.clientName || '—'}</p>
                          <p className="text-xs text-slate-500">{b.client?.phone || b.clientPhone || ''}</p>
                        </td>
                        <td className="px-5 py-3 text-slate-300">{b.instructor?.name || '—'}</td>
                        <td className="px-5 py-3 text-slate-500">
                          {b.startTime ? new Date(b.startTime).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[b.status] ?? 'bg-slate-800 text-slate-400'}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${sourceBadgeColor}`}>
                            {sourceBadge}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-medium text-slate-100">${(b.price || 0).toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile list view */}
            <div className="md:hidden">
              {recentBookings.length === 0 ? (
                <div className="px-5 py-8 text-center text-slate-500">No bookings yet</div>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {recentBookings.slice(0, 5).map((b: any) => {
                    let sourceBadge = 'Platform'
                    let sourceBadgeColor = 'bg-blue-900/40 text-blue-300'
                    if (b.source === 'offline') {
                      sourceBadge = `Offline · ${b.offlinePaymentMethod === 'cash' ? 'Cash' : b.offlinePaymentMethod === 'bank_transfer' ? 'Bank' : 'Other'}`
                      sourceBadgeColor = 'bg-amber-900/40 text-amber-300'
                    } else if (b.paymentIntentId) {
                      sourceBadge = 'Platform · Stripe'
                      sourceBadgeColor = 'bg-blue-900/40 text-blue-300'
                    } else if (b.status === 'CONFIRMED' || b.status === 'COMPLETED') {
                      sourceBadge = 'Platform · Wallet'
                      sourceBadgeColor = 'bg-emerald-900/40 text-emerald-300'
                    } else if (b.status === 'PENDING_PAYMENT') {
                      sourceBadge = 'Awaiting Payment'
                      sourceBadgeColor = 'bg-orange-900/40 text-orange-300'
                    }
                    return (
                      <li key={b.id} className="px-5 py-4 hover:bg-slate-800/60 transition">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-100 truncate">{b.client?.name || b.clientName || '—'}</p>
                              <p className="text-xs text-slate-500">{b.client?.phone || b.clientPhone || ''}</p>
                            </div>
                            <p className="font-medium text-slate-100 shrink-0">${(b.price || 0).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-400">{b.instructor?.name || '—'}</span>
                            <span className="text-slate-500">
                              {b.startTime ? new Date(b.startTime).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[b.status] ?? 'bg-slate-800 text-slate-400'}`}>
                              {b.status}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${sourceBadgeColor}`}>
                              {sourceBadge}
                            </span>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Operations tab */}
      {activeTab === 'operations' && (
        <div className="space-y-6">
          <AdminDailySummary />
          <BookingPaymentStatus />
          <InstructorRetentionStatus />
          <AdminOperationsTimeline />
        </div>
      )}

      {/* Intelligence tab */}
      {activeTab === 'intelligence' && (
        <div className="space-y-6">
          <AdminWeeklyReport />
          <AdminAIChat />
          <AdminBriefHistory />
        </div>
      )}

      {/* Risk tab */}
      {activeTab === 'risk' && (
        <div className="space-y-6">
          <AdminInstructorRisk />
        </div>
      )}
    </div>
  )
}

// Small helpers

function StatCard({ icon, label, value, sub, valueColor = 'text-slate-100' }: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  valueColor?: string
}) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-slate-500 font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  )
}

function Alert({ color, icon, href, action, children }: {
  color: 'amber' | 'violet' | 'yellow' | 'orange' | 'red'
  icon: string
  href: string
  action: string
  children: React.ReactNode
}) {
  const colors: Record<string, string> = {
    amber:  'bg-amber-900/20 border-amber-700/50 text-amber-300',
    violet: 'bg-violet-900/20 border-violet-700/50 text-violet-300',
    yellow: 'bg-yellow-900/20 border-yellow-700/50 text-yellow-300',
    orange: 'bg-orange-900/20 border-orange-700/50 text-orange-300',
    red:    'bg-red-900/20 border-red-700/50 text-red-300',
  }
  const actionColors: Record<string, string> = {
    amber: 'text-amber-400 hover:text-amber-200', violet: 'text-violet-400 hover:text-violet-200',
    yellow: 'text-yellow-400 hover:text-yellow-200', orange: 'text-orange-400 hover:text-orange-200',
    red: 'text-red-400 hover:text-red-200',
  }
  return (
    <div className={`border rounded-xl px-4 py-3 flex items-center justify-between ${colors[color]}`}>
      <p className="text-sm font-medium flex items-center gap-2">
        <span>{icon}</span>
        {children}
      </p>
      <Link href={href} className={`text-xs font-semibold shrink-0 ml-3 transition ${actionColors[color]}`}>
        {action}
      </Link>
    </div>
  )
}
