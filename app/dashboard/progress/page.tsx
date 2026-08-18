'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Star, Users, BookOpen, ChevronDown, ChevronUp, Target } from 'lucide-react';
import Link from 'next/link';
import { resolveTimezone, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';

// ── Types from /api/instructor/lesson-feedback/summary ───────────────────────

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

interface FeedbackSummary {
  totalLessonsWithFeedback: number;
  totalLessons: number;
  averageScore: number | null; // MOCK only
  mockCount: number;
  coachingCount: number;
  recentFeedback: RecentFeedback[];
  topFocusAreas: string[];
  topStrengths: string[];
}

export default function InstructorProgressPage() {
  const [data, setData] = useState<FeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [instructorTz, setInstructorTz] = useState(DEFAULT_TIMEZONE);

  useEffect(() => {
    Promise.all([
      fetch('/api/instructor/settings').then(r => r.ok ? r.json() : null),
      fetch('/api/instructor/lesson-feedback/summary').then(r => r.ok ? r.json() : null),
    ]).then(([settings, summary]) => {
      if (settings?.timezone) setInstructorTz(resolveTimezone(settings.timezone));
      setData(summary);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Student Progress</h1>
        <p className="text-slate-400 mb-8">Track how your students are progressing based on lesson feedback</p>

        <div className="bg-slate-950/40 rounded-3xl border border-white/10 shadow-sm p-12 text-center">
          <TrendingUp className="h-16 w-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-100 mb-2">No feedback data yet</h3>
          <p className="text-slate-400 text-sm mb-6">
            After completing lessons, use the lesson feedback form to record student performance.
            Progress charts will appear here once you have feedback data.
          </p>
          <Link
            href="/dashboard/bookings"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 border border-slate-700 transition"
          >
            <BookOpen className="h-4 w-4" />
            Go to Bookings
          </Link>
        </div>

        <div className="mt-6 bg-slate-900/60 backdrop-blur border border-white/10 rounded-3xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-100 mb-2">How lesson feedback works</h3>
          <ul className="text-sm text-slate-400 space-y-1.5">
            <li>• After each lesson, open the booking and tap "Give Feedback"</li>
            <li>• Record focus areas (things to improve) and strengths (what went well)</li>
            <li>• Set the next lesson focus so the student knows what to prepare for</li>
            <li>• For mock assessments, select MOCK type — a score is calculated</li>
            <li>• Students see their progress in their dashboard</li>
          </ul>
        </div>
      </div>
    );
  }

  const feedbackRate = data.totalLessons > 0
    ? Math.round((data.totalLessonsWithFeedback / data.totalLessons) * 100)
    : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Student Progress</h1>
      <p className="text-slate-400 mb-6">Lesson feedback recorded across all your students</p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Lessons Reviewed',
            value: data.totalLessonsWithFeedback,
            icon: <BookOpen className="h-5 w-5 text-blue-400" />,
          },
          {
            label: 'Feedback Rate',
            value: `${feedbackRate}%`,
            icon: <TrendingUp className="h-5 w-5 text-green-400" />,
          },
          {
            // Average score from MOCK assessments only — null means no mocks yet
            label: 'Mock Avg Score',
            value: data.averageScore !== null ? `${data.averageScore}%` : '—',
            icon: <Star className="h-5 w-5 text-yellow-400" />,
            subtext: data.mockCount > 0 ? `${data.mockCount} mock${data.mockCount !== 1 ? 's' : ''}` : 'No mocks yet',
          },
          {
            label: 'Total Lessons',
            value: data.totalLessons,
            icon: <Users className="h-5 w-5 text-purple-400" />,
            subtext: `${data.coachingCount} coaching · ${data.mockCount} mock`,
          },
        ].map(({ label, value, icon, subtext }) => (
          <div
            key={label}
            className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 p-4 hover:bg-slate-900/80 transition"
          >
            <div className="flex items-center gap-2 mb-1">{icon}<p className="text-xs text-slate-400">{label}</p></div>
            <p className="text-2xl font-bold text-slate-100">{value}</p>
            {subtext && <p className="text-xs text-slate-500 mt-0.5">{subtext}</p>}
          </div>
        ))}
      </div>

      {/* Common focus areas + strengths */}
      {(data.topFocusAreas.length > 0 || data.topStrengths.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {data.topFocusAreas.length > 0 && (
            <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 p-5">
              <h3 className="font-semibold text-orange-300 mb-3">Most common focus areas</h3>
              <div className="flex flex-wrap gap-2">
                {data.topFocusAreas.map((area, i) => (
                  <span key={i} className="px-2.5 py-1 bg-orange-900/30 text-orange-300 text-xs rounded-full border border-orange-700/50">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}
          {data.topStrengths.length > 0 && (
            <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 p-5">
              <h3 className="font-semibold text-emerald-300 mb-3">Most common strengths</h3>
              <div className="flex flex-wrap gap-2">
                {data.topStrengths.map((s, i) => (
                  <span key={i} className="px-2.5 py-1 bg-green-900/30 text-green-300 text-xs rounded-full border border-green-700/50">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent feedback */}
      <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="font-semibold text-slate-100">Recent lesson feedback</h2>
        </div>
        {data.recentFeedback.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <p>No feedback recorded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {data.recentFeedback.map(fb => {
              const isExpanded = expandedId === fb.id;
              const isMock = fb.assessmentType === 'MOCK';
              const topics = fb.lessonTopics
                ? fb.lessonTopics.split(',').map(t => t.trim()).filter(Boolean)
                : [];

              return (
                <div key={fb.id}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : fb.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 transition text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-medium text-slate-100">{fb.clientName}</p>
                        {isMock && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-sky-900/30 text-sky-300 border border-sky-700/30">
                            🎯 Mock
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {new Date(fb.date).toLocaleDateString('en-AU', {
                          day: 'numeric', month: 'short', year: 'numeric', timeZone: instructorTz,
                        })}
                        {topics.length > 0 && ` · ${topics.join(', ')}`}
                      </p>
                      {fb.nextLessonFocus && (
                        <p className="text-xs text-sky-400 mt-0.5 flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          Next: {fb.nextLessonFocus}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      {/* Score only for MOCK */}
                      {isMock && fb.performanceScore !== null && (
                        <span className={`text-sm font-bold px-2.5 py-1 rounded-full border ${
                          fb.performanceScore >= 80
                            ? 'bg-green-900/30 text-green-300 border-green-700/50'
                            : fb.performanceScore >= 65
                            ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50'
                            : 'bg-red-900/30 text-red-300 border-red-700/50'
                        }`}>
                          {fb.performanceScore}%
                        </span>
                      )}
                      {/* COACHING: show count summary instead */}
                      {!isMock && (fb.focusAreaCodes.length > 0 || fb.strengthCodes.length > 0) && (
                        <span className="text-xs text-slate-500">
                          {fb.strengthCodes.length > 0 && `${fb.strengthCodes.length} ✓`}
                          {fb.strengthCodes.length > 0 && fb.focusAreaCodes.length > 0 && ' · '}
                          {fb.focusAreaCodes.length > 0 && `${fb.focusAreaCodes.length} →`}
                        </span>
                      )}
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4 text-slate-400" />
                        : <ChevronDown className="h-4 w-4 text-slate-400" />
                      }
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-4 bg-slate-800/30 space-y-3 text-sm border-t border-white/5">
                      {fb.notes && (
                        <p className="text-slate-300 bg-blue-900/20 border-l-4 border-blue-500 px-3 py-2 rounded mt-3">
                          💬 {fb.notes}
                        </p>
                      )}
                      <Link
                        href={`/dashboard/bookings/${fb.bookingId}`}
                        className="text-xs text-blue-400 hover:text-blue-300 transition inline-block mt-1"
                      >
                        View booking →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
