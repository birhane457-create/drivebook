'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import AdminNav from '@/components/admin/AdminNav'
import { Search, ChevronRight, AlertCircle, Users, Wallet, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { AdminPageLayout } from '@/components/ui'
import { TransactionStatusBadge } from '@/components/ui'
import { cn } from '@/lib/cn'

interface Client {
  id: string
  name: string
  email: string
  createdAt: string
  totalPaid: number
  totalSpent: number
  creditsRemaining: number
  bookingCount: number
  status: 'active' | 'zero-balance' | 'negative'
}

interface ServerStats {
  totalClients: number
  clientsWithPositiveBalance: number
  clientsWithZeroBalance: number
  clientsWithNegativeBalance: number
  totalWalletBalance: number
  totalDebitAmount: number
}

type StatusFilter = 'all' | 'active' | 'zero-balance' | 'negative'

export default function AdminClientsPage() {
  const [clients, setClients]       = useState<Client[]>([])
  const [stats, setStats]           = useState<ServerStats | null>(null)
  const [loading, setLoading]       = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all')
  const [pagination, setPagination] = useState({
    page: 1, limit: 25, total: 0, pages: 0, hasMore: false,
  })

  // Debounce search → server
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(id)
  }, [search])

  // Re-fetch when debounced search or status filter changes
  useEffect(() => { fetchClients(1) }, [debouncedSearch, filterStatus])

  // Fetch DB-level aggregated stats once on mount
  useEffect(() => {
    fetch('/api/admin/clients?stats=true')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.stats) setStats(d.stats) })
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [])

  const fetchClients = async (page: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      const res = await fetch(`/api/admin/clients?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setClients(data.clients ?? [])
      setPagination(data.pagination)
    } catch {
      setError('Failed to load clients')
    } finally {
      setLoading(false)
    }
  }

  const kpis = [
    {
      label: 'Total Clients',
      value: stats?.totalClients ?? pagination.total,
      icon: <Users className="w-4 h-4" />,
    },
    {
      label: 'Active Wallets',
      value: stats?.clientsWithPositiveBalance ?? '—',
      icon: <Wallet className="w-4 h-4" />,
      color: 'text-emerald-400',
      sub: 'positive balance',
    },
    {
      label: 'Total Credits Paid',
      value: stats ? `$${stats.totalWalletBalance.toFixed(0)}` : '—',
      icon: <TrendingUp className="w-4 h-4" />,
      color: 'text-primary',
      sub: 'wallet balance across all clients',
    },
    {
      label: 'Zero Balance',
      value: stats?.clientsWithZeroBalance ?? '—',
      icon: <AlertTriangle className="w-4 h-4" />,
      color: 'text-amber-400',
    },
    {
      label: 'Negative Balance',
      value: stats?.clientsWithNegativeBalance ?? '—',
      icon: <TrendingDown className="w-4 h-4" />,
      color: stats && stats.clientsWithNegativeBalance > 0 ? 'text-destructive' : undefined,
    },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <AdminPageLayout
          title="Client Management"
          description="Manage client accounts, wallets, and credits"
          breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Clients' }]}
          kpis={kpis}
          kpiColumns={5}
          isLoading={statsLoading}
          error={error}
        >
          {/* Search + filter bar */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <input
                  type="text"
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-primary/50 focus:outline-none text-sm"
                />
              </div>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as StatusFilter)}
                className="px-4 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active (Has Credits)</option>
                <option value="zero-balance">Zero Balance</option>
                <option value="negative">Negative Balance</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <p className="text-muted-foreground">Loading clients…</p>
            </div>
          ) : clients.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-foreground font-medium mb-1">No clients found</p>
              <p className="text-sm text-muted-foreground">
                {debouncedSearch || filterStatus !== 'all' ? 'Try adjusting your search or filter.' : 'No clients registered yet.'}
              </p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background border-b border-border">
                    <tr>
                      {['Client', 'Email', 'Total Paid', 'Spent', 'Remaining', 'Bookings', 'Status', ''].map(h => (
                        <th key={h} className={cn(
                          'px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                          h === '' ? 'text-right' : 'text-left',
                        )}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {clients.map(client => (
                      <tr key={client.id} className="hover:bg-secondary/50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-foreground">{client.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(client.createdAt).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">{client.email}</td>
                        <td className="px-5 py-4 font-semibold text-foreground">${client.totalPaid.toFixed(2)}</td>
                        <td className="px-5 py-4 font-semibold text-amber-400">${client.totalSpent.toFixed(2)}</td>
                        <td className="px-5 py-4">
                          <span className={cn('font-bold', {
                            'text-emerald-400': client.creditsRemaining > 0,
                            'text-muted-foreground': client.creditsRemaining === 0,
                            'text-destructive': client.creditsRemaining < 0,
                          })}>
                            ${client.creditsRemaining.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-foreground">{client.bookingCount}</td>
                        <td className="px-5 py-4">
                          <TransactionStatusBadge
                            status={client.status}
                            label={
                              client.status === 'active'       ? 'Active' :
                              client.status === 'zero-balance' ? 'Zero Balance' : 'Negative'
                            }
                          />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link
                            href={`/admin/clients/${client.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-primary hover:bg-primary/10 rounded-lg transition text-sm font-medium"
                          >
                            Details <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-border">
                {clients.map(client => (
                  <div key={client.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.email}</p>
                      </div>
                      <TransactionStatusBadge
                        status={client.status}
                        label={
                          client.status === 'active'       ? 'Active' :
                          client.status === 'zero-balance' ? 'Zero' : 'Negative'
                        }
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><p className="text-muted-foreground">Paid</p><p className="font-semibold text-foreground">${client.totalPaid.toFixed(0)}</p></div>
                      <div><p className="text-muted-foreground">Spent</p><p className="font-semibold text-amber-400">${client.totalSpent.toFixed(0)}</p></div>
                      <div><p className="text-muted-foreground">Balance</p>
                        <p className={cn('font-bold', {
                          'text-emerald-400': client.creditsRemaining > 0,
                          'text-muted-foreground': client.creditsRemaining === 0,
                          'text-destructive': client.creditsRemaining < 0,
                        })}>${client.creditsRemaining.toFixed(0)}</p>
                      </div>
                    </div>
                    <Link href={`/admin/clients/${client.id}`} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium">
                      View details <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages} · {pagination.total} clients
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchClients(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-secondary disabled:opacity-40 transition"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchClients(pagination.page + 1)}
                  disabled={!pagination.hasMore}
                  className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-secondary disabled:opacity-40 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Showing {clients.length} of {pagination.total} clients
            {(debouncedSearch || filterStatus !== 'all') && ' (filtered)'}
          </p>
        </AdminPageLayout>
      </div>
    </div>
  )
}
