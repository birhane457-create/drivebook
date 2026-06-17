'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Star, BookOpen, AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface FeedbackItem {
  id: string;
  date: string;
  instructor: string;
  performanceScore: number | null;
  feedback: string[];
  strengths: string[];
  notes: string | null;
}

interface PerformanceData {
  success: boolean;
  totalLessons: number;
  lessonsWithFeedback: number;
  averagePerformance: number | null;
  recentFeedback: FeedbackItem[];
  strengths: string[];
  focusAreas: string[];
  progressChart: Array<{ lesson: number; date: string; score: number | null }>;
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

  // If no data or error
  if (!data || !data.success) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Your Progress</h1>
          <p className="text-slate-400 mb-8">Track how you're progressing based on instructor feedback</p>

          <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 p-12 text-center">
            <TrendingUp className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-100 mb-2">No feedback data yet</h3>
            <p className="text-slate-400 text-sm mb-6">
              Complete lessons and have your instructor provide feedback. Your progress will appear here.
            </p>
            <Link
              href="/client-dashboard/bookings"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 border border-slate-700 transition"
            >
              <BookOpen className="h-4 w-4" />
              View Your Bookings
            </Link>
          </div>

          <div className="mt-6 bg-slate-900/60 backdrop-blur border border-white/10 rounded-3xl p-5 shadow-sm">
            <h3 className="font-semibold text-slate-100 mb-2">How lesson feedback works</h3>
            <ul className="text-sm text-slate-400 space-y-1.5">
              <li>• After each lesson, your instructor provides feedback on your performance</li>
              <li>• They rate your overall performance and note areas of strength</li>
              <li>• Areas to focus on are highlighted to help you improve</li>
              <li>• Your progress is tracked over time to show improvement trends</li>
              <li>• You can view detailed feedback and instructor notes for each lesson</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const feedbackRate = data.totalLessons > 0
    ? Math.round((data.lessonsWithFeedback / data.totalLessons) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Your Progress</h1>
        <p className="text-slate-400 mb-8">Feedback from your instructors on your lessons</p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Lessons', value: data.totalLessons, icon: <BookOpen className="h-5 w-5 text-blue-400" /> },
            { label: 'With Feedback', value: data.lessonsWithFeedback, icon: <Star className="h-5 w-5 text-yellow-400" /> },
            { label: 'Feedback Rate', value: `${feedbackRate}%`, icon: <TrendingUp className="h-5 w-5 text-green-400" /> },
            { label: 'Avg Score', value: data.averagePerformance ? `${data.averagePerformance}%` : '—', icon: <AlertCircle className="h-5 w-5 text-purple-400" /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 p-4 hover:bg-slate-900/80 transition">
              <div className="flex items-center gap-2 mb-1">{icon}<p className="text-xs text-slate-400">{label}</p></div>
              <p className="text-2xl font-bold text-slate-100">{value}</p>
            </div>
          ))}
        </div>

        {/* Strengths & Focus Areas */}
        {(data.strengths.length > 0 || data.focusAreas.length > 0) && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Strengths */}
            {data.strengths.length > 0 && (
              <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 p-6">
                <h3 className="font-semibold text-emerald-300 mb-4 flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Your Strengths
                </h3>
                <div className="space-y-2">
                  {data.strengths.map((strength, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-green-900/20 border border-green-700/30 rounded-lg">
                      <span className="text-green-400">✓</span>
                      <span className="text-slate-300">{strength}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Focus Areas */}
            {data.focusAreas.length > 0 && (
              <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 p-6">
                <h3 className="font-semibold text-amber-300 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Areas to Focus
                </h3>
                <div className="space-y-2">
                  {data.focusAreas.map((area, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-amber-900/20 border border-amber-700/30 rounded-lg">
                      <span className="text-amber-400">→</span>
                      <span className="text-slate-300">{area}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress Chart */}
        {data.progressChart.length > 0 && (
          <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 p-6 mb-8">
            <h3 className="font-semibold text-slate-100 mb-4">Performance Trend (Last 10 Lessons)</h3>
            <div className="space-y-3">
              {data.progressChart.map((item) => (
                <div key={item.lesson} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-xs font-semibold text-slate-500 w-12">Lesson {item.lesson}</span>
                    <span className="text-xs text-slate-400">{item.date}</span>
                  </div>
                  {item.score !== null ? (
                    <>
                      <div className="flex-1 max-w-xs mx-4">
                        <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              item.score >= 85
                                ? 'bg-green-500'
                                : item.score >= 70
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(item.score, 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className={`text-sm font-bold w-12 text-right ${
                        item.score >= 85
                          ? 'text-green-400'
                          : item.score >= 70
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      }`}>
                        {item.score}%
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-slate-500">No score</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Feedback */}
        {data.recentFeedback.length > 0 && (
          <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10">
              <h2 className="font-semibold text-slate-100">Recent Feedback</h2>
            </div>
            <div className="divide-y divide-slate-700">
              {data.recentFeedback.map(fb => {
                const isExpanded = expandedId === fb.id;
                return (
                  <div key={fb.id}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : fb.id)}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800/50 transition text-left"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-slate-100">{fb.instructor}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(fb.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {fb.performanceScore !== null && (
                          <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${
                            fb.performanceScore >= 85 ? 'bg-green-900/30 text-green-300 border border-green-700/50' :
                            fb.performanceScore >= 70 ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-700/50' :
                            'bg-red-900/30 text-red-300 border border-red-700/50'
                          }`}>{fb.performanceScore}%</span>
                        )}
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-6 pb-4 bg-slate-800/30 space-y-3 text-sm border-t border-white/5">
                        {/* Strengths */}
                        {fb.strengths.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-emerald-400 mb-2">Your Strengths:</p>
                            <div className="flex flex-wrap gap-2">
                              {fb.strengths.map((s, i) => (
                                <span key={i} className="px-2 py-1 bg-green-900/20 text-green-300 text-xs rounded-full border border-green-700/30">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Focus Areas */}
                        {fb.feedback.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-amber-400 mb-2">Areas to Focus:</p>
                            <div className="flex flex-wrap gap-2">
                              {fb.feedback.map((f, i) => (
                                <span key={i} className="px-2 py-1 bg-amber-900/20 text-amber-300 text-xs rounded-full border border-amber-700/30">
                                  {f}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Instructor Notes */}
                        {fb.notes && (
                          <div>
                            <p className="text-xs font-semibold text-blue-400 mb-2">Instructor Notes:</p>
                            <p className="text-slate-300 bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 text-sm">
                              💬 {fb.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State for Recent Feedback */}
        {data.lessonsWithFeedback === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No feedback yet</p>
            <p className="text-sm text-slate-500 mt-2">Complete a lesson to receive feedback from your instructor</p>
          </div>
        )}
      </div>
    </div>
  );
}
