'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/admin/AdminNav'
import {
  UserPlus, Shield, ShieldOff, ChevronDown, ChevronUp,
  CheckCircle, Eye, EyeOff, RefreshCw, X, RotateCcw,
} from 'lucide-react'
import { ALL_PERMISSIONS } from '@/lib/rbac/permissions'
import { ROLE_PRESETS } from '@/lib/rbac/role-presets'

interface StaffUser {
  id: string
  email: string
  name: string | null
  role: 'ADMIN' | 'SUPER_ADMIN'
  createdAt: string
  staffMember: {
    id: string
    name: string
    department: string
    isActive: boolean
    permissions: string[]
    maxRefundAmount: number
  } | null
}

const PERM_GROUPS: Record<string, string[]> = {
  'Users — Instructors': ALL_PERMISSIONS.filter((p: string) => p.startsWith('users.instructors')),
  'Users  Clients': ALL_PERMISSIONS.filter((p: string) => p.startsWith('users.clients')),
  'Users  Subscriptions': ALL_PERMISSIONS.filter((p: string) => p.startsWith('users.subscriptions')),
  'Finance  Payouts': ALL_PERMISSIONS.filter((p: string) => p.startsWith('finance.payouts') || p.startsWith('finance.revenue')),
  'Finance — Credits & Disputes': ALL_PERMISSIONS.filter((p: string) => p.startsWith('finance.credits') || p.startsWith('finance.disputes') || p.startsWith('finance.pricing')),
  'Operations': ALL_PERMISSIONS.filter((p: string) => p.startsWith('operations')),
  'Engagement': ALL_PERMISSIONS.filter((p: string) => p.startsWith('engagement')),
  'Platform': ALL_PERMISSIONS.filter((p: string) => p.startsWith('platform')),
}

const DEPT_COLORS: Record<string, string> = {
  ADMIN:       'bg-blue-900/40 text-blue-300',
  FINANCE:     'bg-green-900/40 text-green-300',
  OPERATIONS:  'bg-amber-900/40 text-amber-300',
  SUPPORT:     'bg-violet-900/40 text-violet-300',
  SUPER_ADMIN: 'bg-red-900/40 text-red-300',
}

function permLabel(p: string) {
  return p.split('.').pop()!.replace(/_/g, ' ')
}

function isHighRisk(p: string) {
  return ['manage','process','delete','override','hold','resolve'].some(k => p.endsWith(k))
}

//  Permission editor 

function PermissionEditor({ user, onClose, onSaved }: {
  user: StaffUser; onClose: () => void; onSaved: () => void
}) {
  const sm = user.staffMember!
  const [perms, setPerms] = useState<Set<string>>(new Set(sm.permissions))
  const [maxRefund, setMaxRefund] = useState(sm.maxRefundAmount)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set(Object.keys(PERM_GROUPS)))

  const toggle = (p: string) => {
    const n = new Set(perms); n.has(p) ? n.delete(p) : n.add(p); setPerms(n)
  }
  const toggleGroup = (group: string, gp: string[]) => {
    const allOn = gp.every(p => perms.has(p))
    const n = new Set(perms); allOn ? gp.forEach(p => n.delete(p)) : gp.forEach(p => n.add(p)); setPerms(n)
  }

  const save = async () => {
    setSaving(true); setError('')
    const r = await fetch(`/api/admin/staff/${sm.id}/permissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: Array.from(perms), maxRefundAmount: maxRefund }),
    })
    setSaving(false)
    if (r.ok) { onSaved(); onClose() }
    else { const d = await r.json(); setError(d.error || 'Failed') }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <p className="font-bold text-slate-100">Edit Permissions</p>
            <p className="text-xs text-slate-400">{user.email}  {sm.department}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-4">
          <label className="text-xs font-medium text-slate-400">Max credit/deduct per action ($)</label>
          <input type="number" min={0} max={10000} value={maxRefund}
            onChange={e => setMaxRefund(Number(e.target.value))}
            className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100" />
          <span className="text-xs text-slate-500">{perms.size} / {ALL_PERMISSIONS.length} permissions</span>
        </div>

        <div className="px-6 py-4 space-y-2 max-h-[55vh] overflow-y-auto">
          {Object.entries(PERM_GROUPS).map(([group, gp]) => {
            const allOn = gp.every(p => perms.has(p))
            const someOn = gp.some(p => perms.has(p))
            const isOpen = open.has(group)
            return (
              <div key={group} className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={allOn}
                      ref={el => { if (el) el.indeterminate = someOn && !allOn }}
                      onChange={() => toggleGroup(group, gp)}
                      className="w-3.5 h-3.5 accent-blue-500" />
                    <span className="text-sm font-medium text-slate-200">{group}</span>
                    <span className="text-xs text-slate-500">{gp.filter(p => perms.has(p)).length}/{gp.length}</span>
                  </div>
                  <button onClick={() => setOpen(s => { const n = new Set(s); n.has(group) ? n.delete(group) : n.add(group); return n })}>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>
                </div>
                {isOpen && (
                  <div className="px-4 py-2 grid grid-cols-2 gap-1">
                    {gp.map(p => (
                      <label key={p} className="flex items-center gap-2 py-1 cursor-pointer">
                        <input type="checkbox" checked={perms.has(p)} onChange={() => toggle(p)} className="w-3.5 h-3.5 accent-blue-500" />
                        <span className={`text-xs capitalize ${perms.has(p) ? 'text-slate-200' : 'text-slate-500'}`}>{permLabel(p)}</span>
                        {isHighRisk(p) && <span className="text-xs text-amber-500 font-bold">!</span>}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-2">
          {error && <p className="text-xs text-red-400 mr-auto">{error}</p>}
          <button type="button" onClick={() => setPerms(new Set(ROLE_PRESETS[sm.department] ?? []))} className="px-3 py-2 border border-slate-700 text-xs rounded-lg text-slate-400 hover:bg-slate-800 flex items-center gap-1.5" title="Reset to role preset"><RotateCcw className="w-3 h-3" />Reset preset</button>
          <button onClick={onClose} className="px-4 py-2 border border-slate-700 text-sm rounded-lg text-slate-300 hover:bg-slate-800">Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-semibold disabled:opacity-50 flex items-center gap-1.5">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

//  Create form 

function CreateAdminForm({ onCreated }: { onCreated: () => void }) {
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ email: '', name: '', password: '', department: 'ADMIN' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    const r = await fetch('/api/admin/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await r.json(); setLoading(false)
    if (r.ok) { setShow(false); setForm({ email: '', name: '', password: '', department: 'ADMIN' }); onCreated() }
    else setError(Array.isArray(d.error) ? d.error[0]?.message : d.error || 'Failed')
  }

  if (!show) return (
    <button onClick={() => setShow(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl">
      <UserPlus className="w-4 h-4" /> Add Admin
    </button>
  )

  return (
    <form onSubmit={submit} className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-100">New Admin Account</p>
        <button type="button" onClick={() => setShow(false)}><X className="w-4 h-4 text-slate-500" /></button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Full name</label>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Sarah Mitchell" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
          <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="sarah@drivebook.com.au" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Temp password</label>
          <div className="relative">
            <input required type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Min 8 chars" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pr-9 text-sm text-slate-100 placeholder-slate-500" />
            <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500">
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Role preset</label>
          <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100">
            <option value="ADMIN">ADMIN  General access</option>
            <option value="FINANCE">FINANCE  Finance & payouts</option>
            <option value="OPERATIONS">OPERATIONS  Operations & compliance</option>
            <option value="SUPPORT">SUPPORT  Customer support</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => setShow(false)} className="px-4 py-2 border border-slate-700 text-sm rounded-lg text-slate-300 hover:bg-slate-800">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-semibold disabled:opacity-50 flex items-center gap-1.5">
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />} Create
        </button>
      </div>
    </form>
  )
}

//  Main page 

export default function AdminUserManagementPage() {
  const router = useRouter()
  const [users, setUsers] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null)
  const [toast, setToast] = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/admin/staff')
    if (r.status === 403) { router.push('/admin'); return }
    if (r.ok) { const d = await r.json(); setUsers(d.users); setIsSuperAdmin(true) }
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  const toggleStatus = async (sm: NonNullable<StaffUser['staffMember']>, email: string) => {
    const r = await fetch(`/api/admin/staff/${sm.id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !sm.isActive }),
    })
    if (r.ok) { showToast(`${email} ${!sm.isActive ? 'activated' : 'deactivated'}`); load() }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-700 text-slate-100 text-sm px-4 py-2.5 rounded-xl shadow-2xl">{toast}</div>
      )}
      {editingUser && (
        <PermissionEditor user={editingUser} onClose={() => setEditingUser(null)}
          onSaved={() => { showToast('Permissions saved'); load() }} />
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Admin Users</h1>
            <p className="text-sm text-slate-400 mt-1">Create admins, assign role presets, and customise individual permissions. SUPER_ADMIN only.</p>
          </div>
          {isSuperAdmin && <CreateAdminForm onCreated={() => { load(); showToast('Admin account created') }} />}
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading...</div>
        ) : (
          <div className="space-y-3">
            {users.map(user => {
              const sm = user.staffMember
              const isSA = user.role === 'SUPER_ADMIN'
              const dept = sm?.department ?? (isSA ? 'SUPER_ADMIN' : '?')
              return (
                <div key={user.id} className={`bg-slate-900 rounded-2xl border ${!sm?.isActive ? 'border-slate-800 opacity-60' : 'border-slate-800'} p-5`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-100 text-sm">{sm?.name || user.name || user.email}</span>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${DEPT_COLORS[dept] || 'bg-slate-800 text-slate-400'}`}>{dept}</span>
                        {sm?.isActive === false && <span className="px-2 py-0.5 text-xs rounded-full bg-red-900/30 text-red-400">Inactive</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {isSA ? (
                        <span className="text-xs text-slate-500 italic">Unrestricted</span>
                      ) : sm ? (
                        <>
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-slate-100">{sm.permissions.length}</p>
                            <p className="text-xs text-slate-500">perms</p>
                          </div>
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-slate-100">${sm.maxRefundAmount}</p>
                            <p className="text-xs text-slate-500">limit</p>
                          </div>
                          <button onClick={() => setEditingUser(user)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg">
                            Permissions
                          </button>
                          <button onClick={() => toggleStatus(sm, user.email)} title={sm.isActive ? 'Deactivate' : 'Activate'}
                            className={`p-1.5 rounded-lg border ${sm.isActive ? 'border-red-800/50 text-red-400 hover:bg-red-900/20' : 'border-green-800/50 text-green-400 hover:bg-green-900/20'}`}>
                            {sm.isActive ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                          </button>
                        </>
                      ) : <span className="text-xs text-amber-400">No StaffMember</span>}
                    </div>
                  </div>
                  {sm && !isSA && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {['users','finance','operations','engagement','platform'].map(d => {
                        const c = sm.permissions.filter(p => p.startsWith(d)).length
                        return c > 0 ? <span key={d} className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded-full">{d} ({c})</span> : null
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-500 space-y-1.5">
          <p><strong className="text-slate-400">!</strong> marks high-risk permissions (financial or destructive)</p>
          <p><strong className="text-slate-400">Credit limit</strong> caps per-transaction credit/deduct even with finance.credits.manage granted</p>
          <p><strong className="text-slate-400">SUPER_ADMIN</strong> bypasses all checks and cannot be modified from this page</p>
          <p><strong className="text-slate-400">Deactivating</strong> blocks admin API access without deleting the account</p>
        </div>
      </div>
    </div>
  )
}