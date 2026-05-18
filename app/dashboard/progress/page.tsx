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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // If API doesn't exist yet, show a useful placeholder
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Student Progress</h1>
          <p className="text-gray-500 mb-8">Track how your students are progressing based on lesson feedback</p>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <TrendingUp className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No feedback data yet</h3>
            <p className="text-gray-500 text-sm mb-6">
              After completing lessons, use the lesson feedback form to record student performance.
              Progress charts will appear here once you have feedback data.
            </p>
            <Link
              href="/dashboard/bookings"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
            >
              <BookOpen className="h-4 w-4" />
              Go to Bookings
            </Link>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="font-semibold text-blue-900 mb-2">How lesson feedback works</h3>
            <ul className="text-sm text-blue-800 space-y-1.5">
              <li>• After each lesson, open the booking and tap "Give Feedback"</li>
              <li>• Select PDA assessment codes for areas needing improvement</li>
              <li>• Mark student strengths and give an overall performance score</li>
              <li>• Students see their progress in their dashboard</li>
              <li>• You can track improvement trends here over time</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const feedbackRate = data.totalLessons > 0
    ? Math.round((data.totalLessonsWithFeedback / data.totalLessons) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Student Progress</h1>
        <p className="text-gray-500 mb-6">Lesson feedback you've recorded across all students</p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Lessons Reviewed', value: data.totalLessonsWithFeedback, icon: <BookOpen className="h-5 w-5 text-blue-600" /> },
            { label: 'Feedback Rate', value: `${feedbackRate}%`, icon: <TrendingUp className="h-5 w-5 text-green-600" /> },
            { label: 'Avg Score', value: data.averageScore ? `${data.averageScore}%` : '—', icon: <Star className="h-5 w-5 text-yellow-500" /> },
            { label: 'Total Lessons', value: data.totalLessons, icon: <Users className="h-5 w-5 text-purple-600" /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-1">{icon}<p className="text-xs text-gray-500">{label}</p></div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        {/* Common focus areas */}
        {data.topFocusAreas.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-orange-700 mb-3">Most Common Focus Areas</h3>
              <div className="flex flex-wrap gap-2">
                {data.topFocusAreas.map((area, i) => (
                  <span key={i} className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs rounded-full border border-orange-200">{area}</span>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-green-700 mb-3">Most Common Strengths</h3>
              <div className="flex flex-wrap gap-2">
                {data.topStrengths.map((s, i) => (
                  <span key={i} className="px-2.5 py-1 bg-green-50 text-green-700 text-xs rounded-full border border-green-200">{s}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent feedback */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Lesson Feedback</h2>
          </div>
          {data.recentFeedback.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <p>No feedback recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.recentFeedback.map(fb => {
                const isExpanded = expandedId === fb.id;
                return (
                  <div key={fb.id}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : fb.id)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition text-left"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{fb.clientName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(fb.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {fb.performanceScore !== null && (
                          <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${
                            fb.performanceScore >= 85 ? 'bg-green-100 text-green-700' :
                            fb.performanceScore >= 70 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>{fb.performanceScore}%</span>
                        )}
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-4 bg-gray-50 space-y-3 text-sm">
                        {fb.notes && (
                          <p className="text-gray-700 bg-blue-50 border-l-4 border-blue-400 px-3 py-2 rounded">
                            💬 {fb.notes}
                          </p>
                        )}
                        <div className="flex gap-3">
                          <Link
                            href={`/dashboard/bookings/${fb.bookingId}`}
                            className="text-xs text-blue-600 hover:underline"
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
    </div>
  );
}
