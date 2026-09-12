'use client';
import { DashboardPageLayout } from '@/components/ui'

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { resolveTimezone, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';
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
  CONFIRMED:       'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  COMPLETED:       'bg-secondary text-muted-foreground',
  PENDING:         'bg-amber-100 text-amber-400',
  PENDING_PAYMENT: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  CANCELLED:       'bg-destructive/15 text-destructive border border-destructive/25',
  EXPIRED:         'bg-secondary text-muted-foreground',
  NO_SHOW:         'bg-destructive/15 text-destructive border border-destructive/25',
};

export default function InstructorClientDetailPage() {
  const params = useParams();
  const customerId = params.id as string;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  // C-04: inline error for payment link — persists near the button
  const [linkError, setLinkError] = useState<string | null>(null);
  const [instructorTz, setInstructorTz] = useState(DEFAULT_TIMEZONE);

  useEffect(() => {
    fetch(`/api/instructor/clients/${customerId}`)
      .then(r => {
        if (r.status === 404) throw new Error('not_found');
        if (!r.ok) throw new Error('failed');
        return r.json();
      })
      .then(setClient)
      .catch(e => setError(e.message === 'not_found' ? 'Client not found.' : 'Failed to load client.'))
      .finally(() => setLoading(false));
  }, [customerId]);

  const handleSendPaymentLink = async () => {
    if (!client) return;
    setSendingLink(true);
    setLinkError(null);
    try {
      const res = await fetch('/api/bookings/send-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: client.id,
          topUpAmount: 50,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setLinkError(d.error || 'Failed to send payment link. Please try again.');
        return;
      }
      setLinkSent(true);
      setTimeout(() => setLinkSent(false), 4000);
    } catch {
      setLinkError('Failed to send payment link. Please try again.');
    } finally {
      setSendingLink(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-sky-500" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <p className="text-foreground mb-4">{error || 'Client not found.'}</p>
          <Link href="/dashboard/clients" className="text-primary hover:underline text-sm">
            ← Back to clients
          </Link>
        </div>
      </div>
    );
  }

  const completedBookings = client.bookings.filter((b: any) => b.status === 'COMPLETED');
  const totalSpend = completedBookings.reduce((sum: any, b: any) => sum + b.price, 0);

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      {/* Header */}
      <header className="bg-background/95 border-b border-border sticky top-0 z-10 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard/clients" className="p-2 hover:bg-secondary rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <h1 className="text-lg font-bold text-foreground truncate">{client.name}</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Account status banner */}
        {!client.hasAccount && (
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 text-sm text-amber-400">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>
              This client hasn't registered yet. You can still book for them — they'll receive an email to claim their account and complete payment.
            </span>
          </div>
        )}

        {/* Client info */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-3">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-12 h-12 bg-sky-900/40 rounded-full flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground">{client.name}</p>
              <p className="text-xs text-muted-foreground/60">
                Added {new Date(client.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition">
              <Phone className="w-4 h-4 text-muted-foreground/60" /> {client.phone}
            </a>
            <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition">
              <Mail className="w-4 h-4 text-muted-foreground/60" /> {client.email}
            </a>
            {client.addressText && (
              <div className="flex items-start gap-2 text-sm text-foreground">
                <MapPin className="w-4 h-4 text-muted-foreground/60 mt-0.5 shrink-0" />
                <span>{client.addressText}</span>
              </div>
            )}
            {client.notes && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground italic">
                <FileText className="w-4 h-4 text-muted-foreground/60 mt-0.5 shrink-0" />
                <span>{client.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Wallet & stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <Wallet className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">
              {client.walletBalance !== null ? `$${client.walletBalance.toFixed(2)}` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Wallet</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <Calendar className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{client.bookings.length}</p>
            <p className="text-xs text-muted-foreground">Bookings</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <DollarSign className="w-5 h-5 text-purple-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">${totalSpend.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Total Spend</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-col">
          <div className="flex gap-3">
            <Link
              href={`/dashboard/bookings/new?customerId=${client.id}`}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-foreground font-semibold rounded-xl hover:bg-primary/90 transition text-sm"
            >
              <CalendarPlus className="w-4 h-4" /> Book Now
            </Link>
            {client.hasAccount && (
              <button
                onClick={handleSendPaymentLink}
                disabled={sendingLink || linkSent}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-border text-foreground font-semibold rounded-xl hover:bg-secondary transition text-sm disabled:opacity-60"
              >
                {linkSent
                  ? <><CheckCircle className="w-4 h-4 text-emerald-400" /> Sent</>
                  : sendingLink
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><Send className="w-4 h-4" /> Payment Link</>
                }
              </button>
            )}
          </div>
          {/* C-04: inline error stays visible near the button — payment actions need persistent feedback */}
          {linkError && (
            <p role="alert" className="text-sm text-destructive bg-destructive/10 border border-destructive/25 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="shrink-0">❌</span>
              {linkError}
            </p>
          )}
        </div>

        {/* Booking history */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Booking History</h2>
          </div>
          {client.bookings.length === 0 ? (
            <div className="px-5 py-10 text-center text-muted-foreground/60">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No bookings yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {client.bookings.map((b: any) => (
                <Link
                  key={b.id}
                  href={`/dashboard/bookings/${b.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-secondary/50 transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[b.status] ?? 'bg-secondary text-muted-foreground'}`}>
                        {b.status.replace('_', ' ')}
                      </span>
                      {b.source === 'offline' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground/60">Offline</span>
                      )}
                    </div>
                    {b.startTime && (
                      <p className="text-xs text-muted-foreground/60 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(b.startTime).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: instructorTz })}
                        {b.duration ? ` · ${b.duration >= 60 ? `${b.duration / 60}h` : `${b.duration}min`}` : ''}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground">${b.price.toFixed(2)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
