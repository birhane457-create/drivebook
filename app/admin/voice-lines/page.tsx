'use client'

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
  instructor: {
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
  const [assignForm, setAssignForm] = useState<{ numberId: string; instructorId: string } | null>(null)

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

  async function handleAction(numberId: string, action: string, instructorId?: string) {
    setActionLoading(numberId + action)
    try {
      const res = await fetch(`/api/admin/voice-lines/${numberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, instructorId }),
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
    if (!confirm('Remove this number from the pool? This does NOT cancel it in Twilio.')) return
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
    if (status === 'AVAILABLE') return <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-400">Available</span>
    if (status === 'ASSIGNED') return <span className="rounded-full bg-blue-900/40 px-2 py-0.5 text-xs font-medium text-blue-400">Assigned</span>
    return <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-400">Released</span>
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium
          ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Phone className="h-6 w-6" />
            AI Receptionist — Voice Lines
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage the Twilio number pool. PRO+ instructors are automatically assigned a number on upgrade.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:text-slate-100">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Add Number
          </button>
        </div>
      </div>

      {/* Pool Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Available', value: stats.available, color: 'text-green-400' },
            { label: 'Assigned', value: stats.assigned, color: 'text-blue-400' },
            { label: 'Total in Pool', value: stats.total, color: 'text-slate-300' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add Number Form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="mb-6 rounded-xl border border-blue-700 bg-slate-900 p-5 space-y-4">
          <h2 className="font-semibold text-slate-100">Add Number to Pool</h2>
          <p className="text-xs text-slate-400">Enter the SID and phone number from your Twilio console. The webhook URL must already be configured in Twilio.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Twilio SID <span className="text-red-400">*</span></label>
              <input required value={addForm.sid} onChange={e => setAddForm(p => ({ ...p, sid: e.target.value }))}
                placeholder="PNxxxxxxxxxxxx" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number (E.164) <span className="text-red-400">*</span></label>
              <input required value={addForm.phoneNumber} onChange={e => setAddForm(p => ({ ...p, phoneNumber: e.target.value }))}
                placeholder="+61894001234" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Friendly Name</label>
              <input value={addForm.friendlyName} onChange={e => setAddForm(p => ({ ...p, friendlyName: e.target.value }))}
                placeholder="(08) 9400 1234" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Area Code</label>
              <input value={addForm.areaCode} onChange={e => setAddForm(p => ({ ...p, areaCode: e.target.value }))}
                placeholder="08" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Notes (internal)</label>
            <input value={addForm.notes} onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="e.g. Perth metro, 08 prefix" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowAddForm(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-slate-100">Cancel</button>
            <button type="submit" disabled={actionLoading === 'add'} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {actionLoading === 'add' ? 'Adding…' : 'Add to Pool'}
            </button>
          </div>
        </form>
      )}

      {/* Numbers Table */}
      {loading ? (
        <div className="text-center text-slate-400 py-12">Loading…</div>
      ) : numbers.length === 0 ? (
        <div className="text-center text-slate-400 py-12 rounded-xl border border-dashed border-slate-700">
          <Phone className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>No numbers in the pool yet.</p>
          <p className="text-sm mt-1">Add Twilio numbers via the button above to get started.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Number</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Assigned To</th>
                <th className="px-4 py-3 text-left">Area</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {numbers.map(num => (
                <tr key={num.id} className="bg-slate-900 hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <div className="font-mono font-medium text-slate-100">{num.friendlyName || num.phoneNumber}</div>
                    {num.friendlyName && <div className="font-mono text-xs text-slate-500">{num.phoneNumber}</div>}
                    {num.notes && <div className="text-xs text-slate-500 mt-0.5">{num.notes}</div>}
                  </td>
                  <td className="px-4 py-3">{statusBadge(num.status)}</td>
                  <td className="px-4 py-3">
                    {num.instructor ? (
                      <div>
                        <div className="text-slate-100">{num.instructor.name}</div>
                        <div className="text-xs text-slate-500">
                          {num.instructor.subscriptionTier} · {num.instructor.voiceLineStatus}
                        </div>
                        {num.assignedAt && (
                          <div className="text-xs text-slate-600">{new Date(num.assignedAt).toLocaleDateString('en-AU')}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono">{num.areaCode || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {num.status === 'AVAILABLE' && (
                        <>
                          {assignForm?.numberId === num.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                placeholder="Instructor ID"
                                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 font-mono w-36"
                                value={assignForm.instructorId}
                                onChange={e => setAssignForm(f => f ? { ...f, instructorId: e.target.value } : null)}
                              />
                              <button
                                onClick={() => handleAction(num.id, 'assign', assignForm.instructorId)}
                                disabled={!assignForm.instructorId || actionLoading === num.id + 'assign'}
                                className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                              >
                                {actionLoading === num.id + 'assign' ? '…' : 'Assign'}
                              </button>
                              <button onClick={() => setAssignForm(null)} className="text-slate-500 hover:text-slate-300 text-xs">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAssignForm({ numberId: num.id, instructorId: '' })}
                              className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                            >
                              <UserCheck className="h-3 w-3" /> Assign
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(num.id)}
                            disabled={actionLoading === num.id + 'delete'}
                            className="rounded border border-red-900 px-2 py-1 text-xs text-red-400 hover:bg-red-900/20"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                      {num.status === 'ASSIGNED' && (
                        <>
                          {num.instructor?.voiceLineStatus === 'ACTIVE' ? (
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
                              className="flex items-center gap-1 rounded border border-green-700 px-2 py-1 text-xs text-green-400 hover:bg-green-900/20"
                            >
                              <CheckCircle className="h-3 w-3" /> Reactivate
                            </button>
                          )}
                          <button
                            onClick={() => handleAction(num.id, 'release')}
                            disabled={actionLoading === num.id + 'release'}
                            className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
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

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-500 space-y-1">
        <p><strong className="text-slate-400">Webhook URL to set in Twilio:</strong> <code className="bg-slate-800 px-1.5 py-0.5 rounded font-mono">https://voice.drivebook.com.au/api/voice/incoming</code></p>
        <p>All numbers must point to this webhook. Assignment is automatic on PRO upgrade via the subscription webhook.</p>
        <p>Manual assignment is for edge cases (e.g. existing PRO instructors before auto-assignment was added).</p>
      </div>
    </div>
  )
}
