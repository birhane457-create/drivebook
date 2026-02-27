'use client';

import { useState, useEffect } from 'react';
import { Trophy, Target, TrendingUp, Book } from 'lucide-react';

interface PerformanceData {
  totalLessons: number;
  lessonsWithFeedback: number;
  averagePerformance: number | null;
  recentFeedback: Array<{
    id: string;
    date: string;
    instructor: string;
    performanceScore: number | null;
    feedback: string[];
    strengths: string[];
    notes: string | null;
  }>;
  strengths: string[];
  focusAreas: string[];
  progressChart: Array<{
    lesson: number;
    date: string;
    score: number | null;
  }>;
}

export default function ProgressPage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPerformance() {
      try {
        const response = await fetch('/api/client/my-performance');
        if (!response.ok) throw new Error('Failed to fetch performance data');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchPerformance();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your progress...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="w-full max-w-md border border-red-200 bg-red-50 rounded-lg p-6">
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.totalLessons === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Progress</h1>
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Book className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No lessons completed yet</p>
            <p className="text-gray-500 text-sm mt-2">
              Complete your first lesson to start tracking your progress
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Progress</h1>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-center">
              <Book className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900">{data.totalLessons}</p>
              <p className="text-gray-600 text-sm">Total Lessons</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-center">
              <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900">
                {data.averagePerformance || '—'}
              </p>
              <p className="text-gray-600 text-sm">Average Score</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-center">
              <Trophy className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900">{data.lessonsWithFeedback}</p>
              <p className="text-gray-600 text-sm">Lessons Reviewed</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-center">
              <Target className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900">
                {Math.round((data.lessonsWithFeedback / data.totalLessons) * 100)}%
              </p>
              <p className="text-gray-600 text-sm">Feedback Rate</p>
            </div>
          </div>
        </div>

        {/* Performance Chart - Simple Text representation since recharts not available */}
        {data.progressChart.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Performance Trend</h2>
            <div className="space-y-2">
              {data.progressChart.map((item) => (
                <div key={item.lesson} className="flex items-center gap-4">
                  <span className="w-20 text-sm text-gray-600">Lesson {item.lesson}</span>
                  <div className="flex-1">
                    {item.score ? (
                      <div 
                        className="bg-blue-500 rounded h-6 flex items-center justify-end pr-2 text-white text-xs font-semibold"
                        style={{ width: `${item.score}%` }}
                      >
                        {item.score}%
                      </div>
                    ) : (
                      <div className="text-gray-400 text-sm">No score</div>
                    )}
                  </div>
                  <span className="w-24 text-sm text-gray-500 text-right">{item.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strengths and Focus Areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Strengths */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-green-700 mb-4">Your Strengths</h3>
            {data.strengths.length > 0 ? (
              <ul className="space-y-3">
                {data.strengths.map((strength, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100 text-green-700 text-sm font-medium mr-3 flex-shrink-0">
                      ✓
                    </span>
                    <span className="text-gray-700">{strength}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No strengths recorded yet</p>
            )}
          </div>

          {/* Focus Areas */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-orange-700 mb-4">Areas to Improve</h3>
            {data.focusAreas.length > 0 ? (
              <ul className="space-y-3">
                {data.focusAreas.map((area, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-orange-100 text-orange-700 text-sm font-medium mr-3 flex-shrink-0">
                      •
                    </span>
                    <span className="text-gray-700">{area}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No focus areas yet</p>
            )}
          </div>
        </div>

        {/* Recent Feedback */}
        {data.recentFeedback.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Feedback</h2>
            <div className="space-y-4">
              {data.recentFeedback.map((lesson) => (
                <div key={lesson.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{lesson.instructor}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(lesson.date).toLocaleDateString()}
                      </p>
                    </div>
                    {lesson.performanceScore && (
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">{lesson.performanceScore}%</p>
                        <p className="text-xs text-gray-500">Score</p>
                      </div>
                    )}
                  </div>

                  {lesson.feedback.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Feedback:</p>
                      <div className="flex flex-wrap gap-2">
                        {lesson.feedback.map((item, idx) => (
                          <span key={idx} className="inline-block bg-red-100 text-red-700 text-xs px-3 py-1 rounded-full">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {lesson.strengths.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Strengths:</p>
                      <div className="flex flex-wrap gap-2">
                        {lesson.strengths.map((strength, idx) => (
                          <span key={idx} className="inline-block bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full">
                            {strength}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {lesson.notes && (
                    <p className="text-sm text-gray-700 bg-blue-50 p-2 rounded">
                      💬 <span className="font-semibold">Note:</span> {lesson.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
