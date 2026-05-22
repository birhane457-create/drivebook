'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import Link from 'next/link';
import {
  ArrowLeft, Mail, KeyRound, Wallet, User, Send, Loader2,
  CheckCircle, AlertCircle, DollarSign, MinusCircle, Edit2,
  Save, X, Calendar, Shield, RefreshCw, ExternalLink, Ban,
  Phone, Clock
} from 'lucide-react';

interface Booking {
  id: string;
  startTime: string;
  status: string;
  price: number;
  instructorName?: string;
  clientName?: string;
}

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  phone?: string | null;
  role: string;
  createdAt: string;
  emailVerified?: boolean;
  clientId?: string | null;
  recentBookings?: Booking[];
  instructor?: {
    id: string;
    name: string;
    phone?: string | null;
    approvalStatus: string;
    subscriptionTier: string;
    subscriptionStatus?: string;
    trialEndsAt?: string | null;
    abn: string | null;
    abnVerified: boolean;
    withholdingTaxRate: number;
    isActive?: boolean;
  } | null;
  wallet?: {
    balance: number;
    transactionCount: number;
  } | null;
  bookingCount?: number;
}

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      {msg}
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  NO_SHOW: 'bg-orange-100 text-orange-700',
  PENDING_PAYMENT: 'bg-gray-100 text-gray-600',
};

export default function AdminUserSupportPage() {
  const params = useParams();
  const userId = params.userId as string;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Contact form
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [contactType, setContactType] = useState<'both' | 'email' | 'notification'>('both');

  // Wallet forms
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [deductAmount, setDeductAmount] = useState('');
  const [deductReason, setDeductReason] = useState('');

  // Edit profile
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');

  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type });

  const loadUser = () => {
    setLoading(true);
    fetch(`/api/admin/users/${userId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setUser(d); setEditName(d.name || ''); setEditPhone(d.phone || ''); setEditEmail(d.email || ''); })
      .catch(() => showToast('Failed to load user', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUser(); }, [userId]);

  const sendContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('contact');
    try {
      const res = await fetch('/api/admin/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subject, message, type: contactType }),
      });
      const d = await res.json();
      if (res.ok) { showToast('Message sent', 'success'); setSubject(''); setMessage(''); }
      else showToast(d.error || 'Failed to send', 'error');
    } catch { showToast('Failed to send', 'error'); }
    finally { setBusy(null); }
  };

  const sendPasswordReset = async () => {
    if (!confirm(`Send password reset email to ${user?.email}?`)) return;
    setBusy('reset');
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' });
      const d = await res.json();
      if (res.ok) showToast(d.message || 'Reset email sent', 'success');
      else showToast(d.error || 'Failed', 'error');
    } catch { showToast('Failed', 'error'); }
    finally { setBusy(null); }
  };

  const addCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditAmount || !creditReason) return;
    const clientId = user?.clientId;
    if (!clientId) { showToast('No client wallet — only learner accounts have wallets', 'error'); return; }
    setBusy('credit');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/wallet/add-credit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(creditAmount), reason: creditReason }),
      });
      const d = await res.json();
      if (res.ok) { showToast(`$${creditAmount} credit added`, 'success'); setCreditAmount(''); setCreditReason(''); loadUser(); }
      else showToast(d.error || 'Failed', 'error');
    } catch { showToast('Failed', 'error'); }
    finally { setBusy(null); }
  };

  const deductCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deductAmount || !deductReason) return;
    const clientId = user?.clientId;
    if (!clientId) { showToast('No client wallet', 'error'); return; }
    if (!confirm(`Deduct $${deductAmount} from ${user?.name || user?.email}'s wallet?`)) return;
    setBusy('deduct');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/wallet/deduct-credit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(deductAmount), reason: deductReason }),
      });
      const d = await res.json();
      if (res.ok) { showToast(`$${deductAmount} deducted`, 'success'); setDeductAmount(''); setDeductReason(''); loadUser(); }
      else showToast(d.error || 'Failed', 'error');
    } catch { showToast('Failed', 'error'); }
    finally { setBusy(null); }
  };

  const saveProfile = async () => {
    setBusy('profile');
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, phone: editPhone, email: editEmail }),
      });
      const d = await res.json();
      if (res.ok) { showToast('Profile updated', 'success'); setEditMode(false); loadUser(); }
      else showToast(d.error || 'Failed to update', 'error');
    } catch { showToast('Failed', 'error'); }
    finally { setBusy(null); }
  };

  const approveInstructor = async () => {
    if (!user?.instructor) return;
    if (!confirm(`Approve ${user.instructor.name}?`)) return;
    setBusy('approve');
    try {
      const res = await fetch(`/api/admin/instructors/${user.instructor.id}/approve`, { method: 'POST' });
      const d = await res.json();
      if (res.ok) { showToast('Instructor approved', 'success'); loadUser(); }
      else showToast(d.error || 'Failed', 'error');
    } catch { showToast('Failed', 'error'); }
    finally { setBusy(null); }
  };

  const suspendInstructor = async () => {
    if (!user?.instructor) return;
    const reason = prompt('Reason for suspension (required):');
    if (!reason || reason.length < 5) { showToast('Reason too short', 'error'); return; }
    setBusy('suspend');
    try {
      const res = await fetch(`/api/admin/instructors/${user.instructor.id}/suspend`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const d = await res.json();
      if (res.ok) { showToast('Instructor suspended', 'success'); loadUser(); }
      else showToast(d.error || 'Failed', 'error');
    } catch { showToast('Failed', 'error'); }
    finally { setBusy(null); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><AdminNav />
      <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-gray-50"><AdminNav />
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-gray-600">User not found.</p>
        <Link href="/admin/support" className="text-blue-600 hover:underline text-sm mt-4 inline-block">← Back to Support</Link>
      </div>
    </div>
  );

  const isInstructor = user.role === 'INSTRUCTOR';
  const isClient = user.role === 'CLIENT';
  const approvalStatus = user.instructor?.approvalStatus;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin/support" className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">Support: {user.name || user.email}</h1>
            <p className="text-sm text-gray-500">{user.role} · {user.email} · ID: {user.id.slice(-8)}</p>
          </div>
          <button onClick={loadUser} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">

          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-1 space-y-4">

            {/* Account Info + Edit */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-500" /> Account Info
                </h2>
                {!editMode ? (
                  <button onClick={() => setEditMode(true)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button onClick={() => setEditMode(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {editMode ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                    <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <button onClick={saveProfile} disabled={busy === 'profile'}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60">
                    {busy === 'profile' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                  </button>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Role</span><span className="font-medium">{user.role}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium">{user.name || '—'}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-gray-500 shrink-0">Email</span><span className="font-medium text-right truncate">{user.email}</span></div>
                  {user.phone && <div className="flex justify-between"><span className="text-gray-500">Phone</span><span className="font-medium">{user.phone}</span></div>}
                  <div className="flex justify-between"><span className="text-gray-500">Joined</span><span className="font-medium">{new Date(user.createdAt).toLocaleDateString('en-AU')}</span></div>
                  {user.bookingCount !== undefined && (
                    <div className="flex justify-between"><span className="text-gray-500">Bookings</span><span className="font-medium">{user.bookingCount}</span></div>
                  )}
                  {user.wallet && (
                    <div className="flex justify-between"><span className="text-gray-500">Wallet</span>
                      <span className={`font-semibold ${user.wallet.balance > 0 ? 'text-green-600' : user.wallet.balance < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        ${user.wallet.balance.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {user.instructor && (
                    <>
                      <hr className="border-gray-100" />
                      <div className="flex justify-between"><span className="text-gray-500">Approval</span>
                        <span className={`font-semibold text-xs px-2 py-0.5 rounded-full ${approvalStatus === 'APPROVED' ? 'bg-green-100 text-green-700' : approvalStatus === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {approvalStatus}
                        </span>
                      </div>
                      <div className="flex justify-between"><span className="text-gray-500">Tier</span><span className="font-medium">{user.instructor.subscriptionTier}</span></div>
                      {user.instructor.subscriptionStatus && (
                        <div className="flex justify-between"><span className="text-gray-500">Sub Status</span><span className="font-medium">{user.instructor.subscriptionStatus}</span></div>
                      )}
                      <div className="flex justify-between"><span className="text-gray-500">ABN</span>
                        <span className={`font-medium text-xs ${user.instructor.abnVerified ? 'text-green-600' : 'text-red-500'}`}>
                          {user.instructor.abn || 'Not set'} {user.instructor.abnVerified ? '✓' : '✗'}
                        </span>
                      </div>
                      <div className="flex justify-between"><span className="text-gray-500">Withholding</span><span className="font-medium">{user.instructor.withholdingTaxRate}%</span></div>
                    </>
                  )}
                </div>
              )}

              {/* Quick nav links */}
              <div className="mt-4 flex flex-wrap gap-2">
                {isInstructor && user.instructor && (
                  <>
                    <Link href={`/admin/instructors/${user.instructor.id}`}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100">
                      <ExternalLink className="w-3 h-3" /> Profile
                    </Link>
                    <Link href={`/admin/documents/review/${user.instructor.id}`}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-purple-50 text-purple-700 rounded-lg border border-purple-200 hover:bg-purple-100">
                      <ExternalLink className="w-3 h-3" /> Documents
                    </Link>
                  </>
                )}
                {isClient && user.clientId && (
                  <Link href={`/admin/clients/${user.clientId}`}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100">
                    <ExternalLink className="w-3 h-3" /> Client Detail
                  </Link>
                )}
              </div>
            </div>

            {/* Instructor Controls */}
            {isInstructor && user.instructor && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-500" /> Instructor Controls
                </h2>
                <div className="space-y-2">
                  {approvalStatus !== 'APPROVED' && (
                    <button onClick={approveInstructor} disabled={!!busy}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-60">
                      {busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approve Instructor
                    </button>
                  )}
                  {approvalStatus === 'APPROVED' && (
                    <button onClick={suspendInstructor} disabled={!!busy}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 hover:bg-red-100 disabled:opacity-60">
                      {busy === 'suspend' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                      Suspend Instructor
                    </button>
                  )}
                  {(approvalStatus === 'SUSPENDED' || approvalStatus === 'REJECTED') && (
                    <button onClick={approveInstructor} disabled={!!busy}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 text-sm rounded-lg border border-blue-200 hover:bg-blue-100 disabled:opacity-60">
                      {busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Reinstate Instructor
                    </button>
                  )}
                  {user.instructor.trialEndsAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      Trial ends: {new Date(user.instructor.trialEndsAt).toLocaleDateString('en-AU')}
                    </p>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Account Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-orange-500" /> Account Actions
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">

                {/* Password reset */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-orange-900 mb-1">Password Reset</p>
                  <p className="text-xs text-orange-700 mb-3">Sends a reset link to {user.email}. Expires in 24h.</p>
                  <button onClick={sendPasswordReset} disabled={busy === 'reset'}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 disabled:opacity-60">
                    {busy === 'reset' ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    Send Reset Email
                  </button>
                </div>

                {/* Wallet credit — clients only */}
                {isClient && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-green-900 mb-1">Add Wallet Credit</p>
                    <form onSubmit={addCredit} className="space-y-2">
                      <input type="number" min="0.01" step="0.01" placeholder="Amount $"
                        value={creditAmount} onChange={e => setCreditAmount(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                      <input type="text" placeholder="Reason (e.g. Goodwill credit)"
                        value={creditReason} onChange={e => setCreditReason(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                      <button type="submit" disabled={busy === 'credit' || !creditAmount || !creditReason}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-60">
                        {busy === 'credit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                        Add Credit
                      </button>
                    </form>
                  </div>
                )}

                {/* Wallet deduct — clients only */}
                {isClient && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-red-900 mb-1">Deduct Wallet Credit</p>
                    <p className="text-xs text-red-700 mb-2">
                      Balance: <strong>${user.wallet?.balance?.toFixed(2) ?? '0.00'}</strong>
                    </p>
                    <form onSubmit={deductCredit} className="space-y-2">
                      <input type="number" min="0.01" step="0.01" placeholder="Amount $"
                        value={deductAmount} onChange={e => setDeductAmount(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" />
                      <input type="text" placeholder="Reason (e.g. Correction)"
                        value={deductReason} onChange={e => setDeductReason(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" />
                      <button type="submit" disabled={busy === 'deduct' || !deductAmount || !deductReason}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-60">
                        {busy === 'deduct' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MinusCircle className="w-4 h-4" />}
                        Deduct Credit
                      </button>
                    </form>
                  </div>
                )}

              </div>
            </div>

            {/* Recent Bookings */}
            {user.recentBookings && user.recentBookings.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" /> Recent Bookings
                </h2>
                <div className="space-y-2">
                  {user.recentBookings.map(b => (
                    <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {isInstructor ? (b.clientName || 'Client') : (b.instructorName || 'Instructor')}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(b.startTime).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[b.status] || 'bg-gray-100 text-gray-600'}`}>
                          {b.status}
                        </span>
                        <span className="text-sm font-semibold text-gray-700">${b.price.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <Link href="/admin/bookings" className="text-xs text-blue-600 hover:underline mt-2 inline-block">
                  View all bookings →
                </Link>
              </div>
            )}

            {/* Send Message */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-500" /> Send Message
              </h2>
              <form onSubmit={sendContact} className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                    <input required value={subject} onChange={e => setSubject(e.target.value)}
                      placeholder="e.g. Your booking has been updated"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Send via</label>
                    <select value={contactType} onChange={e => setContactType(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="both">Email + Notification</option>
                      <option value="email">Email only</option>
                      <option value="notification">In-app only</option>
                    </select>
                  </div>
                </div>
                <textarea required rows={4} value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Write your message..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                <button type="submit" disabled={busy === 'contact'}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60">
                  {busy === 'contact' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Message
                </button>
              </form>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
