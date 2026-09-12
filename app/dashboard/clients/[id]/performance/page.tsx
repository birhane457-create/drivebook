'use client';
import { DashboardPageLayout } from '@/components/ui'

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface FeedbackCategory {
  id: string;
  name: string;
  description: string;
  feedbacks: Array<{
    code: number;
    text: string;
  }>;
}

interface Booking {
  id: string;
  startTime: string;
  duration: number;
  lessonFeedback: number[];
  feedbackGivenAt: string | null;
}

export default function ClientPerformancePage() {
  const params = useParams() as { customerId: string };
  const router = useRouter();
  const [performance, setPerformance] = useState<any>(null);
  const [categories, setCategories] = useState<FeedbackCategory[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<number[]>([]);
  const [performanceScore, setPerformanceScore] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const customerId = params.customerId;

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch performance report
        const perfResponse = await fetch(
          `/api/instructor/client-performance?customerId=${customerId}`
        );
        if (!perfResponse.ok) throw new Error('Failed to fetch performance');
        const perfData = await perfResponse.json();
        setPerformance(perfData);

        // Fetch feedback categories
        const catResponse = await fetch('/api/feedback/categories');
        if (!catResponse.ok) throw new Error('Failed to fetch categories');
        const catData = await catResponse.json();
        setCategories(catData.categories);

        // Fetch bookings with feedback
        const bookingResponse = await fetch(
          `/api/instructor/client-lesson-feedback?customerId=${customerId}&limit=20`
        );
        if (!bookingResponse.ok) throw new Error('Failed to fetch bookings');
        const bookingData = await bookingResponse.json();
        setBookings(bookingData.lessons);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [customerId]);

  const handleFeedbackToggle = (code: number) => {
    setSelectedFeedback((prev) =>
      prev.includes(code) ? prev.filter((c: any) => c !== code) : [...prev, code]
    );
  };

  const handleSubmitFeedback = async () => {
    if (!selectedBookingId || selectedFeedback.length === 0) {
      setError('Please select a lesson and at least one feedback item');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/instructor/lesson-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: selectedBookingId,
          feedback: selectedFeedback,
          performanceScore: performanceScore ? parseInt(performanceScore) : null,
          instructorNotes: notes || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to submit feedback');

      setSubmitSuccess(true);
      setSelectedBookingId(null);
      setSelectedFeedback([]);
      setPerformanceScore('');
      setNotes('');

      // Refresh performance data
      const perfResponse = await fetch(
        `/api/instructor/client-performance?customerId=${customerId}`
      );
      if (perfResponse.ok) {
        const perfData = await perfResponse.json();
        setPerformance(perfData);
      }

      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading performance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="border border-red-200 bg-destructive/10 rounded-lg p-6">
            <p className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentBooking = selectedBookingId
    ? bookings.find((b: any) => b.id === selectedBookingId)
    : null;

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="mb-4 px-4 py-2 border border-border rounded-lg text-muted-foreground hover:bg-background transition"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-foreground">
            {performance?.customer?.name}'s Performance Report
          </h1>
        </div>

        {submitSuccess && (
          <div className="mb-8 border border-green-200 bg-green-50 rounded-lg p-6">
            <p className="text-emerald-400 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Feedback submitted successfully!
            </p>
          </div>
        )}

        {error && (
          <div className="mb-8 border border-red-200 bg-destructive/10 rounded-lg p-6">
            <p className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {error}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Performance Overview */}
            <div className="bg-card rounded-lg border border-border p-6">
              <h3 className="text-lg font-bold text-foreground mb-4">Performance Overview</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground text-sm">Total Lessons</p>
                    <p className="text-2xl font-bold">{performance?.totalLessons}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">With Feedback</p>
                    <p className="text-2xl font-bold">
                      {performance?.lessonsWithFeedback}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Average Score</p>
                    <p className="text-2xl font-bold">
                      {performance?.averagePerformance || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Recent Trend</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {performance?.recentProgress?.trend === 'improving' ? '↗' : '↘'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Common Issues */}
            {performance?.commonIssues?.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="text-lg font-bold text-foreground mb-4">Top Issues to Address</h3>
                <div className="space-y-3">
                  {performance.commonIssues.map((issue: any) => (
                    <div
                      key={issue.code}
                      className="flex justify-between items-center p-3 bg-orange-50 rounded-lg"
                    >
                      <span className="font-semibold text-foreground">
                        {issue.description}
                      </span>
                      <span className="text-orange-600 font-bold">
                        {issue.occurrences}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Lessons */}
            {performance?.feedbackHistory?.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="text-lg font-bold text-foreground mb-4">Recent Feedback History</h3>
                <div className="space-y-3">
                  {performance.feedbackHistory.slice(0, 5).map((lesson: any) => (
                    <div
                      key={lesson.id}
                      className="p-3 border border-border rounded-lg hover:bg-background cursor-pointer transition"
                      onClick={() => setSelectedBookingId(lesson.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-foreground">
                            {new Date(lesson.date).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {lesson.feedbackCount} feedback items
                          </p>
                        </div>
                        {lesson.performanceScore && (
                          <span className="text-lg font-bold text-primary">
                            {lesson.performanceScore}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Add Feedback Form */}
          <div>
            <div className="sticky top-4 bg-card rounded-lg border border-border p-6 space-y-4">
              <h3 className="text-lg font-bold text-foreground">Add Lesson Feedback</h3>
              {/* Select Lesson */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Select Lesson
                </label>
                <select
                  value={selectedBookingId || ''}
                  onChange={(e) => {
                    setSelectedBookingId(e.target.value);
                    setSelectedFeedback([]);
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                  >
                    <option value="">Choose a lesson...</option>
                    {bookings.map((booking: any) => (
                      <option key={booking.id} value={booking.id}>
                        {new Date(booking.startTime).toLocaleDateString()} (
                        {booking.duration}h)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Performance Score */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Performance Score (0-100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={performanceScore}
                    onChange={(e) => setPerformanceScore(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                    placeholder="e.g., 85"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                    placeholder="Optional notes..."
                    rows={3}
                  />
                </div>

                {/* Feedback Selection */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-3">
                    Select Feedback Items ({selectedFeedback.length})
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {categories.map((category) => (
                      <div key={category.id} className="border-t pt-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                          {category.name}
                        </p>
                        <div className="space-y-1">
                          {category.feedbacks.map((feedback) => (
                            <label
                              key={feedback.code}
                              className="flex items-center gap-2 cursor-pointer hover:bg-primary/10 p-1 rounded"
                            >
                              <input
                                type="checkbox"
                                checked={selectedFeedback.includes(feedback.code)}
                                onChange={() => handleFeedbackToggle(feedback.code)}
                                className="rounded"
                              />
                              <span className="text-xs text-muted-foreground">
                                {feedback.text}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSubmitFeedback}
                  disabled={!selectedBookingId || submitting}
                  className="w-full px-4 py-2 bg-primary text-foreground rounded-lg hover:bg-primary/90 transition disabled:bg-muted-foreground"
                >
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
