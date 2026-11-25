'use client';

import { useCallback, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Calendar, MapPin, Clock, DollarSign, Plus, CheckCircle,
  AlertCircle, Loader2, BookOpen, User, ChevronDown, ChevronUp,
} from 'lucide-react';

interface PDATest {
  id: string;
  testDate: string;
  testTime: string;
  status: string;
  price: number;
  result: string | null;
  config: { name: string; durationMinutes: number; price: number } | null;
  testCentre: { name: string; address: string } | null;
  provider: { id: string; name: string } | null;
}

const STATUS_STYLE: Record<string, { label: string; badge: string }> = {
  PENDING_PAYMENT: { label: 'Awaiting Payment', badge: 'bg-yellow-900/30 text-yellow-300 border border-yellow-700/40' },
  PENDING:   { label: 'Upcoming',   badge: 'bg-amber-900/30 text-amber-300 border border-amber-700/40' },
  CONFIRMED: { label: 'Confirmed',  badge: 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/40' },
  COMPLETED: { label: 'Completed',  badge: 'bg-sky-900/30 text-primary border border-sky-700/40' },
  CANCELLED: { label: 'Cancelled',  badge: 'bg-rose-900/30 text-rose-300 border border-rose-700/40' },
  PASSED:    { label: 'Passed ✓',   badge: 'bg-green-900/30 text-green-300 border border-green-700/40' },
  FAILED:    { label: 'Not Passed', badge: 'bg-orange-900/30 text-orange-300 border border-orange-700/40' },
};

export default function ClientPDATestsPage() {
  const { data: session } = useSession();
  const [tests, setTests] = useState<PDATest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadTests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/pda-bookings', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to load PDA tests');
      if (!data || !Array.isArray(data.bookings)) throw new Error('PDA test information was incomplete.');
      setTests(data.bookings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PDA test information. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user) void loadTests();
  }, [session?.user, loadTests]);

  const upcoming = tests.filter(t => t.status === 'PENDING_PAYMENT' || t.status === 'PENDING' || t.status === 'CONFIRMED');
  const past = tests.filter(t => t.status === 'COMPLETED' || t.status === 'CANCELLED' || t.status === 'PASSED' || t.status === 'FAILED');

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">PDA Test Management</h1>
          <p className="text-muted-foreground text-sm">Your practical driving assessment bookings</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1"><p className="text-sm text-destructive">{error}</p><button type="button" onClick={() => void loadTests()} className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Try again</button></div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary mr-3" />
            <span className="text-muted-foreground">Loading your PDA tests…</span>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">Upcoming</p>
                <p className="text-3xl font-bold text-foreground">{upcoming.length}</p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">Completed</p>
                <p className="text-3xl font-bold text-foreground">{past.length}</p>
              </div>
            </div>

            {/* Book new test CTA */}
            <Link
              href="/client-dashboard/book-lesson"
              className="flex items-center justify-between w-full p-4 mb-6 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-2xl transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Book a PDA Test</p>
                  <p className="text-xs text-muted-foreground">Choose an instructor, then select a PDA test</p>
                </div>
              </div>
              <BookOpen className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
            </Link>

            {/* Upcoming tests */}
            {upcoming.length > 0 && (
              <section className="mb-6">
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Upcoming</h2>
                <div className="space-y-3">
                  {upcoming.map(test => (
                    <TestCard key={test.id} test={test} expanded={expanded === test.id} onToggle={() => setExpanded(expanded === test.id ? null : test.id)} />
                  ))}
                </div>
              </section>
            )}

            {/* Past tests */}
            {past.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">History</h2>
                <div className="space-y-3">
                  {past.map(test => (
                    <TestCard key={test.id} test={test} expanded={expanded === test.id} onToggle={() => setExpanded(expanded === test.id ? null : test.id)} />
                  ))}
                </div>
              </section>
            )}

            {tests.length === 0 && (
              <div className="bg-card rounded-2xl border border-border p-10 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">No PDA tests booked yet</h3>
                <p className="text-muted-foreground text-sm mb-6">When you book a PDA test with your instructor, it will appear here.</p>
                <Link
                  href="/client-dashboard/pda-tests/book"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition"
                >
                  <Plus className="w-4 h-4" />Find an instructor to book a PDA test
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TestCard({ test, expanded, onToggle }: { test: PDATest; expanded: boolean; onToggle: () => void }) {
  const cfg = STATUS_STYLE[test.status] ?? STATUS_STYLE.PENDING;
  const testDate = test.testDate ? new Date(test.testDate).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <button onClick={onToggle} className="w-full text-left p-4 flex items-start gap-3 hover:bg-secondary/30 transition">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-foreground text-sm truncate">{test.config?.name ?? 'PDA Test'}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{cfg.label}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{test.provider?.name ?? 'Instructor'}</p>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-foreground">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            {testDate} at {test.testTime ?? '—'}
          </div>
          {test.testCentre && (
            <div className="flex items-start gap-2 text-foreground">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <span>{test.testCentre.name} — {test.testCentre.address}</span>
            </div>
          )}
          {test.config?.durationMinutes && (
            <div className="flex items-center gap-2 text-foreground">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              {test.config.durationMinutes >= 60
                ? `${Math.floor(test.config.durationMinutes / 60)}h${test.config.durationMinutes % 60 ? ` ${test.config.durationMinutes % 60}m` : ''}`
                : `${test.config.durationMinutes}min`}
            </div>
          )}
          <div className="flex items-center gap-2 text-foreground">
            <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
            ${Number(test.price).toFixed(2)}
          </div>
          {test.result && (
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle className="w-4 h-4 text-muted-foreground shrink-0" />
              Result: {test.result}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
