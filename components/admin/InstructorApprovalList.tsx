'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle, XCircle, AlertTriangle, MoreVertical,
  Phone, Mail, MapPin, Star, Calendar, Users, ChevronDown, ChevronUp, X
} from 'lucide-react';

interface Instructor {
  id: string;
  name: string;
  phone: string;
  bio: string | null;
  profileImage: string | null;
  approvalStatus: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  licenseNumber: string | null;
  licenseExpiry: Date | null;
  insuranceNumber: string | null;
  insuranceExpiry: Date | null;
  documentsVerified: boolean;
  hourlyRate: number;
  serviceAreas: string | null;
  baseAddress: string | null;
  averageRating: number | null;
  isActive: boolean;
  createdAt?: Date | null;
  user: { email: string; createdAt?: Date | null; termsAcceptedAt?: Date | null } | null;
  _count: { bookings: number; reviews?: number };
}

interface ComplianceStatus {
  instructorId: string;
  status: 'valid' | 'expiring' | 'expired';
  issues: string[];
  licenseExpiry: Date | null;
  insuranceExpiry: Date | null;
  policeCheckExpiry: Date | null;
  wwcCheckExpiry: Date | null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    APPROVED: 'bg-green-900/40 text-green-300',
    PENDING: 'bg-yellow-900/40 text-yellow-300',
    REJECTED: 'bg-red-900/40 text-red-300',
    SUSPENDED: 'bg-orange-100 text-orange-800',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${map[status] || 'bg-slate-900 text-slate-300'}`}>
      {status}
    </span>
  );
}

function ComplianceDot({ status }: { status?: string }) {
  if (!status) return <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />;
  if (status === 'valid') return <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />;
  if (status === 'expiring') return <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />;
  return <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />;
}

function ReasonModal({ title, onConfirm, onClose }: {
  title: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Enter reason (min 10 characters)..."
          rows={3}
          className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <div className="flex gap-2 mt-4">
          <button onClick={() => reason.length >= 10 && onConfirm(reason)}
            disabled={reason.length < 10}
            className="flex-1 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-40">
            Confirm
          </button>
          <button onClick={onClose} className="flex-1 py-2 border border-slate-700 text-sm rounded-lg hover:bg-slate-950">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InstructorApprovalList({ instructors }: { instructors: Instructor[] }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [compliance, setCompliance] = useState<Map<string, ComplianceStatus>>(new Map());
  const [loading, setLoading] = useState<string | null>(null);
  const [modal, setModal] = useState<{ type: 'reject' | 'suspend'; id: string } | null>(null);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    fetch('/api/admin/documents/compliance').then(r => r.ok ? r.json() : []).then((data: ComplianceStatus[]) => {
      const map = new Map<string, ComplianceStatus>();
      data.forEach(d => map.set(d.instructorId, d));
      setCompliance(map);
    }).catch(() => {});
  }, []);

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 3000); };

  const doApprove = async (id: string) => {
    setLoading(id);
    const res = await fetch(`/api/admin/instructors/${id}/approve`, { method: 'POST' });
    setLoading(null);
    if (res.ok) { showFlash('Instructor approved'); setTimeout(() => window.location.reload(), 800); }
    else { const d = await res.json(); showFlash(d.error || 'Failed'); }
  };

  const doReject = async (id: string, reason: string) => {
    setModal(null); setLoading(id);
    const res = await fetch(`/api/admin/instructors/${id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    setLoading(null);
    if (res.ok) { showFlash('Instructor rejected'); setTimeout(() => window.location.reload(), 800); }
    else { const d = await res.json(); showFlash(d.error || 'Failed'); }
  };

  const doSuspend = async (id: string, reason: string) => {
    setModal(null); setLoading(id);
    const res = await fetch(`/api/admin/instructors/${id}/suspend`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    setLoading(null);
    if (res.ok) { showFlash('Instructor suspended'); setTimeout(() => window.location.reload(), 800); }
    else { const d = await res.json(); showFlash(d.error || 'Failed'); }
  };

  const doReactivate = async (id: string) => {
    setLoading(id);
    const res = await fetch(`/api/admin/instructors/${id}/approve`, { method: 'POST' });
    setLoading(null);
    if (res.ok) { showFlash('Instructor reactivated'); setTimeout(() => window.location.reload(), 800); }
  };

  const filtered = instructors.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return i.name.toLowerCase().includes(q) ||
      (i.user?.email || '').toLowerCase().includes(q) ||
      (i.phone || '').includes(q) ||
      (i.serviceAreas || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-3">
      {/* Flash */}
      {flash && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
          {flash}
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'reject' && (
        <ReasonModal title="Reason for Rejection" onConfirm={r => doReject(modal.id, r)} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'suspend' && (
        <ReasonModal title="Reason for Suspension" onConfirm={r => doSuspend(modal.id, r)} onClose={() => setModal(null)} />
      )}

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, email, suburb..."
        className="w-full px-4 py-2.5 border border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500 text-sm">No instructors found</div>
      )}

      {filtered.map(instructor => {
        const comp = compliance.get(instructor.id);
        const isExpanded = expanded.has(instructor.id);
        const email = instructor.user?.email || null;
        const joinedDate = instructor.user?.createdAt || instructor.createdAt;
        const joined = joinedDate
          ? new Date(joinedDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
          : '—';
        const termsAccepted = instructor.user?.termsAcceptedAt
          ? new Date(instructor.user.termsAcceptedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
          : null;
        const rating = instructor.averageRating ? instructor.averageRating.toFixed(1) : null;

        return (
          <div key={instructor.id} className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
            {/* Main row */}
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Avatar */}
              <div className="shrink-0">
                {instructor.profileImage
                  ? <img src={instructor.profileImage} alt={instructor.name} className="w-10 h-10 rounded-full object-cover" />
                  : <div className="w-10 h-10 rounded-full bg-blue-900/40 flex items-center justify-center text-blue-700 font-bold text-sm">
                      {instructor.name.charAt(0)}
                    </div>
                }
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-100 text-sm">{instructor.name}</span>
                  <StatusBadge status={instructor.approvalStatus} />
                  {instructor.subscriptionTier && instructor.subscriptionTier !== 'BASIC' && (
                    <span className={`px-1.5 py-0.5 text-xs font-bold rounded ${
                      instructor.subscriptionTier === 'BUSINESS' ? 'bg-violet-900/40 text-violet-300' :
                      instructor.subscriptionTier === 'STUDIO' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-blue-900/40 text-blue-300'
                    }`}>{instructor.subscriptionTier}</span>
                  )}
                  <ComplianceDot status={comp?.status} />
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                  {email
                    ? <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{email}</span>
                    : <span className="text-orange-400">No email linked</span>
                  }
                  {instructor.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{instructor.phone}</span>}
                  {instructor.serviceAreas && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{instructor.serviceAreas.split(',')[0].trim()}</span>}
                </div>
              </div>

              {/* Stats chips */}
              <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400 shrink-0">
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{instructor._count.bookings}</span>
                {rating && <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-400" />{rating}</span>}
                <span className="font-semibold text-slate-300">${instructor.hourlyRate}/hr</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0 flex-wrap">
                {instructor.approvalStatus === 'PENDING' && (
                  <>
                    <button onClick={() => doApprove(instructor.id)} disabled={loading === instructor.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-40">
                      <CheckCircle className="w-3.5 h-3.5" />Approve
                    </button>
                    <button onClick={() => setModal({ type: 'reject', id: instructor.id })}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-red-900/20 text-red-600 text-xs rounded-lg hover:bg-red-900/40 border border-red-700/50">
                      <XCircle className="w-3.5 h-3.5" />Reject
                    </button>
                  </>
                )}
                {instructor.approvalStatus === 'APPROVED' && (
                  <button onClick={() => setModal({ type: 'suspend', id: instructor.id })}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 text-orange-600 text-xs rounded-lg hover:bg-orange-100 border border-orange-200">
                    <AlertTriangle className="w-3.5 h-3.5" />Suspend
                  </button>
                )}
                {(instructor.approvalStatus === 'SUSPENDED' || instructor.approvalStatus === 'REJECTED') && (
                  <button onClick={() => doReactivate(instructor.id)} disabled={loading === instructor.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-900/20 text-blue-600 text-xs rounded-lg hover:bg-blue-900/40 border border-blue-700/50">
                    <CheckCircle className="w-3.5 h-3.5" />Reactivate
                  </button>
                )}
                <Link href={`/admin/instructors/${instructor.id}`}
                  className="px-2.5 py-1.5 text-xs text-blue-600 hover:bg-blue-900/20 rounded-lg border border-blue-700/50">
                  Profile
                </Link>
                <Link href={`/admin/documents/review/${instructor.id}`}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-purple-600 hover:bg-violet-900/20 rounded-lg border border-purple-200">
                  Docs
                </Link>
                <button onClick={() => setExpanded(prev => {
                  const s = new Set(prev);
                  s.has(instructor.id) ? s.delete(instructor.id) : s.add(instructor.id);
                  return s;
                })} className="p-1.5 hover:bg-slate-900 rounded-lg">
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-slate-800 px-4 py-3 bg-slate-950 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-slate-500 uppercase tracking-wide mb-1">Contact</p>
                  <p className="text-slate-300">{email || <span className="text-orange-400">No email</span>}</p>
                  <p className="text-slate-300">{instructor.phone || '—'}</p>
                  <p className="text-slate-400">Joined {joined}</p>
                  <p className="text-slate-400">
                    Terms: {termsAccepted
                      ? <span className="text-green-600">{termsAccepted}</span>
                      : <span className="text-amber-500">Not recorded</span>
                    }
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase tracking-wide mb-1">Documents</p>
                  <p className="text-slate-300">License: {instructor.licenseNumber || 'Not provided'}</p>
                  <p className="text-slate-300">Insurance: {instructor.insuranceNumber || 'Not provided'}</p>
                  <p className={instructor.documentsVerified ? 'text-green-600' : 'text-orange-500'}>
                    {instructor.documentsVerified ? '✓ Verified' : 'Not verified'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase tracking-wide mb-1">Compliance</p>
                  {comp ? (
                    <>
                      <p>License: {comp.licenseExpiry ? new Date(comp.licenseExpiry).toLocaleDateString('en-AU') : '—'}</p>
                      <p>Insurance: {comp.insuranceExpiry ? new Date(comp.insuranceExpiry).toLocaleDateString('en-AU') : '—'}</p>
                      <p>Police: {comp.policeCheckExpiry ? new Date(comp.policeCheckExpiry).toLocaleDateString('en-AU') : '—'}</p>
                      <p>WWC: {comp.wwcCheckExpiry ? new Date(comp.wwcCheckExpiry).toLocaleDateString('en-AU') : '—'}</p>
                    </>
                  ) : <p className="text-slate-500">No data</p>}
                </div>
                <div>
                  <p className="text-slate-500 uppercase tracking-wide mb-1">Stats</p>
                  <p>{instructor._count.bookings} bookings</p>
                  <p>{instructor._count.reviews} reviews</p>
                  {rating && <p>⭐ {rating} avg</p>}
                  <p>${instructor.hourlyRate}/hr</p>
                  {instructor.serviceAreas && <p className="text-slate-400 truncate">{instructor.serviceAreas}</p>}
                </div>
                {comp && comp.issues.length > 0 && (
                  <div className="col-span-2 sm:col-span-4">
                    <p className="text-red-600 font-medium mb-1">Compliance Issues</p>
                    <ul className="list-disc list-inside text-red-500 space-y-0.5">
                      {comp.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                    </ul>
                  </div>
                )}
                {instructor.bio && (
                  <div className="col-span-2 sm:col-span-4">
                    <p className="text-slate-500 uppercase tracking-wide mb-1">Bio</p>
                    <p className="text-slate-400 line-clamp-3">{instructor.bio}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
