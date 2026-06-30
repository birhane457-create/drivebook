'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Star, Users, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

interface FeedbackSummary {
  totalLessonsWithFeedback: number;
  totalLessons: number;
  averageScore: number | null;
  recentFeedback: Array<{
    id: string;
    bookingId: string;
    clientName: string;
    date: string;
    performanceScore: number | null;
    feedbackCodes: number[];
    strengthCodes: number[];
    notes: string | null;
  }>;
  topFocusAreas: string[];
  topStrengths: string[];
}

export default function InstructorProgressPage() {
  const [data, setData] = useState<FeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/instructor/lesson-feedback/summary')
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // If API doesn't exist yet, show a useful placeholder
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
              <li>• Select PDA assessment codes for areas needing improvement</li>
              <li>• Mark student strengths and give an overall performance score</li>
              <li>• Students see their progress in their dashboard</li>
              <li>• You can track improvement trends here over time</li>
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
        <p className="text-slate-400 mb-6">Lesson feedback you've recorded across all students</p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Lessons Reviewed', value: data.totalLessonsWithFeedback, icon: <BookOpen className="h-5 w-5 text-blue-400" /> },
            { label: 'Feedback Rate', value: `${feedbackRate}%`, icon: <TrendingUp className="h-5 w-5 text-green-400" /> },
            { label: 'Avg Score', value: data.averageScore ? `${data.averageScore}%` : '—', icon: <Star className="h-5 w-5 text-yellow-400" /> },
            { label: 'Total Lessons', value: data.totalLessons, icon: <Users className="h-5 w-5 text-purple-400" /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 p-4 hover:bg-slate-900/80 transition">
              <div className="flex items-center gap-2 mb-1">{icon}<p className="text-xs text-slate-400">{label}</p></div>
              <p className="text-2xl font-bold text-slate-100">{value}</p>
            </div>
          ))}
        </div>

        {/* Common focus areas */}
        {data.topFocusAreas.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 p-5">
              <h3 className="font-semibold text-orange-300 mb-3">Most Common Focus Areas</h3>
              <div className="flex flex-wrap gap-2">
                {data.topFocusAreas.map((area, i) => (
                  <span key={i} className="px-2.5 py-1 bg-orange-900/30 text-orange-300 text-xs rounded-full border border-orange-700/50">{area}</span>
                ))}
              </div>
            </div>
            <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 p-5">
              <h3 className="font-semibold text-emerald-300 mb-3">Most Common Strengths</h3>
              <div className="flex flex-wrap gap-2">
                {data.topStrengths.map((s, i) => (
                  <span key={i} className="px-2.5 py-1 bg-green-900/30 text-green-300 text-xs rounded-full border border-green-700/50">{s}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent feedback */}
        <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="font-semibold text-slate-100">Recent Lesson Feedback</h2>
          </div>
          {data.recentFeedback.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <p>No feedback recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {data.recentFeedback.map(fb => {
                const isExpanded = expandedId === fb.id;
                return (
                  <div key={fb.id}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : fb.id)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 transition text-left"
                    >
                      <div>
                        <p className="font-medium text-slate-100">{fb.clientName}</p>
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
                      <div className="px-5 pb-4 bg-slate-800/30 space-y-3 text-sm">
                        {fb.notes && (
                          <p className="text-slate-300 bg-blue-900/20 border-l-4 border-blue-500 px-3 py-2 rounded">
                            💬 {fb.notes}
                          </p>
                        )}
                        <div className="flex gap-3">
                          <Link
                            href={`/dashboard/bookings/${fb.bookingId}`}
                            className="text-xs text-blue-400 hover:text-blue-300 transition"
                          >
                            View booking →
                          </Link>
                        </div>
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
