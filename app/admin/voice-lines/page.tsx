'use client'
import { AdminPageLayout } from '@/components/ui'

import { useState, useEffect, useCallback } from 'react'
import { Phone, Plus, Trash2, CheckCircle, AlertCircle, RefreshCw, UserCheck, UserX } from 'lucide-react'

interface TwilioNumber {
  id: string
  sid: string
  phoneNumber: string
  friendlyName: string | null
  areaCode: string | null
  status: 'AVAILABLE' | 'ASSIGNED' | 'RELEASED'
  assignedTo: string | null
  assignedAt: string | null
  provider?: {
    id: string
    name: string
    subscriptionTier: string
    voiceLineStatus: string
  } | null
  notes: string | null
  createdAt: string
}

interface PoolStats {
  available: number
  assigned: number
  total: number
  released: number
}

export default function VoiceLinesAdminPage() {
  const [numbers, setNumbers] = useState<TwilioNumber[]>([])
  const [stats, setStats] = useState<PoolStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ sid: '', phoneNumber: '', friendlyName: '', areaCode: '', notes: '' })
  const [assignForm, setAssignForm] = useState<{ numberId: string; providerId: string } | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/voice-lines')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setNumbers(data.numbers)
      setStats(data.stats)
    } catch {
      showToast('error', 'Failed to load voice lines')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setActionLoading('add')
    try {
      const res = await fetch('/api/admin/voice-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      showToast('success', `Number ${addForm.friendlyName || addForm.phoneNumber} added to pool`)
      setShowAddForm(false)
      setAddForm({ sid: '', phoneNumber: '', friendlyName: '', areaCode: '', notes: '' })
      await load()
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleAction(numberId: string, action: string, providerId?: string) {
    setActionLoading(numberId + action)
    try {
      const res = await fetch(`/api/admin/voice-lines/${numberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, providerId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Action failed')
      showToast('success', `Action "${action}" completed`)
      setAssignForm(null)
      await load()
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(numberId: string) {
    setActionLoading(numberId + 'delete')
    try {
      const res = await fetch(`/api/admin/voice-lines/${numberId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      showToast('success', 'Number removed from pool')
      await load()
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setActionLoading(null)
    }
  }

  function statusBadge(status: string) {
    if (status === 'AVAILABLE') return <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-xs font-medium text-emerald-400">Available</span>
    if (status === 'ASSIGNED') return <span className="rounded-full bg-blue-900/40 px-2 py-0.5 text-xs font-medium text-primary">Assigned</span>
    return <span className="rounded-full bg-secondary/70 px-2 py-0.5 text-xs font-medium text-muted-foreground">Released</span>
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminPageLayout title="Voice Lines" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'S' }]}>
      <div className="max-w-5xl mx-auto px-4 py-8">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-foreground text-sm font-medium
          ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-destructive'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Phone className="h-6 w-6" />
            AI Receptionist — Voice Lines
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the Twilio number pool. PRO+ instructors are automatically assigned a number on upgrade.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add Number
          </button>
        </div>
      </div>

      {/* Pool Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Available', value: stats.available, color: 'text-emerald-400' },
            { label: 'Assigned', value: stats.assigned, color: 'text-primary' },
            { label: 'Total in Pool', value: stats.total, color: 'text-foreground' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground/60 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add Number Form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="mb-6 rounded-xl border border-blue-700 bg-card p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Add Number to Pool</h2>
          <p className="text-xs text-muted-foreground">Enter the SID and phone number from your Twilio console. The webhook URL must already be configured in Twilio.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Twilio SID <span className="text-destructive">*</span></label>
              <input required value={addForm.sid} onChange={e => setAddForm(p => ({ ...p, sid: e.target.value }))}
                placeholder="PNxxxxxxxxxxxx" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Phone Number (E.164) <span className="text-destructive">*</span></label>
              <input required value={addForm.phoneNumber} onChange={e => setAddForm(p => ({ ...p, phoneNumber: e.target.value }))}
                placeholder="+61894001234" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Friendly Name</label>
              <input value={addForm.friendlyName} onChange={e => setAddForm(p => ({ ...p, friendlyName: e.target.value }))}
                placeholder="(08) 9400 1234" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Area Code</label>
              <input value={addForm.areaCode} onChange={e => setAddForm(p => ({ ...p, areaCode: e.target.value }))}
                placeholder="08" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Notes (internal)</label>
            <input value={addForm.notes} onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="e.g. Perth metro, 08 prefix" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowAddForm(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            <button type="submit" disabled={actionLoading === 'add'} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/90 disabled:opacity-50">
              {actionLoading === 'add' ? 'Adding…' : 'Add to Pool'}
            </button>
          </div>
        </form>
      )}

      {/* Numbers Table */}
      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : numbers.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 rounded-xl border border-dashed border-border">
          <Phone className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>No numbers in the pool yet.</p>
          <p className="text-sm mt-1">Add Twilio numbers via the button above to get started.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Number</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Assigned To</th>
                <th className="px-4 py-3 text-left">Area</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {numbers.map(num => (
                <tr key={num.id} className="bg-card hover:bg-secondary/50">
                  <td className="px-4 py-3">
                    <div className="font-mono font-medium text-foreground">{num.friendlyName || num.phoneNumber}</div>
                    {num.friendlyName && <div className="font-mono text-xs text-muted-foreground/60">{num.phoneNumber}</div>}
                    {num.notes && <div className="text-xs text-muted-foreground/60 mt-0.5">{num.notes}</div>}
                  </td>
                  <td className="px-4 py-3">{statusBadge(num.status)}</td>
                  <td className="px-4 py-3">
                    {num.provider ? (
                      <div>
                        <div className="text-foreground">{(num.provider ?? num.provider).name}</div>
                        <div className="text-xs text-muted-foreground/60">
                          {(num.provider ?? num.provider).subscriptionTier} · {(num.provider ?? num.provider).voiceLineStatus}
                        </div>
                        {num.assignedAt && (
                          <div className="text-xs text-muted-foreground">{new Date(num.assignedAt).toLocaleDateString('en-AU')}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono">{num.areaCode || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {num.status === 'AVAILABLE' && (
                        <>
                          {assignForm?.numberId === num.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                placeholder="Instructor ID"
                                className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground font-mono w-36"
                                value={assignForm.providerId}
                                onChange={e => setAssignForm(f => f ? { ...f, providerId: e.target.value } : null)}
                              />
                              <button
                                onClick={() => handleAction(num.id, 'assign', assignForm.providerId)}
                                disabled={!assignForm.providerId || actionLoading === num.id + 'assign'}
                                className="rounded bg-primary px-2 py-1 text-xs text-foreground hover:bg-primary/90 disabled:opacity-50"
                              >
                                {actionLoading === num.id + 'assign' ? '…' : 'Assign'}
                              </button>
                              <button onClick={() => setAssignForm(null)} className="text-muted-foreground/60 hover:text-foreground text-xs">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAssignForm({ numberId: num.id, providerId: '' })}
                              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-secondary"
                            >
                              <UserCheck className="h-3 w-3" /> Assign
                            </button>
                          )}
                          {deleteConfirmId === num.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => { handleDelete(num.id); setDeleteConfirmId(null); }}
                                disabled={actionLoading === num.id + 'delete'}
                                className="rounded bg-red-700 px-2 py-1 text-xs text-foreground hover:bg-destructive disabled:opacity-50"
                              >
                                {actionLoading === num.id + 'delete' ? '…' : 'Remove'}
                              </button>
                              <button onClick={() => setDeleteConfirmId(null)} className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(num.id)}
                              className="rounded border border-red-900 px-2 py-1 text-xs text-destructive hover:bg-red-900/20"
                              title="Remove from pool — does NOT cancel in Twilio"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </>
                      )}
                      {num.status === 'ASSIGNED' && (
                        <>
                          {num.provider?.voiceLineStatus === 'ACTIVE' ? (
                            <button
                              onClick={() => handleAction(num.id, 'suspend')}
                              disabled={actionLoading === num.id + 'suspend'}
                              className="flex items-center gap-1 rounded border border-amber-700 px-2 py-1 text-xs text-amber-400 hover:bg-amber-900/20"
                            >
                              <AlertCircle className="h-3 w-3" /> Suspend
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAction(num.id, 'reactivate')}
                              disabled={actionLoading === num.id + 'reactivate'}
                              className="flex items-center gap-1 rounded border border-green-700 px-2 py-1 text-xs text-emerald-400 hover:bg-green-900/20"
                            >
                              <CheckCircle className="h-3 w-3" /> Reactivate
                            </button>
                          )}
                          <button
                            onClick={() => handleAction(num.id, 'release')}
                            disabled={actionLoading === num.id + 'release'}
                            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
                          >
                            <UserX className="h-3 w-3" /> Release
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-border bg-card/50 p-4 text-xs text-muted-foreground/60 space-y-1">
        <p><strong className="text-muted-foreground">Webhook URL to set in Twilio:</strong> <code className="bg-secondary px-1.5 py-0.5 rounded font-mono">https://voice.drivebook.com.au/api/voice/incoming</code></p>
        <p>All numbers must point to this webhook. Assignment is automatic on PRO upgrade via the subscription webhook.</p>
        <p>Manual assignment is for edge cases (e.g. existing PRO instructors before auto-assignment was added).</p>
      </div>
      </div>
      </AdminPageLayout>
    </div>
  )
}
