'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import {
  ChevronLeft, Plus, Minus, AlertCircle, Loader2,
  X, Save, Phone, Mail, StickyNote, Edit2,
  Calendar, CreditCard, Filter, User, ArrowLeft,
  Ban, CheckCircle, RefreshCw, Trash2, MoreVertical,
} from 'lucide-react';
import Link from 'next/link';
import { useInstructorSearch } from '@/lib/hooks/useInstructorSearch';

interface Transaction {
  id: string; amount: number; type: string;
  description: string; status: string; createdAt: string;
}
interface Booking {
  id: string; startTime: string; endTime: string; status: string;
  price: number; instructor: { name: string }; notes?: string;
}
interface ClientData {
  user: { id: string; name: string; email: string; phone: string; notes: string; createdAt: string };
  wallet: { id: string; totalPaid: number; totalSpent: number; creditsRemaining: number; transactions: Transaction[] };
  bookings: Booking[];
  clientId?: string;
  currentInstructor?: { id: string; name: string; hourlyRate: number; serviceAreas?: string | null; baseAddress?: string | null } | null;
}
interface Instructor { id: string; name: string; hourlyRate: number; serviceAreas?: string | null; baseAddress?: string | null; }

function Drawer({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />}
      <div className={`fixed top-0 right-0 h-full w-full max-w-lg bg-slate-900 shadow-2xl z-50 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0">
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-900 transition md:hidden">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <h2 className="text-lg font-bold text-slate-100 flex-1">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-900 transition hidden md:flex">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: 'bg-green-900/40 text-green-300',
    CONFIRMED: 'bg-blue-900/40 text-blue-300',
    CANCELLED: 'bg-red-900/40 text-red-300',
    PENDING: 'bg-yellow-900/40 text-yellow-300',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${map[status] || 'bg-slate-900 text-slate-400'}`}>
      {status}
    </span>
  );
}

// Compact action menu â€” â‹¯ button with dropdown
function BookingActions({ b, onCancel, onComplete, onReschedule, onDelete, loading }: {
  b: Booking;
  onCancel: () => void; onComplete: () => void;
  onReschedule: () => void; onDelete: () => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const active = b.status === 'CONFIRMED' || b.status === 'PENDING';
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} disabled={loading}
        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 disabled:opacity-40">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-lg z-10 py-1 text-sm">
          {active && <>
            <button onClick={() => { setOpen(false); onReschedule(); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-950 text-slate-300">
              <RefreshCw className="w-3.5 h-3.5 text-blue-500" />Reschedule
            </button>
            <button onClick={() => { setOpen(false); onComplete(); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-950 text-slate-300">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />Mark Complete
            </button>
            <button onClick={() => { setOpen(false); onCancel(); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-950 text-slate-300">
              <Ban className="w-3.5 h-3.5 text-orange-500" />Cancel + Refund
            </button>
            <div className="border-t border-slate-800 my-1" />
          </>}
          <button onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-900/20 text-red-500">
            <Trash2 className="w-3.5 h-3.5" />Remove record
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminClientDetailsPage() {
  const params = useParams();
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [txDrawer, setTxDrawer] = useState(false);
  const [bookingDrawer, setBookingDrawer] = useState(false);

  const [creditMode, setCreditMode] = useState<'add' | 'deduct' | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [txFilter, setTxFilter] = useState('all');
  const [bookingFilter, setBookingFilter] = useState('all');

  // Reschedule
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  // Add booking
  const [showAddBooking, setShowAddBooking] = useState(false);
  const { results: instructors, loading: instrLoading, search: searchInstructors, clear: clearInstructors } = useInstructorSearch({ admin: true });
  const [newInstructorId, setNewInstructorId] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newDuration, setNewDuration] = useState('60');
  const [newNotes, setNewNotes] = useState('');
  const [instructorSearch, setInstructorSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [availSlots, setAvailSlots] = useState<string[]>([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState<{id:string;name:string;hourlyRate:number} | null>(null);

  useEffect(() => { fetchClient(); }, []);

  const fetchClient = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/clients/${params.id}/wallet`);
      if (res.ok) {
        const data = await res.json();
        setClient(data);
        setEditName(data.user.name || '');
        setEditEmail(data.user.email || '');
        setEditPhone(data.user.phone || '');
        setEditNotes(data.user.notes || '');
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const fetchAvailSlots = async (instructorId: string, date: string, duration: string) => {
    if (!instructorId || !date) return;
    setAvailLoading(true); setAvailSlots([]); setNewTime('');
    try {
      const res = await fetch(`/api/availability/slots?instructorId=${instructorId}&date=${date}&duration=${duration}&bypassDurationCheck=true`);
      if (res.ok) { const d = await res.json(); setAvailSlots(d.slots?.map((s: any) => s.time) || []); }
    } catch { /* ignore */ } finally { setAvailLoading(false); }
  };

  const flash = (ok: boolean, text: string) => {
    ok ? setSuccess(text) : setError(text);
    setTimeout(() => { setSuccess(''); setError(''); }, 5000);
  };

  const handleCredit = async () => {
    if (!amount || parseFloat(amount) <= 0) { setError('Enter a valid amount'); return; }
    setActionLoading(true);
    const endpoint = creditMode === 'add' ? 'add-credit' : 'deduct-credit';
    const res = await fetch(`/api/admin/clients/${params.id}/wallet/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(amount), reason: reason || `Manual ${creditMode} by admin` }),
    });
    const data = await res.json();
    flash(res.ok, res.ok ? `${creditMode === 'add' ? 'Added' : 'Deducted'} $${amount}` : data.error);
    if (res.ok) { setAmount(''); setReason(''); setCreditMode(null); setTimeout(fetchClient, 500); }
    setActionLoading(false);
  };

  const handleEditDetails = async () => {
    setActionLoading(true);
    const res = await fetch(`/api/admin/clients/${params.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, email: editEmail, phone: editPhone, notes: editNotes }),
    });
    const data = await res.json();
    flash(res.ok, res.ok ? 'Details updated' : data.error);
    if (res.ok) { setEditMode(false); setTimeout(fetchClient, 300); }
    setActionLoading(false);
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Cancel this booking? A refund will be issued based on the cancellation policy.')) return;
    setActionLoading(true);
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      const r = data.refund;
      flash(true, `Cancelled. Refund: ${r?.percentage ?? 0}% ($${(r?.amount ?? 0).toFixed(2)})`);
      setTimeout(fetchClient, 500);
    } else { flash(false, data.error || 'Failed to cancel'); }
    setActionLoading(false);
  };

  const handleMarkComplete = async (bookingId: string) => {
    if (!confirm('Mark this booking as completed?')) return;
    setActionLoading(true);
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    const data = await res.json();
    flash(res.ok, res.ok ? 'Marked as completed' : data.error);
    if (res.ok) setTimeout(fetchClient, 500);
    setActionLoading(false);
  };

  const handleReschedule = async (b: Booking) => {
    if (!rescheduleDate || !rescheduleTime) { flash(false, 'Select a new date and time'); return; }
    setActionLoading(true);
    const newStart = new Date(`${rescheduleDate}T${rescheduleTime}`);
    const durMs = new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
    const newEnd = new Date(newStart.getTime() + durMs);
    const res = await fetch(`/api/bookings/${b.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startTime: newStart.toISOString(), endTime: newEnd.toISOString() }),
    });
    const data = await res.json();
    flash(res.ok, res.ok ? 'Booking rescheduled' : data.error);
    if (res.ok) { setRescheduleId(null); setRescheduleDate(''); setRescheduleTime(''); setTimeout(fetchClient, 500); }
    setActionLoading(false);
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!confirm('Remove this booking? A soft-delete will be performed and an audit log entry created.')) return;
    setActionLoading(true);
    const res = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' });
    const data = await res.json();
    flash(res.ok, res.ok ? 'Booking removed' : data.error);
    if (res.ok) setTimeout(fetchClient, 500);
    setActionLoading(false);
  };

  const handleAddBooking = async () => {
    if (!newInstructorId || !newDate || !newTime) { flash(false, 'Select instructor, date and time'); return; }
    setActionLoading(true);
    const startTime = new Date(`${newDate}T${newTime}`);
    const endTime = new Date(startTime.getTime() + parseInt(newDuration) * 60000);
    // Find the clientId from the wallet data
    const clientId = (client as any)?.clientId || params.id;
    const res = await fetch('/api/admin/bookings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, instructorId: newInstructorId, startTime: startTime.toISOString(), endTime: endTime.toISOString(), notes: newNotes }),
    });
    const data = await res.json();
    if (res.ok) {
      flash(true, 'Booking created');
      setShowAddBooking(false); setNewInstructorId(''); setNewDate(''); setNewTime(''); setNewNotes('');
      setTimeout(fetchClient, 500);
    } else { flash(false, data.error || 'Failed to create booking'); }
    setActionLoading(false);
  };

  const filteredTx = client?.wallet.transactions.filter(tx => {
    if (txFilter === 'credit') return tx.type === 'CREDIT' || tx.type === 'REFUND';
    if (txFilter === 'debit') return tx.type === 'DEBIT';
    return true;
  }) || [];

  const filteredBookings = client?.bookings.filter(b =>
    bookingFilter === 'all' ? true : b.status === bookingFilter.toUpperCase()
  ) || [];

  if (loading) return (
    <div className="min-h-screen bg-slate-950 text-slate-100"><AdminNav />
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    </div>
  );

  if (!client) return (
    <div className="min-h-screen bg-slate-950 text-slate-100"><AdminNav />
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-slate-400">Client not found</p>
      </div>
    </div>
  );

  const usagePct = client.wallet.totalPaid > 0
    ? Math.min((client.wallet.totalSpent / client.wallet.totalPaid) * 100, 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />

      {/* â”€â”€ Transaction Drawer (read-only) â”€â”€ */}
      <Drawer open={txDrawer} onClose={() => setTxDrawer(false)}
        title={`Transaction History (${filteredTx.length})`}>
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select value={txFilter} onChange={e => setTxFilter(e.target.value)}
            className="text-sm border border-slate-700 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500">
            <option value="all">All</option>
            <option value="credit">Credits</option>
            <option value="debit">Debits</option>
          </select>
        </div>
        <div className="divide-y">
          {filteredTx.length === 0
            ? <p className="text-center text-slate-500 py-16 text-sm">No transactions</p>
            : filteredTx.map(tx => (
              <div key={tx.id} className="px-5 py-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">{tx.description || 'No description'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{new Date(tx.createdAt).toLocaleString()}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${tx.type === 'CREDIT' || tx.type === 'REFUND' ? 'bg-green-900/20 text-green-600' : 'bg-red-900/20 text-red-600'}`}>
                    {tx.type}
                  </span>
                </div>
                <span className={`text-sm font-bold shrink-0 ${tx.type === 'CREDIT' || tx.type === 'REFUND' ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.type === 'CREDIT' || tx.type === 'REFUND' ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                </span>
              </div>
            ))}
        </div>
      </Drawer>

      {/* â”€â”€ Bookings Drawer (full management) â”€â”€ */}
      <Drawer open={bookingDrawer} onClose={() => setBookingDrawer(false)}
        title={`Bookings (${filteredBookings.length})`}>

        {/* Add Booking toggle */}
        <div className="px-4 py-3 border-b">
          {showAddBooking ? (
            <div className="space-y-3 pb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">New Booking</p>

              {/* ── Step 1: Instructor ── */}
              {!newInstructorId ? (
                <div className="space-y-2">
                  {/* Current instructor shortcut */}
                  {client.currentInstructor && (
                    <button onClick={() => { setNewInstructorId(client.currentInstructor!.id); setSelectedInstructor(client.currentInstructor!); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-blue-900/20 border border-blue-700/50 rounded-xl text-sm hover:bg-blue-900/40 transition">
                      <div className="text-left">
                        <p className="text-blue-700 font-semibold">{client.currentInstructor.name}</p>
                        <p className="text-xs text-blue-400">Current instructor  ${client.currentInstructor.hourlyRate}/hr</p>
                      </div>
                      <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Use</span>
                    </button>
                  )}
                  {/* Search inputs */}
                  <div className="flex gap-2">
                    <input value={instructorSearch}
                      onChange={e => { setInstructorSearch(e.target.value); setLocationSearch(""); if (e.target.value.length > 1) searchInstructors(e.target.value, "name"); else clearInstructors(); }}
                      placeholder="Name..." className="flex-1 px-3 py-2 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    <input value={locationSearch}
                      onChange={e => { setLocationSearch(e.target.value); setInstructorSearch(""); }}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (locationSearch.length > 1) searchInstructors(locationSearch, "location"); } }}
                      placeholder="Suburb / postcode " className="flex-1 px-3 py-2 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {instrLoading && <p className="text-xs text-slate-500 animate-pulse">Searching...</p>}
                  {/* Results as cards */}
                  {instructors.length > 0 && (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {instructors.map(i => (
                        <button key={i.id} onClick={() => { setNewInstructorId(i.id); setSelectedInstructor({ id: i.id, name: i.name, hourlyRate: i.hourlyRate }); clearInstructors(); setInstructorSearch(""); setLocationSearch(""); }}
                          className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl hover:border-blue-400 hover:bg-blue-900/20 transition text-left">
                          <div>
                            <p className="text-sm font-semibold text-slate-200">{i.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {i.serviceAreas && <span className="text-xs bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">{i.serviceAreas.split(",")[0].trim()}</span>}
                              {i.distance != null && <span className="text-xs text-green-600">{i.distance} km</span>}
                            </div>
                          </div>
                          <span className="text-sm font-bold text-slate-300 shrink-0">${i.hourlyRate}/hr</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between px-3 py-2.5 bg-green-900/20 border border-green-700/50 rounded-xl text-sm">
                  <div>
                    <p className="font-semibold text-green-300">{selectedInstructor?.name || newInstructorId}</p>
                    <p className="text-xs text-green-600">${selectedInstructor?.hourlyRate}/hr</p>
                  </div>
                  <button onClick={() => { setNewInstructorId(""); setSelectedInstructor(null); setAvailSlots([]); setNewTime(""); setNewDate(""); }}
                    className="text-xs text-slate-500 hover:text-red-500 px-2 py-1 rounded hover:bg-red-900/20">Change</button>
                </div>
              )}

              {/*  Step 2: Date + Duration  */}
              {newInstructorId && (
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={newDate}
                    onChange={e => { setNewDate(e.target.value); setNewTime(""); if (e.target.value) fetchAvailSlots(newInstructorId, e.target.value, newDuration); }}
                    min={new Date().toISOString().split("T")[0]}
                    className="px-3 py-2 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  <select value={newDuration} onChange={e => { setNewDuration(e.target.value); setNewTime(""); if (newDate) fetchAvailSlots(newInstructorId, newDate, e.target.value); }}
                    className="px-3 py-2 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="60">1 hr</option>
                    <option value="90">1.5 hr</option>
                    <option value="120">2 hr</option>
                    <option value="150">2.5 hr</option>
                    <option value="180">3 hr</option>
                  </select>
                </div>
              )}

              {/*  Step 3: Time slots  */}
              {newInstructorId && newDate && (
                <div>
                  {availLoading ? (
                    <p className="text-xs text-slate-500 animate-pulse py-2">Loading available slots...</p>
                  ) : availSlots.length === 0 ? (
                    <p className="text-xs text-orange-500 py-2">No available slots on this date</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                      {availSlots.map(slot => (
                        <button key={slot} onClick={() => setNewTime(slot)}
                          className={`py-1.5 text-xs font-medium rounded-lg border transition ${newTime === slot ? "bg-blue-600 text-white border-blue-600" : "bg-slate-900 text-slate-300 border-slate-700 hover:border-blue-400"}`}>
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/*  Credit check  */}
              {newInstructorId && newTime && selectedInstructor && (() => {
                const cost = (selectedInstructor.hourlyRate * parseInt(newDuration)) / 60;
                const balance = client.wallet.creditsRemaining;
                const ok = balance >= cost;
                return (
                  <div className={`px-3 py-2 rounded-lg text-xs ${ok ? "bg-green-900/20 border border-green-700/50" : "bg-red-900/20 border border-red-700/50"}`}>
                    <div className="flex justify-between">
                      <span className={ok ? "text-green-700" : "text-red-700"}>Lesson cost: <strong>${cost.toFixed(2)}</strong></span>
                      <span className={ok ? "text-green-600" : "text-red-600"}>Balance: <strong>${balance.toFixed(2)}</strong></span>
                    </div>
                    {!ok && <p className="text-red-600 mt-0.5"> Insufficient credit  add ${(cost - balance).toFixed(2)} before booking</p>}
                  </div>
                );
              })()}

              <input value={newNotes} onChange={e => setNewNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full px-3 py-2 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />

              <div className="flex gap-2">
                <button onClick={handleAddBooking} disabled={actionLoading || !newInstructorId || !newDate || !newTime}
                  className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40">
                  {actionLoading ? "Creating..." : "Create Booking"}
                </button>
                <button onClick={() => { setShowAddBooking(false); setNewInstructorId(""); setSelectedInstructor(null); setInstructorSearch(""); setLocationSearch(""); setAvailSlots([]); setNewDate(""); setNewTime(""); setNewNotes(""); clearInstructors(); }}
                  className="flex-1 py-2 border border-slate-700 text-sm rounded-lg hover:bg-slate-800/50">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <select value={bookingFilter} onChange={e => setBookingFilter(e.target.value)}
                  className="text-sm border border-slate-700 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500">
                  <option value="all">All</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <button onClick={() => setShowAddBooking(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">
                <Plus className="w-3.5 h-3.5" />Add Booking
              </button>
            </div>
          )}
        </div>

        <div className="divide-y">
          {filteredBookings.length === 0
            ? <p className="text-center text-slate-500 py-16 text-sm">No bookings</p>
            : filteredBookings.map(b => (
              <div key={b.id} className="px-5 py-3">
                {/* Main row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">{b.instructor?.name || 'Unknown'}</p>
                    <p className="text-xs text-slate-400">{b.startTime ? new Date(b.startTime).toLocaleString() : 'No date'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={b.status} />
                      <span className="text-xs font-semibold text-slate-300">${b.price?.toFixed(2)}</span>
                    </div>
                  </div>
                  <BookingActions
                    b={b}
                    loading={actionLoading}
                    onCancel={() => handleCancelBooking(b.id)}
                    onComplete={() => handleMarkComplete(b.id)}
                    onReschedule={() => { setRescheduleId(b.id); setRescheduleDate(''); setRescheduleTime(''); }}
                    onDelete={() => handleDeleteBooking(b.id)}
                  />
                </div>

                {/* Inline reschedule form */}
                {rescheduleId === b.id && (
                  <div className="mt-2 bg-blue-900/20 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-blue-700">Reschedule to:</p>
                    <div className="flex gap-2">
                      <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleReschedule(b)} disabled={actionLoading}
                        className="flex-1 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {actionLoading ? 'Savingâ€¦' : 'Confirm'}
                      </button>
                      <button onClick={() => setRescheduleId(null)}
                        className="flex-1 py-1.5 border border-slate-700 text-xs rounded-lg hover:bg-slate-800/50">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      </Drawer>

      {/* â”€â”€ Main content â”€â”€ */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin/clients"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 mb-6 text-sm">
          <ChevronLeft className="w-4 h-4" />Back to Clients
        </Link>

        {error && <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-900/20 border border-green-700/50 rounded-lg text-sm text-green-700">{success}</div>}

        {/* Client info card */}
        <div className="bg-slate-900 rounded-xl border border-slate-800-sm border border-slate-700 p-6 mb-6">
          {editMode ? (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Edit Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { label: 'Name', value: editName, set: setEditName },
                  { label: 'Email', value: editEmail, set: setEditEmail },
                  { label: 'Phone', value: editPhone, set: setEditPhone },
                  { label: 'Notes', value: editNotes, set: setEditNotes },
                ] as { label: string; value: string; set: (v: string) => void }[]).map(f => (
                  <div key={f.label}>
                    <label className="block text-xs font-medium text-slate-400 mb-1">{f.label}</label>
                    <input value={f.value} onChange={e => f.set(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleEditDetails} disabled={actionLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  <Save className="w-4 h-4" />{actionLoading ? 'Savingâ€¦' : 'Save Changes'}
                </button>
                <button onClick={() => setEditMode(false)}
                  className="px-4 py-2 border border-slate-700 text-sm rounded-lg hover:bg-slate-800/50">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-blue-900/40 flex items-center justify-center shrink-0">
                  <User className="w-7 h-7 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-100">{client.user.name}</h1>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    <span className="flex items-center gap-1 text-sm text-slate-400">
                      <Mail className="w-3.5 h-3.5" />{client.user.email}
                    </span>
                    {client.user.phone && (
                      <span className="flex items-center gap-1 text-sm text-slate-400">
                        <Phone className="w-3.5 h-3.5" />{client.user.phone}
                      </span>
                    )}
                  </div>
                  {client.user.notes && (
                    <p className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                      <StickyNote className="w-3 h-3" />{client.user.notes}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">Joined {new Date(client.user.createdAt).toLocaleDateString()}</p>
                  {client.currentInstructor && (
                    <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 bg-blue-900/20 rounded-lg w-fit">
                      <User className="w-3 h-3 text-blue-500" />
                      <span className="text-xs text-blue-700 font-medium">Instructor: {client.currentInstructor.name}</span>
                      <span className="text-xs text-blue-400">\/hr</span>
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => setEditMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-700 text-sm rounded-lg hover:bg-slate-800 text-slate-700 shrink-0">
                <Edit2 className="w-3.5 h-3.5" />Edit
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Paid', value: `$${client.wallet.totalPaid.toFixed(2)}`, color: 'text-slate-100', border: 'border-blue-400' },
            { label: 'Total Spent', value: `$${client.wallet.totalSpent.toFixed(2)}`, color: 'text-orange-600', border: 'border-orange-400' },
            { label: 'Balance', value: `$${client.wallet.creditsRemaining.toFixed(2)}`, color: client.wallet.creditsRemaining > 0 ? 'text-green-600' : 'text-red-600', border: client.wallet.creditsRemaining > 0 ? 'border-green-400' : 'border-red-400' },
            { label: 'Bookings', value: String(client.bookings.length), color: 'text-purple-600', border: 'border-purple-400' },
          ].map(s => (
            <div key={s.label} className={`bg-slate-900 rounded-xl border-t-4 ${s.border} shadow-sm p-4`}>
              <p className="text-xs text-slate-400 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Usage bar */}
        <div className="bg-slate-900 rounded-xl border border-slate-800-sm border border-slate-700 p-5 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">Credit usage</span>
            <span className="font-semibold text-slate-100">{usagePct.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${usagePct > 80 ? 'bg-red-900/200' : usagePct > 50 ? 'bg-yellow-500' : 'bg-green-900/200'}`}
              style={{ width: `${usagePct}%` }} />
          </div>
        </div>

        {/* Credit actions */}
        {creditMode ? (
          <div className="bg-slate-900 rounded-xl border border-slate-800-sm border border-slate-700 p-5 mb-6">
            <h3 className="font-semibold text-slate-100 mb-3">{creditMode === 'add' ? 'Add Credit' : 'Deduct Credit'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="Amount ($)" className="px-3 py-2 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              <input value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Reason (optional)" className="px-3 py-2 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleCredit} disabled={actionLoading}
                className={`flex-1 py-2 text-white text-sm rounded-lg font-semibold disabled:opacity-50 ${creditMode === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {actionLoading ? 'Processingâ€¦' : 'Confirm'}
              </button>
              <button onClick={() => { setCreditMode(null); setAmount(''); setReason(''); }}
                className="flex-1 py-2 border border-slate-700 text-sm rounded-lg hover:bg-slate-800/50">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 mb-6">
            <button onClick={() => setCreditMode('add')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition">
              <Plus className="w-4 h-4" />Add Credit
            </button>
            <button onClick={() => setCreditMode('deduct')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition">
              <Minus className="w-4 h-4" />Deduct Credit
            </button>
          </div>
        )}

        {/* Drawer triggers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={() => setTxDrawer(true)}
            className="flex items-center justify-between p-4 bg-slate-900 rounded-xl shadow-sm border border-slate-700 hover:border-blue-400 hover:bg-blue-900/20 transition text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-900/40 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">Transaction History</p>
                <p className="text-xs text-slate-500">{client.wallet.transactions.length} records Â· read only</p>
              </div>
            </div>
            <span className="text-xs text-blue-600 font-medium">View</span>
          </button>
          <button onClick={() => setBookingDrawer(true)}
            className="flex items-center justify-between p-4 bg-slate-900 rounded-xl shadow-sm border border-slate-700 hover:border-purple-400 hover:bg-violet-900/20 transition text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-900/40 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">Bookings</p>
                <p className="text-xs text-slate-500">{client.bookings.length} total Â· manage</p>
              </div>
            </div>
            <span className="text-xs text-purple-600 font-medium">Manage</span>
          </button>
        </div>
      </div>
    </div>
  );
}
























