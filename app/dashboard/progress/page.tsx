'use client';
import { DashboardPageLayout } from '@/components/ui'

import { useEffect, useState } from 'react';
import { TrendingUp, Star, Users, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { resolveTimezone, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';
import { useBusinessConfig } from '@/hooks/useBusinessConfig';

interface FeedbackSummary {
  totalLessonsWithFeedback: number;
  totalLessons: number;
  averageScore: number | null;
  recentFeedback: Array<{
    id: string;
    bookingId: string;
    customerName: string;
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
  const { customer, customers, customersLowercase, service, servicesLowercase } = useBusinessConfig()
  const [data, setData] = useState<FeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [instructorTz, setInstructorTz] = useState(DEFAULT_TIMEZONE);

  useEffect(() => {
    fetch('/api/instructor/settings')
      .then(r => r.ok ? r.json() : null)
      .then(s => { if (s?.timezone) setInstructorTz(resolveTimezone(s.timezone)); })
      .catch(() => {});

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
              <div className="max-w-4xl mx-auto px-4 py-8 bg-card/60 backdrop-blur rounded-2xl border border-border shadow-lg shadow-slate-950/20">
          <h1 className="text-2xl font-bold text-foreground mb-2">{customer} Progress</h1>
          <p className="text-muted-foreground mb-8">Track how your {customersLowercase} are progressing based on {servicesLowercase} feedback</p>

          <div className="bg-background/40 rounded-2xl border border-border shadow-sm p-12 text-center">
            <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No feedback data yet</h3>
            <p className="text-muted-foreground text-sm mb-6">
              After completing {servicesLowercase}, use the {service.toLowerCase()} feedback form to record {customer.toLowerCase()} performance.
              Progress charts will appear here once you have feedback data.
            </p>
            <Link
              href="/dashboard/bookings"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-card text-foreground rounded-lg text-sm font-semibold hover:bg-secondary border border-border transition"
            >
              <BookOpen className="h-4 w-4" />
              Go to Bookings
            </Link>
          </div>

          <div className="mt-6 bg-card/60 backdrop-blur border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-foreground mb-2">How {service.toLowerCase()} feedback works</h3>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>• After each {service.toLowerCase()}, open the booking and tap "Give Feedback"</li>
              <li>• Select PDA assessment codes for areas needing improvement</li>
              <li>• Mark {customer.toLowerCase()} strengths and give an overall performance score</li>
              <li>• {customers} see their progress in their dashboard</li>
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
          <div className="max-w-4xl mx-auto px-4 py-8 bg-card/60 backdrop-blur rounded-2xl border border-border shadow-lg shadow-slate-950/20">
        <h1 className="text-2xl font-bold text-foreground mb-2">{customer} Progress</h1>
        <p className="text-muted-foreground mb-6">{service} feedback you've recorded across all {customersLowercase}</p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Lessons Reviewed', value: data.totalLessonsWithFeedback, icon: <BookOpen className="h-5 w-5 text-primary" /> },
            { label: 'Feedback Rate', value: `${feedbackRate}%`, icon: <TrendingUp className="h-5 w-5 text-emerald-400" /> },
            { label: 'Avg Score', value: data.averageScore ? `${data.averageScore}%` : '—', icon: <Star className="h-5 w-5 text-yellow-400" /> },
            { label: 'Total Lessons', value: data.totalLessons, icon: <Users className="h-5 w-5 text-purple-400" /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-card/60 backdrop-blur rounded-2xl border border-border shadow-lg shadow-slate-950/20 p-4 hover:bg-card/80 transition">
              <div className="flex items-center gap-2 mb-1">{icon}<p className="text-xs text-muted-foreground">{label}</p></div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Common focus areas */}
        {data.topFocusAreas.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="bg-card/60 backdrop-blur rounded-2xl border border-border shadow-lg shadow-slate-950/20 p-5">
              <h3 className="font-semibold text-orange-300 mb-3">Most Common Focus Areas</h3>
              <div className="flex flex-wrap gap-2">
                {data.topFocusAreas.map((area, i) => (
                  <span key={i} className="px-2.5 py-1 bg-orange-900/30 text-orange-300 text-xs rounded-full border border-orange-700/50">{area}</span>
                ))}
              </div>
            </div>
            <div className="bg-card/60 backdrop-blur rounded-2xl border border-border shadow-lg shadow-slate-950/20 p-5">
              <h3 className="font-semibold text-emerald-300 mb-3">Most Common Strengths</h3>
              <div className="flex flex-wrap gap-2">
                {data.topStrengths.map((s, i) => (
                  <span key={i} className="px-2.5 py-1 bg-green-900/30 text-emerald-400 text-xs rounded-full border border-green-700/50">{s}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent feedback */}
        <div className="bg-card/60 backdrop-blur rounded-2xl border border-border shadow-lg shadow-slate-950/20 overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Recent Lesson Feedback</h2>
          </div>
          {data.recentFeedback.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
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
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/50 transition text-left"
                    >
                      <div>
                        <p className="font-medium text-foreground">{fb.customerName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(fb.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: instructorTz })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {fb.performanceScore !== null && (
                          <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${
                            fb.performanceScore >= 85 ? 'bg-green-900/30 text-emerald-400 border border-green-700/50' :
                            fb.performanceScore >= 70 ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-700/50' :
                            'bg-red-900/30 text-destructive border border-red-700/50'
                          }`}>{fb.performanceScore}%</span>
                        )}
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-4 bg-secondary/30 space-y-3 text-sm">
                        {fb.notes && (
                          <p className="text-foreground bg-blue-900/20 border-l-4 border-blue-500 px-3 py-2 rounded">
                            💬 {fb.notes}
                          </p>
                        )}
                        <div className="flex gap-3">
                          <Link
                            href={`/dashboard/bookings/${fb.bookingId}`}
                            className="text-xs text-primary hover:text-primary transition"
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
