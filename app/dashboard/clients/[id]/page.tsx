'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, User, Phone, Mail, MapPin, FileText, Wallet,
  CalendarPlus, AlertCircle, Loader2, Send, CheckCircle,
  Calendar, Clock, DollarSign
} from 'lucide-react';

interface ClientDetail {
  id: string;
  name: string;
  phone: string;
  email: string;
  addressText: string | null;
  notes: string | null;
  userId: string | null;
  hasAccount: boolean;
  walletBalance: number | null;
  createdAt: string;
  bookings: {
    id: string;
    startTime: string | null;
    duration: number | null;
    price: number;
    status: string;
    isPaid: boolean;
    source: string;
  }[];
}

const STATUS_BADGE: Record<string, string> = {
  CONFIRMED:       'bg-green-100 text-green-700',
  COMPLETED:       'bg-gray-100 text-gray-600',
  PENDING:         'bg-amber-100 text-amber-700',
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-700',
  CANCELLED:       'bg-red-100 text-red-600',
  EXPIRED:         'bg-gray-100 text-gray-400',
  NO_SHOW:         'bg-red-100 text-red-600',
};

export default function InstructorClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  useEffect(() => {
    fetch(`/api/instructor/clients/${clientId}`)
      .then(r => {
        if (r.status === 404) throw new Error('not_found');
        if (!r.ok) throw new Error('failed');
        return r.json();
      })
      .then(setClient)
      .catch(e => setError(e.message === 'not_found' ? 'Client not found.' : 'Failed to load client.'))
      .finally(() => setLoading(false));
  }, [clientId]);

  const handleSendPaymentLink = async () => {
    if (!client) return;
    setSendingLink(true);
    try {
      const res = await fetch('/api/bookings/send-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          topUpAmount: 50, // default suggestion — instructor can adjust from booking page
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || 'Failed to send payment link.');
        return;
      }
      setLinkSent(true);
      setTimeout(() => setLinkSent(false), 4000);
    } catch {
      alert('Failed to send payment link.');
    } finally {
      setSendingLink(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 mb-4">{error || 'Client not found.'}</p>
          <Link href="/dashboard/clients" className="text-blue-600 hover:underline text-sm">
            ← Back to clients
          </Link>
        </div>
      </div>
    );
  }

  const completedBookings = client.bookings.filter(b => b.status === 'COMPLETED');
  const totalSpend = completedBookings.reduce((sum, b) => sum + b.price, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard/clients" className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900 truncate">{client.name}</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Account status banner */}
        {!client.hasAccount && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>
              This client hasn't registered yet. You can still book for them — they'll receive an email to claim their account and complete payment.
            </span>
          </div>
        )}

        {/* Client info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{client.name}</p>
              <p className="text-xs text-gray-400">
                Added {new Date(client.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition">
              <Phone className="w-4 h-4 text-gray-400" /> {client.phone}
            </a>
            <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition">
              <Mail className="w-4 h-4 text-gray-400" /> {client.email}
            </a>
            {client.addressText && (
              <div className="flex items-start gap-2 text-sm text-gray-700">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <span>{client.addressText}</span>
              </div>
            )}
            {client.notes && (
              <div className="flex items-start gap-2 text-sm text-gray-600 italic">
                <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <span>{client.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Wallet & stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
            <Wallet className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">
              {client.walletBalance !== null ? `$${client.walletBalance.toFixed(2)}` : '—'}
            </p>
            <p className="text-xs text-gray-500">Wallet</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
            <Calendar className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">{client.bookings.length}</p>
            <p className="text-xs text-gray-500">Bookings</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
            <DollarSign className="w-5 h-5 text-purple-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">${totalSpend.toFixed(0)}</p>
            <p className="text-xs text-gray-500">Total Spend</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href={`/dashboard/bookings/new?clientId=${client.id}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition text-sm"
          >
            <CalendarPlus className="w-4 h-4" /> Book Now
          </Link>
          {client.hasAccount && (
            <button
              onClick={handleSendPaymentLink}
              disabled={sendingLink || linkSent}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition text-sm disabled:opacity-60"
            >
              {linkSent
                ? <><CheckCircle className="w-4 h-4 text-green-600" /> Sent</>
                : sendingLink
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <><Send className="w-4 h-4" /> Payment Link</>
              }
            </button>
          )}
        </div>

        {/* Booking history */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Booking History</h2>
          </div>
          {client.bookings.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-400">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No bookings yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {client.bookings.map(b => (
                <Link
                  key={b.id}
                  href={`/dashboard/bookings/${b.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {b.status.replace('_', ' ')}
                      </span>
                      {b.source === 'offline' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Offline</span>
                      )}
                    </div>
                    {b.startTime && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(b.startTime).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {b.duration ? ` · ${b.duration >= 60 ? `${b.duration / 60}h` : `${b.duration}min`}` : ''}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900">${b.price.toFixed(2)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
