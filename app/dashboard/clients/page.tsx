'use client'

import { useState, useEffect } from 'react'
import {
  User, Phone, Mail, MapPin, Plus, Search, Edit2,
  ChevronDown, ChevronUp, Save, X, CalendarPlus, AlertCircle,
  Users, ArrowUpDown, ArrowDownAZ, Clock
} from 'lucide-react'
import Link from 'next/link'
import { useBusinessConfig } from '@/hooks/useBusinessConfig'
import { DashboardPageLayout, Alert, AlertDescription } from '@/components/ui'
import { cn } from '@/lib/cn'

interface Client {
  id: string
  name: string
  phone: string
  email: string
  userId?: string
  addressText?: string
  addressLatitude?: number
  addressLongitude?: number
  notes?: string
  createdAt: string
}

interface PaginationMeta {
  page: number; limit: number; total: number; pages: number; hasMore: boolean
}

type SortMode = 'newest' | 'az' | 'za'

export default function ClientsPage() {
  const { customer, customers } = useBusinessConfig()

  const [clients, setClients]   = useState<Client[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1, limit: 25, total: 0, pages: 0, hasMore: false,
  })
  const [search, setSearch]             = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortMode, setSortMode]         = useState<SortMode>('newest')
  const [showForm, setShowForm]         = useState(false)
  const [loading, setLoading]           = useState(true)
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editData, setEditData]         = useState<Client | null>(null)
  const [formData, setFormData]         = useState({ name: '', phone: '', email: '', addressText: '', notes: '' })
  const [formError, setFormError]       = useState<string | null>(null)
  const [formSuccess, setFormSuccess]   = useState(false)
  const [saveError, setSaveError]       = useState<string | null>(null)

  // Debounce
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => { fetchClients(1, debouncedSearch) }, [debouncedSearch])

  const fetchClients = async (page = 1, searchTerm = debouncedSearch) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' })
      if (searchTerm) params.set('search', searchTerm)
      const res = await fetch(`/api/clients?${params}`)
      if (!res.ok) { setClients([]); return }
      const data = await res.json()
      if (data.pagination) { setClients(data.clients); setPagination(data.pagination) }
      else if (Array.isArray(data)) setClients(data)
      else setClients([])
    } catch { setClients([]) }
    finally { setLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setFormData({ name: '', phone: '', email: '', addressText: '', notes: '' })
        setShowForm(false)
        setFormSuccess(true)
        setTimeout(() => setFormSuccess(false), 3000)
        fetchClients(1)
      } else {
        const err = await res.json()
        setFormError(err.details || err.error || 'Failed to create client.')
      }
    } catch { setFormError('Failed to create client. Check your connection.') }
  }

  const handleEdit    = (c: Client) => { setEditingId(c.id); setEditData({ ...c }); setExpandedId(c.id) }
  const handleCancelEdit = () => { setEditingId(null); setEditData(null) }

  const handleSaveEdit = async () => {
    if (!editData) return
    setSaveError(null)
    try {
      const res = await fetch(`/api/clients/${editData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editData.name, phone: editData.phone, email: editData.email,
          addressText: editData.addressText, notes: editData.notes,
        }),
      })
      if (res.ok) { setEditingId(null); setEditData(null); fetchClients(pagination.page) }
      else { const err = await res.json(); setSaveError(err.error || 'Failed to save.') }
    } catch { setSaveError('Network error — please try again.') }
  }

  const toggleExpand = (id: string) => {
    if (editingId === id) return
    setExpandedId(expandedId === id ? null : id)
  }

  // Client-side sort on the current page
  const sortedClients = [...(Array.isArray(clients) ? clients : [])].sort((a, b) => {
    if (sortMode === 'az') return a.name.localeCompare(b.name)
    if (sortMode === 'za') return b.name.localeCompare(a.name)
    // newest — default from server, no re-sort needed
    return 0
  })

  const noAccountCount = sortedClients.filter(c => !c.userId).length

  const kpis = [
    {
      label: customers,
      value: pagination.total,
      icon:  <Users className="w-4 h-4" />,
      sub:   'total registered',
    },
    {
      label: 'This Page',
      value: sortedClients.length,
      icon:  <User className="w-4 h-4" />,
      sub:   `of ${pagination.total} total`,
    },
    {
      label: 'No Account',
      value: noAccountCount,
      icon:  <AlertCircle className="w-4 h-4" />,
      // informational — only colour if non-zero
      color: noAccountCount > 0 ? 'text-muted-foreground' : undefined,
      sub:   "haven't registered yet",
    },
  ]

  const inputCls = 'w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none text-sm'

  // Cycle sort: newest → A–Z → Z–A → newest
  const cycleSortLabel = sortMode === 'newest' ? 'Newest' : sortMode === 'az' ? 'A – Z' : 'Z – A'
  const cycleSortIcon  =
    sortMode === 'newest' ? <Clock className="w-3.5 h-3.5" /> :
    sortMode === 'az'     ? <ArrowDownAZ className="w-3.5 h-3.5" /> :
                            <ArrowUpDown className="w-3.5 h-3.5" />
  const cycleSort = () =>
    setSortMode(s => s === 'newest' ? 'az' : s === 'az' ? 'za' : 'newest')

  return (
    <DashboardPageLayout
      title={customers}
      description="Manage your client contacts, bookings, and notes"
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: customers }]}
      primaryAction={{
        label:   `Add ${customer}`,
        icon:    <Plus className="w-4 h-4" />,
        onClick: () => setShowForm(!showForm),
      }}
      kpis={kpis}
      kpiColumns={3}
      isLoading={loading && sortedClients.length === 0}
    >

      {/* Add client form */}
      {showForm && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="text-base font-bold text-foreground">New {customer}</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Full Name</label>
                <input type="text" required value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className={inputCls} placeholder="Jane Smith" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
                <input type="tel" required value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                  className={inputCls} placeholder="04xx xxx xxx" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <input type="email" required value={formData.email}
                onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                className={inputCls} placeholder="jane@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Address</label>
              <input type="text" value={formData.addressText}
                onChange={e => setFormData(p => ({ ...p, addressText: e.target.value }))}
                className={inputCls} placeholder="Pickup address" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
              <textarea value={formData.notes} rows={2}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                className={inputCls} />
            </div>
            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  {formError}
                  <button onClick={() => setFormError(null)} className="ml-4 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
                </AlertDescription>
              </Alert>
            )}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-secondary text-sm transition">
                Cancel
              </button>
              <button type="submit"
                className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 text-sm font-medium transition">
                Add {customer}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Success toast */}
      {formSuccess && (
        <Alert variant="success">
          <AlertDescription>{customer} added successfully.</AlertDescription>
        </Alert>
      )}

      {/* Search + sort bar */}
      <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <input
            type="text"
            placeholder={`Search ${customers.toLowerCase()} by name, phone, or email…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={cn(inputCls, 'pl-10')}
          />
        </div>
        {/* Sort toggle — cycles through newest / A–Z / Z–A */}
        <button
          onClick={cycleSort}
          title="Toggle sort order"
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition text-xs font-medium shrink-0"
        >
          {cycleSortIcon}
          <span className="hidden sm:inline">{cycleSortLabel}</span>
        </button>
      </div>

      {/* List */}
      {loading && sortedClients.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-10 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading {customers.toLowerCase()}…</p>
        </div>
      ) : sortedClients.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <User className="h-14 w-14 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-foreground mb-1">
            {debouncedSearch
              ? `No ${customers.toLowerCase()} match "${debouncedSearch}"`
              : `No ${customers.toLowerCase()} yet`}
          </h3>
          <p className="text-sm text-muted-foreground">
            {debouncedSearch
              ? 'Try a different name, phone, or email.'
              : `Add your first ${customer.toLowerCase()} to get started.`}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {sortedClients.map(client => {
              const isExpanded = expandedId === client.id
              const isEditing  = editingId  === client.id
              const display    = isEditing && editData ? editData : client

              return (
                <div key={client.id} className="hover:bg-secondary/30 transition-colors">
                  {/* Row */}
                  <div
                    className="px-4 py-3 cursor-pointer flex items-center justify-between gap-3"
                    onClick={() => !isEditing && toggleExpand(client.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Avatar — initials instead of icon */}
                      <div className="h-9 w-9 bg-primary/15 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {client.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground text-sm truncate">{client.name}</span>
                          {/* item 3 — informational badge, not warning colour */}
                          {!client.userId && (
                            <span className="inline-flex items-center gap-1 text-xs bg-secondary text-muted-foreground border border-border px-2 py-0.5 rounded-full shrink-0">
                              No account
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />{client.phone}
                          </span>
                          <span className="hidden sm:flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3" />{client.email}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* item 4 — consistent h-8 w-8 ghost icon buttons */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {!isEditing && (
                        <>
                          <Link
                            href={`/dashboard/clients/${client.id}`}
                            onClick={e => e.stopPropagation()}
                            title="View profile"
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          <Link
                            href={`/dashboard/bookings/new?customerId=${client.id}`}
                            onClick={e => e.stopPropagation()}
                            title={`Book ${customer}`}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 transition"
                          >
                            <CalendarPlus className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={e => { e.stopPropagation(); handleEdit(client) }}
                            title="Edit"
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {!isEditing && (
                        <div className="h-8 w-8 flex items-center justify-center text-muted-foreground/40">
                          {isExpanded
                            ? <ChevronUp className="h-4 w-4" />
                            : <ChevronDown className="h-4 w-4" />}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded panel */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 bg-background/60 border-t border-border space-y-4">
                      {isEditing && editData ? (
                        <div className="space-y-3">
                          <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-foreground mb-1">Name</label>
                              <input type="text" value={editData.name}
                                onChange={e => setEditData({ ...editData, name: e.target.value })}
                                className={inputCls} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-foreground mb-1">Phone</label>
                              <input type="tel" value={editData.phone}
                                onChange={e => setEditData({ ...editData, phone: e.target.value })}
                                className={inputCls} />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">
                              Email {client.userId && <span className="text-muted-foreground font-normal">(linked account — cannot edit)</span>}
                            </label>
                            <input type="email" value={editData.email} disabled={!!client.userId}
                              onChange={e => setEditData({ ...editData, email: e.target.value })}
                              className={cn(inputCls, client.userId && 'opacity-50 cursor-not-allowed')} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">Address</label>
                            <input type="text" value={editData.addressText || ''}
                              onChange={e => setEditData({ ...editData, addressText: e.target.value })}
                              className={inputCls} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
                            <textarea value={editData.notes || ''} rows={2}
                              onChange={e => setEditData({ ...editData, notes: e.target.value })}
                              className={inputCls} />
                          </div>
                          {saveError && (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>{saveError}</AlertDescription>
                            </Alert>
                          )}
                          <div className="flex gap-2">
                            <button onClick={handleSaveEdit}
                              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 text-sm font-medium flex items-center justify-center gap-2 transition">
                              <Save className="h-4 w-4" /> Save Changes
                            </button>
                            <button onClick={handleCancelEdit}
                              className="flex-1 border border-border px-4 py-2 rounded-lg hover:bg-secondary text-foreground text-sm flex items-center justify-center gap-2 transition">
                              <X className="h-4 w-4" /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-foreground">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground/60" />{display.email}
                          </div>
                          {display.addressText && (
                            <div className="flex items-start gap-2 text-foreground">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />{display.addressText}
                            </div>
                          )}
                          {display.notes && (
                            <p className="text-muted-foreground italic text-xs pt-1 border-t border-border">
                              {display.notes}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground/50 pt-1 border-t border-border">
                            Added {new Date(display.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          {!client.userId && (
                            <div className="flex items-start gap-2 bg-secondary border border-border rounded-lg p-3 text-xs text-muted-foreground">
                              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
                              This {customer.toLowerCase()} hasn't registered yet. You can still book for them — they'll receive an email to create an account.
                            </div>
                          )}
                          <Link
                            href={`/dashboard/bookings/new?customerId=${client.id}`}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition no-underline"
                          >
                            <CalendarPlus className="h-4 w-4" /> Book Now
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.pages} · {pagination.total} total
          </p>
          <div className="flex gap-2">
            <button onClick={() => fetchClients(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-secondary disabled:opacity-40 transition">
              Previous
            </button>
            <button onClick={() => fetchClients(pagination.page + 1)}
              disabled={!pagination.hasMore}
              className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-secondary disabled:opacity-40 transition">
              Next
            </button>
          </div>
        </div>
      )}
    </DashboardPageLayout>
  )
}
