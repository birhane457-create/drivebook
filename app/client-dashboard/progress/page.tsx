'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Star, BookOpen, AlertCircle, ChevronDown, ChevronUp, Loader2, Target, Award } from 'lucide-react';
import Link from 'next/link';

interface FeedbackItem {
  id: string;
  date: string;
  instructor: string;
  performanceScore: number | null;
  assessmentType: 'COACHING' | 'MOCK' | 'OFFICIAL';
  lessonTopics: string[];
  passed: boolean | null;
  feedback: string[];
  strengths: string[];
  notes: string | null;
}

interface ProgressChartItem {
  lesson: number;
  date: string;
  score: number | null;
  assessmentType: string;
  passed: boolean | null;
}

interface PerformanceData {
  success: boolean;
  totalLessons: number;
  lessonsWithFeedback: number;
  averagePerformance: number | null;
  recentFeedback: FeedbackItem[];
  strengths: string[];
  focusAreas: string[];
  progressChart: ProgressChartItem[];
}

const ASSESSMENT_BADGE: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  COACHING: { label: 'Coaching Lesson',   icon: '🟢', bg: 'bg-emerald-900/40', text: 'text-emerald-300' },
  MOCK:     { label: 'Mock Assessment',   icon: '🎯', bg: 'bg-blue-900/40',    text: 'text-blue-300' },
  // OFFICIAL and future types render as MOCK styling until explicitly supported
}

export default function ClientProgressPage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/client/my-performance')
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center pb-24">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-400">Loading your progress...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.success) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-2">Your Progress</h1>
          <p className="text-slate-400 mb-8">Track your learning journey based on instructor feedback</p>
          <div className="bg-slate-900/60 rounded-3xl border border-white/10 p-12 text-center">
            <TrendingUp className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No feedback yet</h3>
            <p className="text-slate-400 text-sm mb-6">Complete lessons and your instructor will add coaching notes here.</p>
            <Link href="/client-dashboard/bookings" className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 rounded-lg text-sm font-semibold hover:bg-slate-700 border border-slate-700 transition">
              <BookOpen className="h-4 w-4" /> View Bookings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const feedbackRate = data.totalLessons > 0
    ? Math.round((data.lessonsWithFeedback / data.totalLessons) * 100) : 0;

  const mockCount = data.recentFeedback.filter(f => f.assessmentType === 'MOCK').length;
  const latestMock = data.recentFeedback.find(f => f.assessmentType === 'MOCK');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Your Progress</h1>
        <p className="text-slate-400 mb-6">Your learning journey with instructor coaching notes and assessments</p>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total Lessons', value: data.totalLessons, icon: <BookOpen className="h-4 w-4 text-blue-400" /> },
            { label: 'With Feedback', value: data.lessonsWithFeedback, icon: <Star className="h-4 w-4 text-yellow-400" /> },
            { label: 'Mock Tests', value: mockCount, icon: <Target className="h-4 w-4 text-blue-400" /> },
            {
              label: data.averagePerformance !== null ? 'Mock Avg Score' : 'Avg Score',
              value: data.averagePerformance !== null ? `${data.averagePerformance}%` : '—',
              icon: <TrendingUp className="h-4 w-4 text-purple-400" />
            },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-slate-900/60 rounded-2xl border border-white/10 p-4">
              <div className="flex items-center gap-1.5 mb-1">{icon}<p className="text-xs text-slate-400">{label}</p></div>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Latest mock result — highlighted card */}
        {latestMock && (
          <div className={`mb-6 rounded-2xl border p-5 ${
            latestMock.passed === true
              ? 'border-green-700/60 bg-green-950/30'
              : latestMock.passed === false
              ? 'border-amber-700/60 bg-amber-950/20'
              : 'border-blue-700/60 bg-blue-950/20'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Latest Mock Assessment</p>
                <p className="text-sm text-slate-300">{new Date(latestMock.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} · {latestMock.instructor}</p>
              </div>
              <div className="text-right">
                {latestMock.performanceScore !== null && (
                  <p className={`text-3xl font-bold ${
                    latestMock.performanceScore >= 80 ? 'text-green-400' :
                    latestMock.performanceScore >= 65 ? 'text-yellow-400' : 'text-red-400'
                  }`}>{latestMock.performanceScore}%</p>
                )}
                {latestMock.passed !== null && (
                  <p className={`text-sm font-bold mt-0.5 ${latestMock.passed ? 'text-green-400' : 'text-amber-400'}`}>
                    {latestMock.passed ? '✓ Ready for test' : 'Keep practising'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mock score chart — only when there are scored assessments */}
        {data.progressChart.length > 0 && (
          <div className="bg-slate-900/60 rounded-3xl border border-white/10 p-5 mb-8">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Award className="h-4 w-4 text-blue-400" />
              Assessment History
            </h3>
            <div className="space-y-2.5">
              {data.progressChart.map(item => (
                <div key={item.lesson} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-10 flex-shrink-0">{item.date}</span>
                  {item.score !== null ? (
                    <>
                      <div className="flex-1 max-w-xs">
                        <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all ${item.score >= 80 ? 'bg-green-500' : item.score >= 65 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                      </div>
                      <span className={`text-sm font-bold w-12 text-right ${
                        item.score >= 80 ? 'text-green-400' : item.score >= 65 ? 'text-yellow-400' : 'text-red-400'
                      }`}>{item.score}%</span>
                      {item.passed !== null && (
                        <span className={`text-xs ${item.passed ? 'text-green-500' : 'text-amber-500'}`}>
                          {item.passed ? '✓' : '✗'}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-slate-500">—</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strengths & Focus areas */}
        {(data.strengths.length > 0 || data.focusAreas.length > 0) && (
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            {data.strengths.length > 0 && (
              <div className="bg-slate-900/60 rounded-3xl border border-white/10 p-5">
                <h3 className="font-semibold text-emerald-300 mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4" /> Your Strengths
                </h3>
                <div className="space-y-1.5">
                  {data.strengths.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-green-900/20 border border-green-700/30 rounded-lg text-sm text-slate-300">
                      <span className="text-green-400">✓</span>{s}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.focusAreas.length > 0 && (
              <div className="bg-slate-900/60 rounded-3xl border border-white/10 p-5">
                <h3 className="font-semibold text-amber-300 mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Areas to Focus
                </h3>
                <div className="space-y-1.5">
                  {data.focusAreas.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-amber-900/20 border border-amber-700/30 rounded-lg text-sm text-slate-300">
                      <span className="text-amber-400">→</span>{a}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Lesson timeline ── */}
        <div>
          <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-slate-400" />
            Lesson History
          </h3>
          <div className="space-y-3">
            {data.recentFeedback.map(item => {
              const badge = ASSESSMENT_BADGE[item.assessmentType] ?? ASSESSMENT_BADGE.COACHING
              const isExpanded = expandedId === item.id
              const hasDetail = item.feedback.length > 0 || item.notes || item.lessonTopics.length > 0

              return (
                <div key={item.id} className="bg-slate-900/60 rounded-2xl border border-white/10 overflow-hidden">
                  <button
                    onClick={() => hasDetail ? setExpandedId(isExpanded ? null : item.id) : undefined}
                    className={`w-full flex items-start gap-3 p-4 text-left ${hasDetail ? 'hover:bg-slate-800/40 transition-colors' : ''}`}
                  >
                    {/* Date column */}
                    <div className="flex-shrink-0 w-14 text-center">
                      <p className="text-xs text-slate-500 leading-tight">
                        {new Date(item.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                          {badge.icon} {badge.label}
                        </span>
                        {item.assessmentType !== 'COACHING' && item.performanceScore !== null && (
                          <span className={`text-sm font-bold ${
                            item.performanceScore >= 80 ? 'text-green-400' :
                            item.performanceScore >= 65 ? 'text-yellow-400' : 'text-red-400'
                          }`}>{item.performanceScore}%</span>
                        )}
                        {item.passed !== null && (
                          <span className={`text-xs font-semibold ${item.passed ? 'text-green-400' : 'text-amber-400'}`}>
                            {item.passed ? '✓ Ready' : '✗ Not yet'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{item.instructor}</p>
                      {item.lessonTopics.length > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Topics: {item.lessonTopics.join(', ')}
                        </p>
                      )}
                    </div>

                    {hasDetail && (
                      isExpanded
                        ? <ChevronUp className="h-4 w-4 text-slate-500 flex-shrink-0 mt-1" />
                        : <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0 mt-1" />
                    )}
                  </button>

                  {isExpanded && hasDetail && (
                    <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                      {item.feedback.length > 0 && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Areas to work on:</p>
                          <div className="space-y-1">
                            {item.feedback.map((f, i) => (
                              <div key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                                <span className="text-amber-400 mt-0.5">→</span>{f}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.notes && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Instructor notes:</p>
                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{item.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-8 p-4 bg-slate-900/40 border border-white/5 rounded-2xl">
          <p className="text-xs text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-400">🟢 Coaching lessons</span> show topics covered and coaching notes — no score, just progress.
            {' '}<span className="font-semibold text-slate-400">🎯 Mock assessments</span> show a formal score like the real PDA test.
            {' '}Scores are a guide only — always follow your instructor's advice on test readiness.
          </p>
        </div>
      </div>
    </div>
  );
}
