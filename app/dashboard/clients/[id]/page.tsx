'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { resolveTimezone, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';
import Link from 'next/link';
import {
  ArrowLeft, User, Phone, Mail, MapPin, FileText, Wallet,
  CalendarPlus, AlertCircle, Loader2, Send, CheckCircle,
  Calendar, Clock, DollarSign, TrendingUp, Star, Target,
  ChevronDown, ChevronUp, BookOpen,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface RecentFeedback {
  id: string;
  bookingId: string;
  clientName: string;
  date: string;
  assessmentType: string;
  performanceScore: number | null;
  passed: boolean | null;
  focusAreaCodes: number[];
  strengthCodes: number[];
  lessonTopics: string | null;
  notes: string | null;
  nextLessonFocus: string | null;
}

interface ProgressData {
  totalLessonsWithFeedback: number;
  totalLessons: number;
  averageScore: number | null;
  mockCount: number;
  coachingCount: number;
  recentFeedback: RecentFeedback[];
  topFocusAreas: string[];
  topStrengths: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  CONFIRMED:       'bg-green-100 text-green-700',
  COMPLETED:       'bg-gray-100 text-gray-600',
  PENDING:         'bg-amber-100 text-amber-700',
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-700',
  CANCELLED:       'bg-red-100 text-red-600',
  EXPIRED:         'bg-gray-100 text-gray-400',
  NO_SHOW:         'bg-red-100 text-red-600',
};

// ── Skill trend bar — pure CSS, no chart library ───────────────────────────
// Shows the progression of focus area frequency across the last N lessons.
// Each lesson is a column; taller = more focus areas recorded that lesson.
function SkillTrendBar({ feedback }: { feedback: RecentFeedback[] }) {
  // Reverse so oldest is left, newest is right
  const lessons = [...feedback].reverse();
  const maxCodes = Math.max(...lessons.map(f => f.focusAreaCodes.length), 1);

  if (lessons.length < 2) return null;

  return (
    <div>
      <p className="text-xs text-slate-500 mb-2">Focus areas per lesson (older → recent)</p>
      <div className="flex items-end gap-1 h-10">
        {lessons.map((f, i) => {
          const height = Math.max((f.focusAreaCodes.length / maxCodes) * 100, 8);
          const isMock = f.assessmentType === 'MOCK';
          return (
            <div key={f.id} className="flex-1 flex flex-col items-center gap-0.5" title={
              `${new Date(f.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} · ${f.focusAreaCodes.length} focus area${f.focusAreaCodes.length !== 1 ? 's' : ''}${isMock ? ' (Mock)' : ''}`
            }>
              <div
                className={`w-full rounded-t transition-all ${
                  isMock ? 'bg-sky-500' : 'bg-slate-500'
                }`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-600">Lesson 1</span>
        <span className="text-[10px] text-slate-600">Latest</span>
      </div>
      <div className="flex items-center gap-3 mt-1">
        <span className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="w-2 h-2 rounded-sm bg-slate-500 inline-block" /> Coaching
        </span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="w-2 h-2 rounded-sm bg-sky-500 inline-block" /> Mock
        </span>
      </div>
    </div>
  );
}

// ── Progress tab ─────────────────────────────────────────────────────────────

function ProgressTab({
  clientId,
  clientName,
  instructorTz,
}: {
  clientId: string;
  clientName: string;
  instructorTz: string;
}) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/instructor/lesson-feedback/summary?clientId=${clientId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!data || data.totalLessonsWithFeedback === 0) {
    return (
      <div className="py-12 text-center">
        <TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm mb-1">No feedback recorded for {clientName} yet</p>
        <p className="text-xs text-slate-600">Submit feedback after a completed lesson to see their progress here</p>
      </div>
    );
  }

  const feedbackRate = data.totalLessons > 0
    ? Math.round((data.totalLessonsWithFeedback / data.totalLessons) * 100)
    : 0;

  const latestFeedback = data.recentFeedback[0] ?? null;
  const latestTopics = latestFeedback?.lessonTopics
    ? latestFeedback.lessonTopics.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  return (
    <div className="space-y-4">

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-3 text-center">
          <BookOpen className="w-4 h-4 text-blue-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-slate-100">{data.totalLessonsWithFeedback}</p>
          <p className="text-[11px] text-slate-400">Reviewed</p>
        </div>
        <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-3 text-center">
          <TrendingUp className="w-4 h-4 text-green-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-slate-100">{feedbackRate}%</p>
          <p className="text-[11px] text-slate-400">Feedback rate</p>
        </div>
        <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-3 text-center">
          <Star className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-slate-100">
            {data.averageScore !== null ? `${data.averageScore}%` : '—'}
          </p>
          <p className="text-[11px] text-slate-400">Mock avg</p>
        </div>
      </div>

      {/* Trend chart */}
      {data.recentFeedback.length >= 2 && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-4">
          <h3 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wide">Lesson trend</h3>
          <SkillTrendBar feedback={data.recentFeedback} />
        </div>
      )}

      {/* Latest lesson summary */}
      {latestFeedback && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Latest lesson</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {new Date(latestFeedback.date).toLocaleDateString('en-AU', {
                  day: 'numeric', month: 'short', year: 'numeric', timeZone: instructorTz,
                })}
                {latestFeedback.assessmentType === 'MOCK' && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-sky-900/40 text-sky-300 text-[10px] rounded-full">Mock</span>
                )}
              </p>
            </div>
            {latestFeedback.assessmentType === 'MOCK' && latestFeedback.performanceScore !== null && (
              <span className={`text-lg font-bold ${
                latestFeedback.performanceScore >= 80 ? 'text-emerald-400' :
                latestFeedback.performanceScore >= 65 ? 'text-yellow-400' : 'text-red-400'
              }`}>{latestFeedback.performanceScore}%</span>
            )}
          </div>

          <div className="divide-y divide-slate-700/50">
            {/* Topics */}
            {latestTopics.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wide">Topics covered</p>
                <div className="flex flex-wrap gap-1.5">
                  {latestTopics.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Next lesson focus — prominent */}
            {latestFeedback.nextLessonFocus && (
              <div className="px-4 py-3 bg-sky-950/20 flex items-start gap-2">
                <Target className="w-3.5 h-3.5 text-sky-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-sky-400 uppercase tracking-wide mb-0.5">Next focus</p>
                  <p className="text-xs text-slate-200">{latestFeedback.nextLessonFocus}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top focus areas and strengths */}
      {(data.topFocusAreas.length > 0 || data.topStrengths.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {data.topFocusAreas.length > 0 && (
            <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-4">
              <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide mb-2">Top focus areas</p>
              <div className="space-y-1.5">
                {data.topFocusAreas.slice(0, 4).map((area, i) => (
                  <p key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5 shrink-0">→</span>
                    <span>{area}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
          {data.topStrengths.length > 0 && (
            <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-4">
              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide mb-2">Top strengths</p>
              <div className="space-y-1.5">
                {data.topStrengths.slice(0, 4).map((s, i) => (
                  <p key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                    <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Per-lesson feedback history */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Feedback history</p>
        </div>
        <div className="divide-y divide-slate-700/50">
          {data.recentFeedback.map(fb => {
            const isExpanded = expandedId === fb.id;
            const isMock = fb.assessmentType === 'MOCK';
            const hasDetail = fb.notes || fb.nextLessonFocus || fb.focusAreaCodes.length > 0 || fb.strengthCodes.length > 0;
            const topics = fb.lessonTopics ? fb.lessonTopics.split(',').map(t => t.trim()).filter(Boolean) : [];

            return (
              <div key={fb.id}>
                <button
                  onClick={() => hasDetail ? setExpandedId(isExpanded ? null : fb.id) : undefined}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left ${hasDetail ? 'hover:bg-slate-700/30 transition' : ''}`}
                >
                  {/* Date */}
                  <div className="w-12 shrink-0">
                    <p className="text-[11px] text-slate-500 leading-tight">
                      {new Date(fb.date).toLocaleDateString('en-AU', {
                        day: 'numeric', month: 'short', timeZone: instructorTz,
                      })}
                    </p>
                  </div>

                  {/* Summary */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isMock && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-900/40 text-sky-300 border border-sky-700/30">Mock</span>
                      )}
                      {isMock && fb.performanceScore !== null && (
                        <span className={`text-xs font-bold ${
                          fb.performanceScore >= 80 ? 'text-emerald-400' :
                          fb.performanceScore >= 65 ? 'text-yellow-400' : 'text-red-400'
                        }`}>{fb.performanceScore}%</span>
                      )}
                    </div>
                    {topics.length > 0 && (
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{topics.join(' · ')}</p>
                    )}
                    {!isMock && (
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {fb.strengthCodes.length > 0 ? `${fb.strengthCodes.length} strength${fb.strengthCodes.length !== 1 ? 's' : ''}` : ''}
                        {fb.strengthCodes.length > 0 && fb.focusAreaCodes.length > 0 ? ' · ' : ''}
                        {fb.focusAreaCodes.length > 0 ? `${fb.focusAreaCodes.length} focus area${fb.focusAreaCodes.length !== 1 ? 's' : ''}` : ''}
                      </p>
                    )}
                  </div>

                  {/* Next focus badge */}
                  {fb.nextLessonFocus && !isExpanded && (
                    <div title={fb.nextLessonFocus}>
                      <Target className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    </div>
                  )}

                  {hasDetail && (
                    isExpanded
                      ? <ChevronUp className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      : <ChevronDown className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  )}
                </button>

                {isExpanded && hasDetail && (
                  <div className="px-4 pb-3 bg-slate-700/20 space-y-2 border-t border-slate-700/50 pt-2.5">
                    {fb.nextLessonFocus && (
                      <div className="flex items-start gap-1.5">
                        <Target className="w-3 h-3 text-sky-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-sky-300">{fb.nextLessonFocus}</p>
                      </div>
                    )}
                    {fb.notes && (
                      <p className="text-xs text-slate-400 border-l-2 border-slate-600 pl-2 whitespace-pre-line">{fb.notes}</p>
                    )}
                    <Link
                      href={`/dashboard/bookings/${fb.bookingId}`}
                      className="text-[11px] text-blue-400 hover:text-blue-300 transition inline-block"
                    >
                      View booking →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'bookings' | 'progress';

export default function InstructorClientDetailPage() {
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [instructorTz, setInstructorTz] = useState(DEFAULT_TIMEZONE);
  const [activeTab, setActiveTab] = useState<Tab>('bookings');

  useEffect(() => {
    Promise.all([
      fetch(`/api/instructor/clients/${clientId}`).then(r => {
        if (r.status === 404) throw new Error('not_found');
        if (!r.ok) throw new Error('failed');
        return r.json();
      }),
      fetch('/api/instructor/settings').then(r => r.ok ? r.json() : null),
    ])
      .then(([clientData, settings]) => {
        setClient(clientData);
        if (settings?.timezone) setInstructorTz(resolveTimezone(settings.timezone));
      })
      .catch(e => setError(e.message === 'not_found' ? 'Client not found.' : 'Failed to load client.'))
      .finally(() => setLoading(false));
  }, [clientId]);

  const handleSendPaymentLink = async () => {
    if (!client) return;
    setSendingLink(true);
    setLinkError(null);
    try {
      const res = await fetch('/api/bookings/send-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, topUpAmount: 50 }),
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-sky-500" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-slate-300 mb-4">{error || 'Client not found.'}</p>
          <Link href="/dashboard/clients" className="text-sky-400 hover:underline text-sm">← Back to clients</Link>
        </div>
      </div>
    );
  }

  const completedBookings = client.bookings.filter(b => b.status === 'COMPLETED');
  const totalSpend = completedBookings.reduce((sum, b) => sum + b.price, 0);

  return (
    <div className="min-h-screen bg-slate-950 pb-24 text-slate-100">
      {/* Header */}
      <header className="bg-slate-950/95 border-b border-slate-800 sticky top-0 z-10 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard/clients" className="p-2 hover:bg-slate-800 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-lg font-bold text-slate-100 truncate">{client.name}</h1>
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
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-3">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-12 h-12 bg-sky-900/40 rounded-full flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <p className="font-bold text-slate-100">{client.name}</p>
              <p className="text-xs text-slate-500">
                Added {new Date(client.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-slate-300 hover:text-sky-400 transition">
              <Phone className="w-4 h-4 text-slate-500" /> {client.phone}
            </a>
            <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-slate-300 hover:text-sky-400 transition">
              <Mail className="w-4 h-4 text-slate-500" /> {client.email}
            </a>
            {client.addressText && (
              <div className="flex items-start gap-2 text-sm text-slate-300">
                <MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                <span>{client.addressText}</span>
              </div>
            )}
            {client.notes && (
              <div className="flex items-start gap-2 text-sm text-slate-400 italic">
                <FileText className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                <span>{client.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Wallet & stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 text-center">
            <Wallet className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-100">
              {client.walletBalance !== null ? `$${client.walletBalance.toFixed(2)}` : '—'}
            </p>
            <p className="text-xs text-slate-400">Wallet</p>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 text-center">
            <Calendar className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-100">{client.bookings.length}</p>
            <p className="text-xs text-slate-400">Bookings</p>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 text-center">
            <DollarSign className="w-5 h-5 text-purple-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-100">${totalSpend.toFixed(0)}</p>
            <p className="text-xs text-slate-400">Total Spend</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-col">
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
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-slate-600 text-slate-300 font-semibold rounded-xl hover:bg-slate-800 transition text-sm disabled:opacity-60"
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
          {linkError && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="shrink-0">❌</span>
              {linkError}
            </p>
          )}
        </div>

        {/* ── Tab switcher ──────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
          {(['bookings', 'progress'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === tab
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab === 'bookings'
                ? <><Calendar className="w-3.5 h-3.5" /> Bookings</>
                : <><TrendingUp className="w-3.5 h-3.5" /> Progress</>
              }
            </button>
          ))}
        </div>

        {/* ── Tab content ───────────────────────────────────────────────────── */}

        {activeTab === 'bookings' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <h2 className="font-semibold text-slate-100">Booking History</h2>
            </div>
            {client.bookings.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-500">
                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No bookings yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {client.bookings.map(b => (
                  <Link
                    key={b.id}
                    href={`/dashboard/bookings/${b.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-800/50 transition"
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
                          {new Date(b.startTime).toLocaleDateString('en-AU', {
                            day: 'numeric', month: 'short', year: 'numeric', timeZone: instructorTz,
                          })}
                          {b.duration ? ` · ${b.duration >= 60 ? `${b.duration / 60}h` : `${b.duration}min`}` : ''}
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-100">${b.price.toFixed(2)}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'progress' && (
          <ProgressTab
            clientId={client.id}
            clientName={client.name}
            instructorTz={instructorTz}
          />
        )}

      </div>
    </div>
  );
}
