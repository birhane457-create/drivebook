'use client';

import { useState, useEffect } from 'react';
import { Calendar, Bell, Save, CheckCircle, XCircle, Mail, MessageSquare, BellRing, Info } from 'lucide-react';

type NotifKey =
  | 'BOOKING_REQUEST' | 'BOOKING_CONFIRMED' | 'BOOKING_CANCELLED' | 'BOOKING_RESCHEDULED'
  | 'PAYMENT_RECEIVED' | 'LESSON_REMINDER' | 'DOCUMENT_EXPIRING' | 'REVIEW_RECEIVED'
  | 'NEW_MESSAGE' | 'PAYOUT_PROCESSED' | 'NO_SHOW_FLAGGED';

interface NotifChannel { inApp: boolean; email: boolean; sms: boolean; }
interface Settings {
  booking: {
    minAdvanceHours: number;
    maxAdvanceDays: number;
    packageBypassMinAdvance: boolean;
    maxLessonsPerDayPerInstructor: number;
  };
  notifications: Record<NotifKey, NotifChannel>;
}

type Toast = { type: 'success' | 'error'; message: string } | null;

const EVENT_LABELS: Record<NotifKey, { label: string; who: string; note?: string }> = {
  BOOKING_REQUEST:     { label: 'Booking request',      who: 'Instructor',        note: 'When instructor creates a booking' },
  BOOKING_CONFIRMED:   { label: 'Booking confirmed',    who: 'Client + Instructor' },
  BOOKING_CANCELLED:   { label: 'Booking cancelled',    who: 'Client + Instructor' },
  BOOKING_RESCHEDULED: { label: 'Booking rescheduled',  who: 'Client + Instructor' },
  PAYMENT_RECEIVED:    { label: 'Payment received',     who: 'Instructor' },
  LESSON_REMINDER:     { label: 'Lesson reminder',      who: 'Client + Instructor', note: '24h before lesson' },
  DOCUMENT_EXPIRING:   { label: 'Document expiring',    who: 'Instructor',          note: '30 days before expiry' },
  REVIEW_RECEIVED:     { label: 'Review received',      who: 'Instructor' },
  NEW_MESSAGE:         { label: 'New message',          who: 'Both' },
  PAYOUT_PROCESSED:    { label: 'Payout processed',     who: 'Instructor' },
  NO_SHOW_FLAGGED:     { label: 'No-show flagged',      who: 'Admin + Instructor' },
};

const CHANNEL_ICONS = {
  inApp: <BellRing className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  sms:   <MessageSquare className="h-3.5 w-3.5" />,
};

const CHANNEL_LABELS = { inApp: 'In-app', email: 'Email', sms: 'SMS' };

export default function PlatformSettingsForm() {
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(data => { setS(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }

  function setBooking(patch: Partial<Settings['booking']>) {
    setS(prev => prev ? { ...prev, booking: { ...prev.booking, ...patch } } : prev);
  }

  function toggleChannel(event: NotifKey, channel: keyof NotifChannel) {
    setS(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        notifications: {
          ...prev.notifications,
          [event]: { ...prev.notifications[event], [channel]: !prev.notifications[event][channel] },
        },
      };
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      });
      if (res.ok) showToast('success', 'Settings saved');
      else showToast('error', 'Failed to save settings');
    } catch {
      showToast('error', 'Network error');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !s) {
    return <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 text-center text-slate-500 text-sm">Loading settings...</div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">

      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      )}

      {/* Booking Rules */}
      <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-800 p-6">
        <h2 className="font-semibold text-slate-100 flex items-center gap-2 mb-5">
          <Calendar className="h-5 w-5 text-blue-600" />
          Booking Rules
        </h2>
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Minimum advance booking (hours)
            </label>
            <input
              type="number" min={0} max={168} value={s.booking.minAdvanceHours}
              onChange={e => setBooking({ minAdvanceHours: parseInt(e.target.value) || 0 })}
              className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">Clients can't book less than this many hours ahead</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Maximum advance booking (days)
            </label>
            <input
              type="number" min={1} max={365} value={s.booking.maxAdvanceDays}
              onChange={e => setBooking({ maxAdvanceDays: parseInt(e.target.value) || 1 })}
              className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">How far ahead a single lesson can be booked</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Max lessons per instructor per day
            </label>
            <input
              type="number" min={1} max={20} value={s.booking.maxLessonsPerDayPerInstructor}
              onChange={e => setBooking({ maxLessonsPerDayPerInstructor: parseInt(e.target.value) || 1 })}
              className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-start gap-3 p-4 bg-blue-900/20 border border-blue-700/50 rounded-xl">
              <button
                type="button"
                onClick={() => setBooking({ packageBypassMinAdvance: !s.booking.packageBypassMinAdvance })}
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors shrink-0 mt-0.5 ${s.booking.packageBypassMinAdvance ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-slate-900 shadow transform transition-transform mt-0.5 ${s.booking.packageBypassMinAdvance ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <div>
                <p className="text-sm font-medium text-blue-200">Packages bypass min advance window</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  When on, clients buying a full package (6/10/15 lessons) can book the first lesson immediately — prevents second thoughts and bypasses the minimum window. Smart for conversion.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Matrix */}
      <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-800 p-6">
        <h2 className="font-semibold text-slate-100 flex items-center gap-2 mb-2">
          <Bell className="h-5 w-5 text-purple-600" />
          Notification Channels
        </h2>
        <p className="text-xs text-slate-500 mb-5 flex items-center gap-1">
          <Info className="h-3.5 w-3.5" />
          Controls which channels fire for each event. In-app is the bell icon. SMS requires Twilio. Email requires SMTP.
        </p>

        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center mb-2 px-1">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Event</span>
          {(['inApp', 'email', 'sms'] as const).map(ch => (
            <div key={ch} className="flex items-center gap-1 text-xs font-medium text-slate-400 uppercase tracking-wide w-16 justify-center">
              {CHANNEL_ICONS[ch]}{CHANNEL_LABELS[ch]}
            </div>
          ))}
        </div>

        <div className="divide-y divide-gray-50">
          {(Object.keys(EVENT_LABELS) as NotifKey[]).map(event => {
            const { label, who, note } = EVENT_LABELS[event];
            const channels = s.notifications[event];
            return (
              <div key={event} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center py-3 px-1">
                <div>
                  <p className="text-sm text-slate-200">{label}</p>
                  <p className="text-xs text-slate-500">{who}{note ? ` · ${note}` : ''}</p>
                </div>
                {(['inApp', 'email', 'sms'] as const).map(ch => (
                  <div key={ch} className="w-16 flex justify-center">
                    <button
                      type="button"
                      onClick={() => toggleChannel(event, ch)}
                      className={`w-9 h-5 rounded-full transition-colors relative ${channels[ch] ? 'bg-blue-600' : 'bg-slate-800'}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-slate-900 shadow transition-transform ${channels[ch] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit" disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        <p className="text-xs text-slate-500">Booking rules apply to new bookings immediately.</p>
      </div>
    </form>
  );
}
