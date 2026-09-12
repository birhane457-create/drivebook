'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  CheckCircle, XCircle, AlertTriangle, MoreVertical,
  Phone, Mail, MapPin, Star, Calendar, ChevronDown, ChevronUp, X,
  FileText, UserCheck, Ban, RefreshCw, Send,
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
  documentsVerified: boolean;
  hourlyRate: number;
  baseAddress: string | null;
  workingHours: any;
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  serviceAreas: string | null;
  averageRating: number | null;
  isActive: boolean;
  createdAt?: Date | null;
  user: {
    email: string;
    emailVerified?: boolean;
    createdAt?: Date | null;
    termsAcceptedAt?: Date | null;
  } | null;
  drivingProfile?: {
    licenseExpiry: Date | null;
    licenseImageFront: string | null;
    licenseImageBack: string | null;
    insuranceExpiry: Date | null;
    insurancePolicyDoc: string | null;
  } | null;
  _count: { bookings: number; reviews?: number };
}

interface ComplianceStatus {
  providerId: string;
  status: 'valid' | 'expiring' | 'expired';
  issues: string[];
  licenseExpiry: Date | null;
  insuranceExpiry: Date | null;
  policeCheckExpiry: Date | null;
  wwcCheckExpiry: Date | null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    APPROVED:  'bg-green-900/40 text-emerald-400',
    PENDING:   'bg-yellow-900/40 text-yellow-300',
    REJECTED:  'bg-red-900/40 text-destructive',
    SUSPENDED: 'bg-orange-900/30 text-orange-300',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${map[status] || 'bg-secondary text-foreground'}`}>
      {status}
    </span>
  );
}

function ComplianceDot({ status }: { status?: string }) {
  if (!status) return <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" title="No compliance data" />;
  if (status === 'valid')    return <span className="w-2 h-2 rounded-full bg-green-500 inline-block" title="Compliance OK" />;
  if (status === 'expiring') return <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" title="Expiring soon" />;
  return <span className="w-2 h-2 rounded-full bg-red-500 inline-block" title="Compliance issue" />;
}

function ReasonModal({ title, onConfirm, onClose }: {
  title: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Enter reason (min 10 characters)…"
          rows={3}
          className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-slate-500 focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => reason.length >= 10 && onConfirm(reason)}
            disabled={reason.length < 10}
            className="flex-1 py-2 bg-destructive text-foreground text-sm rounded-lg hover:bg-destructive/90 disabled:opacity-40"
          >
            Confirm
          </button>
          <button onClick={onClose} className="flex-1 py-2 border border-border text-sm rounded-lg text-foreground hover:bg-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Readiness ─────────────────────────────────────────────────────────────────

function getReadiness(instructor: Instructor) {
  return [
    {
      key: 'email',
      label: 'Email verified',
      done: !!(instructor.user?.emailVerified),
    },
    {
      key: 'docs',
      label: 'Documents',
      done: !!(
        instructor.drivingProfile?.licenseImageFront || instructor.drivingProfile?.licenseImageBack ||
        instructor.drivingProfile?.insurancePolicyDoc
      ),
    },
    {
      key: 'profile',
      label: 'Profile',
      done: !!(instructor.bio?.trim() && instructor.baseAddress?.trim()),
    },
    {
      key: 'availability',
      label: 'Availability',
      done: !!(instructor.workingHours && typeof instructor.workingHours === 'object' && Object.keys(instructor.workingHours).length > 0),
    },
    {
      key: 'stripe',
      label: 'Stripe',
      done: !!(instructor.stripeAccountId && instructor.chargesEnabled),
    },
  ];
}

function ReadinessStrip({ instructor }: { instructor: Instructor }) {
  const items = getReadiness(instructor);
  const doneCount = items.filter(i => i.done).length;

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
      {items.map(item => (
        <span
          key={item.key}
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium
            ${item.done
              ? 'bg-green-900/30 text-emerald-400 border border-green-800/40'
              : 'bg-red-900/20 text-destructive border border-red-800/30'
            }`}
        >
          {item.done ? '✓' : '✗'} {item.label}
        </span>
      ))}
      {doneCount < items.length && (
        <span className="text-xs text-slate-600">{doneCount}/{items.length}</span>
      )}
    </div>
  );
}

// ── 3-dot action menu ─────────────────────────────────────────────────────────

function ActionMenu({
  provider,
  loading,
  onApprove,
  onReject,
  onSuspend,
  onReactivate,
  onNudge,
}: {
  provider: Instructor;
  loading: boolean;
  onApprove: () => void;
  onReject: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onNudge: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const status = provider.approvalStatus;

  type MenuItem =
    | { type: 'item'; label: string; icon: React.ReactNode; onClick: () => void; variant?: 'danger' | 'warning' | 'success' | 'default' }
    | { type: 'link'; label: string; icon: React.ReactNode; href: string; variant?: string }
    | { type: 'divider' };

  const items: MenuItem[] = [
    // Status actions
    ...(status === 'PENDING' ? [
      { type: 'item' as const, label: 'Approve',    icon: <CheckCircle className="w-4 h-4" />, onClick: () => { setOpen(false); onApprove(); },  variant: 'success' as const },
      { type: 'item' as const, label: 'Reject',     icon: <XCircle className="w-4 h-4" />,     onClick: () => { setOpen(false); onReject(); },   variant: 'danger' as const  },
    ] : []),
    ...(status === 'APPROVED' ? [
      { type: 'item' as const, label: 'Suspend',    icon: <Ban className="w-4 h-4" />,          onClick: () => { setOpen(false); onSuspend(); },  variant: 'warning' as const },
    ] : []),
    ...((status === 'SUSPENDED' || status === 'REJECTED') ? [
      { type: 'item' as const, label: 'Reactivate', icon: <RefreshCw className="w-4 h-4" />,   onClick: () => { setOpen(false); onReactivate(); }, variant: 'success' as const },
    ] : []),

    { type: 'divider' as const },

    // Navigation
    { type: 'link'  as const, label: 'View Profile', icon: <UserCheck className="w-4 h-4" />,  href: `/admin/instructors/${provider.id}` },
    { type: 'link'  as const, label: 'Review Docs',  icon: <FileText className="w-4 h-4" />,   href: `/admin/documents/review/${provider.id}` },

    { type: 'divider' as const },

    // Nudge
    { type: 'item' as const, label: 'Send Setup Nudge', icon: <Send className="w-4 h-4" />, onClick: () => { setOpen(false); onNudge(); } },
  ];

  const variantClass: Record<string, string> = {
    success: 'text-emerald-400 hover:bg-green-900/20',
    danger:  'text-destructive   hover:bg-red-900/20',
    warning: 'text-amber-400 hover:bg-amber-900/20',
    default: 'text-foreground hover:bg-secondary',
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className="p-1.5 rounded-lg hover:bg-secondary/70 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
        aria-label="Actions"
      >
        {loading
          ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          : <MoreVertical className="w-4 h-4" />
        }
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-30 w-48 bg-card border border-border rounded-xl shadow-2xl py-1 overflow-hidden">
          {items.map((item, i) => {
            if (item.type === 'divider') {
              return <div key={i} className="my-1 border-t border-border" />;
            }
            if (item.type === 'link') {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  <span className="text-muted-foreground/60">{item.icon}</span>
                  {item.label}
                </Link>
              );
            }
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors
                  ${variantClass[item.variant || 'default']}`}
              >
                <span className="opacity-70">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main list ─────────────────────────────────────────────────────────────────

export default function InstructorApprovalList({ providers }: { providers: Instructor[] }) {
  const [search, setSearch]       = useState('');
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [compliance, setCompliance] = useState<Map<string, ComplianceStatus>>(new Map());
  const [loading, setLoading]     = useState<string | null>(null);
  const [modal, setModal]         = useState<{ type: 'reject' | 'suspend'; id: string } | null>(null);
  const [flash, setFlash]         = useState('');

  useEffect(() => {
    fetch('/api/admin/documents/compliance')
      .then(r => r.ok ? r.json() : [])
      .then((data: ComplianceStatus[]) => {
        const map = new Map<string, ComplianceStatus>();
        data.forEach(d => map.set(d.providerId, d));
        setCompliance(map);
      })
      .catch(() => {});
  }, []);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 3000);
  };

  const doApprove = async (id: string) => {
    setLoading(id);
    const res = await fetch(`/api/admin/instructors/${id}/approve`, { method: 'POST' });
    setLoading(null);
    if (res.ok) { showFlash('Instructor approved ✓'); setTimeout(() => window.location.reload(), 800); }
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
    if (res.ok) { showFlash('Instructor reactivated ✓'); setTimeout(() => window.location.reload(), 800); }
  };

  const doNudge = async (id: string) => {
    setLoading(id);
    const res = await fetch(`/api/admin/instructors/${id}/send-setup-nudge`, { method: 'POST' });
    setLoading(null);
    if (res.ok) {
      const d = await res.json();
      showFlash(`Setup nudge sent ✓ (${d.completedCount}/${d.totalSteps} steps done)`);
    } else {
      const d = await res.json();
      showFlash(d.error || 'Failed to send nudge');
    }
  };

  const filtered = providers.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      i.name.toLowerCase().includes(q) ||
      (i.user?.email || '').toLowerCase().includes(q) ||
      (i.phone || '').includes(q) ||
      (i.serviceAreas || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-3">
      {/* Flash toast */}
      {flash && (
        <div className="fixed top-4 right-4 z-50 bg-secondary border border-border text-foreground text-sm px-4 py-2.5 rounded-xl shadow-2xl">
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
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, email, phone, suburb…"
        className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder-slate-500 focus:ring-2 focus:ring-blue-500"
      />

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground/60 text-sm">No providers found</div>
      )}

      {filtered.map(instructor => {
        const comp      = compliance.get(instructor.id);
        const isExpanded = expanded.has(instructor.id);
        const email     = instructor.user?.email || null;
        const joinedDate = instructor.user?.createdAt || instructor.createdAt;
        const joined    = joinedDate
          ? new Date(joinedDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
          : '—';
        const termsAccepted = instructor.user?.termsAcceptedAt
          ? new Date(instructor.user.termsAcceptedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
          : null;
        const rating = instructor.averageRating ? instructor.averageRating.toFixed(1) : null;

        return (
          <div key={instructor.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-visible">

            {/* ── Main row ──────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 py-3">

              {/* Avatar */}
              <div className="shrink-0">
                {instructor.profileImage
                  ? <img src={instructor.profileImage} alt={instructor.name} className="w-10 h-10 rounded-full object-cover" />
                  : <div className="w-10 h-10 rounded-full bg-blue-900/40 flex items-center justify-center text-primary font-bold text-sm">
                      {instructor.name.charAt(0)}
                    </div>
                }
              </div>

              {/* Name / meta / readiness */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground text-sm">{instructor.name}</span>
                  <StatusBadge status={instructor.approvalStatus} />
                  {instructor.subscriptionTier && instructor.subscriptionTier !== 'BASIC' && (
                    <span className={`px-1.5 py-0.5 text-xs font-bold rounded ${
                      (instructor.subscriptionTier === 'PREMIUM') ? 'bg-violet-900/40 text-violet-300' :
                      instructor.subscriptionTier === 'STUDIO'   ? 'bg-indigo-900/40 text-indigo-300' :
                      'bg-blue-900/40 text-primary'
                    }`}>{instructor.subscriptionTier}</span>
                  )}
                  <ComplianceDot status={comp?.status} />
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                  {email
                    ? <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{email}</span>
                    : <span className="text-orange-400">No email linked</span>
                  }
                  {instructor.phone && (
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{instructor.phone}</span>
                  )}
                  {instructor.serviceAreas && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{instructor.serviceAreas.split(',')[0].trim()}
                    </span>
                  )}
                </div>
                <ReadinessStrip instructor={instructor} />
              </div>

              {/* Stats chips — hidden on small screens */}
              <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />{instructor._count.bookings}
                </span>
                {rating && (
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-yellow-400" />{rating}
                  </span>
                )}
                <span className="font-semibold text-foreground">${instructor.hourlyRate}/hr</span>
              </div>

              {/* Right controls: 3-dot menu + expand chevron */}
              <div className="flex items-center gap-1 shrink-0">
                <ActionMenu
                  provider={instructor}
                  loading={loading === instructor.id}
                  onApprove={() => doApprove(instructor.id)}
                  onReject={() => setModal({ type: 'reject', id: instructor.id })}
                  onSuspend={() => setModal({ type: 'suspend', id: instructor.id })}
                  onReactivate={() => doReactivate(instructor.id)}
                  onNudge={() => doNudge(instructor.id)}
                />
                <button
                  onClick={() => setExpanded(prev => {
                    const s = new Set(prev);
                    s.has(instructor.id) ? s.delete(instructor.id) : s.add(instructor.id);
                    return s;
                  })}
                  className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground/60" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground/60" />
                  }
                </button>
              </div>
            </div>

            {/* ── Expanded detail ────────────────────────────────────────────── */}
            {isExpanded && (
              <div className="border-t border-border px-4 py-3 bg-background grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs rounded-b-2xl">
                <div>
                  <p className="text-muted-foreground/60 uppercase tracking-wide mb-1">Contact</p>
                  <p className="text-foreground">{email || <span className="text-orange-400">No email</span>}</p>
                  <p className="text-foreground">{instructor.phone || '—'}</p>
                  <p className="text-muted-foreground">Joined {joined}</p>
                  <p className="text-muted-foreground">
                    Terms:{' '}
                    {termsAccepted
                      ? <span className="text-green-500">{termsAccepted}</span>
                      : <span className="text-amber-500">Not recorded</span>
                    }
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground/60 uppercase tracking-wide mb-1">Documents</p>
                  <p className="text-foreground">
                    License: {instructor.drivingProfile?.licenseImageFront || instructor.drivingProfile?.licenseImageBack ? 'Uploaded' : 'Not provided'}
                  </p>
                  <p className="text-foreground">
                    Insurance: {instructor.drivingProfile?.insurancePolicyDoc ? 'Uploaded' : 'Not provided'}
                  </p>
                  <p className={instructor.documentsVerified ? 'text-green-500' : 'text-orange-400'}>
                    {instructor.documentsVerified ? '✓ Verified' : 'Not verified'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground/60 uppercase tracking-wide mb-1">Compliance</p>
                  {comp ? (
                    <>
                      <p>License: {comp.licenseExpiry ? new Date(comp.licenseExpiry).toLocaleDateString('en-AU') : '—'}</p>
                      <p>Insurance: {comp.insuranceExpiry ? new Date(comp.insuranceExpiry).toLocaleDateString('en-AU') : '—'}</p>
                      <p>Police: {comp.policeCheckExpiry ? new Date(comp.policeCheckExpiry).toLocaleDateString('en-AU') : '—'}</p>
                      <p>WWC: {comp.wwcCheckExpiry ? new Date(comp.wwcCheckExpiry).toLocaleDateString('en-AU') : '—'}</p>
                    </>
                  ) : <p className="text-muted-foreground/60">No data</p>}
                </div>
                <div>
                  <p className="text-muted-foreground/60 uppercase tracking-wide mb-1">Stats</p>
                  <p>{instructor._count.bookings} bookings</p>
                  {instructor._count.reviews != null && <p>{instructor._count.reviews} reviews</p>}
                  {rating && <p>⭐ {rating} avg</p>}
                  <p>${instructor.hourlyRate}/hr</p>
                  {instructor.serviceAreas && (
                    <p className="text-muted-foreground truncate">{instructor.serviceAreas}</p>
                  )}
                </div>
                {comp && comp.issues.length > 0 && (
                  <div className="col-span-2 sm:col-span-4">
                    <p className="text-destructive font-medium mb-1">Compliance Issues</p>
                    <ul className="list-disc list-inside text-red-500 space-y-0.5">
                      {comp.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                    </ul>
                  </div>
                )}
                {instructor.bio && (
                  <div className="col-span-2 sm:col-span-4">
                    <p className="text-muted-foreground/60 uppercase tracking-wide mb-1">Bio</p>
                    <p className="text-muted-foreground line-clamp-3">{instructor.bio}</p>
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
