'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import Link from 'next/link';
import {
  ArrowLeft, Mail, KeyRound, Wallet, Calendar, User,
  Send, Loader2, CheckCircle, AlertCircle, RefreshCw,
  DollarSign, Phone, Shield
} from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  instructor?: {
    id: string;
    name: string;
    approvalStatus: string;
    subscriptionTier: string;
    abn: string | null;
    abnVerified: boolean;
    withholdingTaxRate: number;
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
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {msg}
    </div>
  );
}

export default function AdminUserSupportPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Contact form
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [contactType, setContactType] = useState<'both' | 'email' | 'notification'>('both');

  // Wallet credit form
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type });

  useEffect(() => {
    fetch(`/api/admin/users/${userId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setUser)
      .catch(() => showToast('Failed to load user', 'error'))
      .finally(() => setLoading(false));
  }, [userId]);

  const sendContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('contact');
    try {
      const res = await fetch('/api/admin/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subject, message, type: contactType }),
      });
      const d = await res.json();
      if (res.ok) { showToast('Message sent successfully', 'success'); setSubject(''); setMessage(''); }
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
    setBusy('credit');
    try {
      const res = await fetch(`/api/admin/clients/${userId}/wallet/add-credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(creditAmount), reason: creditReason }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast(`$${creditAmount} credit added`, 'success');
        setCreditAmount(''); setCreditReason('');
        // Refresh user data
        fetch(`/api/admin/users/${userId}`).then(r => r.ok ? r.json() : null).then(d => d && setUser(d));
      } else showToast(d.error || 'Failed', 'error');
    } catch { showToast('Failed', 'error'); }
    finally { setBusy(null); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-gray-600">User not found.</p>
        <Link href="/admin/support" className="text-blue-600 hover:underline text-sm mt-4 inline-block">← Back to Support</Link>
      </div>
    </div>
  );

  const isInstructor = user.role === 'INSTRUCTOR';
  const isClient = user.role === 'CLIENT';

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin/support" className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Support: {user.name || user.email}</h1>
            <p className="text-sm text-gray-500">{user.role} · {user.email} · ID: {user.id.slice(-8)}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">

          {/* User info card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" /> Account Info
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Role</span><span className="font-medium">{user.role}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="font-medium">{user.email}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Joined</span><span className="font-medium">{new Date(user.createdAt).toLocaleDateString('en-AU')}</span></div>
              {user.bookingCount !== undefined && (
                <div className="flex justify-between"><span className="text-gray-500">Bookings</span><span className="font-medium">{user.bookingCount}</span></div>
              )}
              {user.wallet && (
                <div className="flex justify-between"><span className="text-gray-500">Wallet Balance</span><span className="font-semibold text-green-600">${user.wallet.balance.toFixed(2)}</span></div>
              )}
              {user.instructor && (
                <>
                  <div className="flex justify-between"><span className="text-gray-500">Approval</span><span className={`font-medium ${user.instructor.approvalStatus === 'APPROVED' ? 'text-green-600' : 'text-amber-600'}`}>{user.instructor.approvalStatus}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Tier</span><span className="font-medium">{user.instructor.subscriptionTier}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">ABN</span><span className={`font-medium ${user.instructor.abnVerified ? 'text-green-600' : 'text-red-500'}`}>{user.instructor.abn || 'Not set'} {user.instructor.abnVerified ? '✓' : '✗'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Withholding</span><span className="font-medium">{user.instructor.withholdingTaxRate}%</span></div>
                </>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {isInstructor && user.instructor && (
                <>
                  <Link href={`/admin/instructors/${user.instructor.id}`}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100">
                    View Instructor Profile
                  </Link>
                  <Link href={`/admin/documents/review/${user.instructor.id}`}
                    className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg border border-purple-200 hover:bg-purple-100">
                    Review Documents
                  </Link>
                </>
              )}
              {isClient && (
                <Link href={`/admin/clients/${userId}`}
                  className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100">
                  View Client Detail
                </Link>
              )}
            </div>
          </div>

          {/* Password reset */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-orange-500" /> Account Actions
            </h2>
            <div className="space-y-3">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm font-medium text-orange-900 mb-1">Password Reset</p>
                <p className="text-xs text-orange-700 mb-3">Sends a password reset link to {user.email}. Link expires in 24 hours.</p>
                <button onClick={sendPasswordReset} disabled={busy === 'reset'}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 disabled:opacity-60">
                  {busy === 'reset' ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  Send Reset Email
                </button>
              </div>

              {isClient && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-green-900 mb-1">Add Wallet Credit</p>
                  <form onSubmit={addCredit} className="space-y-2">
                    <div className="flex gap-2">
                      <input type="number" min="1" step="0.01" placeholder="Amount $"
                        value={creditAmount} onChange={e => setCreditAmount(e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                    <input type="text" placeholder="Reason (e.g. Goodwill credit, refund)"
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
            </div>
          </div>

          {/* Contact / Message */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:col-span-2">
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
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
                <textarea required rows={4} value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Write your message to the user..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
              </div>
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
  );
}
