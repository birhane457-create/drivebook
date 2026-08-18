'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, Star, BookOpen, ChevronDown, ChevronUp,
  Loader2, Target, CheckCircle, AlertCircle, HelpCircle,
} from 'lucide-react';
import Link from 'next/link';

// ── Types from /api/client/progress ──────────────────────────────────────────

interface FeedbackEntry {
  category: string;
  text: string;
  tip: string;
}

interface LatestLesson {
  date: string;
  instructorName: string;
  assessmentType: string;
  topics: string[];
  strengths: FeedbackEntry[];
  focusAreas: FeedbackEntry[];
  nextLessonFocus: string | null;
  isMockAssessment: boolean;
  mockScore: number | null;
  mockPassed: boolean | null;
}

interface SkillSummary {
  category: string;
  displayName: string;
  state: 'NEEDS_ATTENTION' | 'IMPROVING' | 'GOOD' | 'NOT_OBSERVED';
  stateLabel: string;
  recentObservation: string | null;
}

interface MockAssessment {
  date: string;
  score: number;
  passed: boolean | null;
  assessmentLabel: string;
  disclaimer: string;
}

interface LessonHistoryItem {
  id: string;
  date: string;
  assessmentType: string;
  topics: string[];
  focusAreaCount: number;
  strengthCount: number;
  topFocusAreas: string[];
  topStrengths: string[];
  nextLessonFocus: string | null;
  mockScore: number | null;
  mockPassed: boolean | null;
}

interface ProgressData {
  hasData: boolean;
  studentName: string;
  latestLesson: LatestLesson | null;
  skills: SkillSummary[];
  mockAssessments: MockAssessment[];
  lessonHistory: LessonHistoryItem[];
  meta: { totalLessonsWithFeedback: number; skillWindow: number };
}

// ── Skill state styling ───────────────────────────────────────────────────────

const SKILL_CONFIG = {
  GOOD:            { icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-700/30' },
  IMPROVING:       { icon: <TrendingUp  className="w-3.5 h-3.5" />, color: 'text-sky-400',     bg: 'bg-sky-900/20 border-sky-700/30' },
  NEEDS_ATTENTION: { icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'text-amber-400',   bg: 'bg-amber-900/20 border-amber-700/30' },
  NOT_OBSERVED:    { icon: <HelpCircle  className="w-3.5 h-3.5" />, color: 'text-slate-500',   bg: 'bg-slate-800/40 border-slate-700/30' },
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClientProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [showAllSkills, setShowAllSkills] = useState(false);

  useEffect(() => {
    fetch('/api/client/progress')
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center pb-24">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-sky-500 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading your progress...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.hasData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-1">Your Progress</h1>
          <p className="text-slate-400 text-sm mb-8">Track your learning journey</p>
          <div className="bg-slate-900/60 rounded-3xl border border-white/10 p-12 text-center">
            <TrendingUp className="h-14 w-14 text-slate-600 mx-auto mb-4" />
            <h3 className="text-base font-semibold mb-2">No feedback yet</h3>
            <p className="text-slate-400 text-sm mb-6">
              After each lesson your instructor will record feedback here.
              You'll get a notification when it's ready.
            </p>
            <Link
              href="/client-dashboard/bookings"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 rounded-xl text-sm font-semibold hover:bg-slate-700 border border-slate-700 transition"
            >
              <BookOpen className="h-4 w-4" /> View Bookings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { latestLesson, skills, mockAssessments, lessonHistory } = data;

  // Separate skills into observed and not-yet-observed
  const observedSkills = skills.filter(s => s.state !== 'NOT_OBSERVED');
  const notObservedSkills = skills.filter(s => s.state === 'NOT_OBSERVED');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <div>
          <h1 className="text-2xl font-bold mb-0.5">Your Progress</h1>
          <p className="text-slate-400 text-sm">Based on feedback from your instructor</p>
        </div>

        {/* ── Latest lesson feedback ──────────────────────────────────────────── */}
        {latestLesson && (
          <div className="bg-slate-900/60 rounded-3xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Latest lesson</p>
                  <p className="text-sm font-semibold text-slate-100">
                    {new Date(latestLesson.date).toLocaleDateString('en-AU', {
                      weekday: 'long', day: 'numeric', month: 'long',
                    })}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{latestLesson.instructorName}</p>
                </div>
                {latestLesson.isMockAssessment && latestLesson.mockScore !== null && (
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${
                      latestLesson.mockScore >= 80 ? 'text-emerald-400' :
                      latestLesson.mockScore >= 65 ? 'text-yellow-400' : 'text-red-400'
                    }`}>{latestLesson.mockScore}%</p>
                    <p className="text-xs text-slate-400">Mock assessment</p>
                  </div>
                )}
              </div>

              {/* Topics covered */}
              {latestLesson.topics.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {latestLesson.topics.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded-full border border-slate-700">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="divide-y divide-white/5">
              {/* What you did well */}
              {latestLesson.strengths.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2">
                    What you did well
                  </p>
                  <div className="space-y-2">
                    {latestLesson.strengths.map((s, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm text-slate-200">{s.text}</p>
                          <p className="text-xs text-slate-500">{s.category}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Focus for improvement */}
              {latestLesson.focusAreas.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
                    Focus for improvement
                  </p>
                  <div className="space-y-3">
                    {latestLesson.focusAreas.map((f, i) => (
                      <div key={i}>
                        <div className="flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm text-slate-200">{f.text}</p>
                            <p className="text-xs text-slate-500">{f.category}</p>
                          </div>
                        </div>
                        {f.tip && (
                          <p className="text-xs text-slate-500 mt-1 ml-6.5 pl-0.5">
                            💡 {f.tip}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next lesson focus — prominent */}
              {latestLesson.nextLessonFocus && (
                <div className="px-5 py-4 bg-sky-950/20">
                  <div className="flex items-start gap-2.5">
                    <Target className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-sky-400 uppercase tracking-wide mb-1">
                        Your next focus
                      </p>
                      <p className="text-sm text-slate-200">
                        {latestLesson.nextLessonFocus}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Your development (skill states) ────────────────────────────────── */}
        {observedSkills.length > 0 && (
          <div className="bg-slate-900/60 rounded-3xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="font-semibold text-slate-100">Your development</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Based on your last {data.meta.skillWindow} lessons with feedback
              </p>
            </div>

            <div className="divide-y divide-white/5">
              {/* Observed skills */}
              {observedSkills.map(skill => {
                const cfg = SKILL_CONFIG[skill.state];
                return (
                  <div key={skill.category} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200">{skill.displayName}</p>
                      {skill.recentObservation && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{skill.recentObservation}</p>
                      )}
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium shrink-0 ${cfg.bg} ${cfg.color}`}>
                      {cfg.icon}
                      {skill.stateLabel}
                    </div>
                  </div>
                );
              })}

              {/* Not yet observed — collapsed by default */}
              {notObservedSkills.length > 0 && (
                <>
                  <button
                    onClick={() => setShowAllSkills(v => !v)}
                    className="w-full px-5 py-3 flex items-center justify-between text-xs text-slate-500 hover:text-slate-400 hover:bg-slate-800/30 transition"
                  >
                    <span>{notObservedSkills.length} areas not yet observed</span>
                    {showAllSkills ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showAllSkills && notObservedSkills.map(skill => (
                    <div key={skill.category} className="px-5 py-3 flex items-center justify-between gap-3 opacity-50">
                      <p className="text-sm text-slate-400">{skill.displayName}</p>
                      <span className="text-xs text-slate-600 shrink-0">Not yet observed</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Mock assessments ────────────────────────────────────────────────── */}
        {mockAssessments.length > 0 && (
          <div className="bg-slate-900/60 rounded-3xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="font-semibold text-slate-100">Mock assessments</h2>
            </div>
            <div className="divide-y divide-white/5">
              {mockAssessments.map((m, i) => (
                <div key={i} className="px-5 py-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-200">
                      {new Date(m.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className={`text-xs font-semibold mt-0.5 ${
                      m.assessmentLabel === 'On track' ? 'text-emerald-400' :
                      m.assessmentLabel === 'Improvement recommended' ? 'text-amber-400' :
                      'text-slate-400'
                    }`}>
                      {m.assessmentLabel}
                    </p>
                  </div>
                  <p className={`text-2xl font-bold ${
                    m.score >= 80 ? 'text-emerald-400' :
                    m.score >= 65 ? 'text-yellow-400' : 'text-red-400'
                  }`}>{m.score}%</p>
                </div>
              ))}
            </div>
            {/* Disclaimer — always shown */}
            <div className="px-5 py-3 bg-slate-800/30 border-t border-white/5">
              <p className="text-xs text-slate-500">
                {mockAssessments[0]?.disclaimer}
              </p>
            </div>
          </div>
        )}

        {/* ── Lesson history ───────────────────────────────────────────────────── */}
        {lessonHistory.length > 0 && (
          <div className="bg-slate-900/60 rounded-3xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="font-semibold text-slate-100">Lesson history</h2>
              <p className="text-xs text-slate-500 mt-0.5">{data.meta.totalLessonsWithFeedback} lessons with feedback</p>
            </div>
            <div className="divide-y divide-white/5">
              {lessonHistory.map(lesson => {
                const isExpanded = expandedLesson === lesson.id;
                const isMock = lesson.assessmentType === 'MOCK';
                const hasDetail = lesson.topFocusAreas.length > 0 || lesson.topStrengths.length > 0 || lesson.nextLessonFocus;

                return (
                  <div key={lesson.id}>
                    <button
                      onClick={() => hasDetail ? setExpandedLesson(isExpanded ? null : lesson.id) : undefined}
                      className={`w-full flex items-center gap-3 px-5 py-3.5 text-left ${hasDetail ? 'hover:bg-slate-800/30 transition' : ''}`}
                    >
                      {/* Date */}
                      <div className="w-14 shrink-0">
                        <p className="text-xs text-slate-500 leading-tight">
                          {new Date(lesson.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>

                      {/* Summary */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isMock ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-sky-900/30 text-sky-300 border border-sky-700/30">
                              🎯 Mock
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/30">
                              🟢 Coaching
                            </span>
                          )}
                          {isMock && lesson.mockScore !== null && (
                            <span className={`text-xs font-bold ${
                              lesson.mockScore >= 80 ? 'text-emerald-400' :
                              lesson.mockScore >= 65 ? 'text-yellow-400' : 'text-red-400'
                            }`}>{lesson.mockScore}%</span>
                          )}
                        </div>
                        {lesson.topics.length > 0 && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {lesson.topics.join(' · ')}
                          </p>
                        )}
                        {!isMock && (lesson.focusAreaCount > 0 || lesson.strengthCount > 0) && (
                          <p className="text-xs text-slate-600 mt-0.5">
                            {lesson.strengthCount > 0 ? `${lesson.strengthCount} strength${lesson.strengthCount !== 1 ? 's' : ''}` : ''}
                            {lesson.strengthCount > 0 && lesson.focusAreaCount > 0 ? ' · ' : ''}
                            {lesson.focusAreaCount > 0 ? `${lesson.focusAreaCount} focus area${lesson.focusAreaCount !== 1 ? 's' : ''}` : ''}
                          </p>
                        )}
                      </div>

                      {hasDetail && (
                        isExpanded
                          ? <ChevronUp className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          : <ChevronDown className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      )}
                    </button>

                    {isExpanded && hasDetail && (
                      <div className="px-5 pb-4 bg-slate-800/20 space-y-2 border-t border-white/5 pt-3">
                        {lesson.topStrengths.length > 0 && (
                          <div>
                            <p className="text-xs text-emerald-400 mb-1">Did well</p>
                            {lesson.topStrengths.map((s, i) => (
                              <p key={i} className="text-xs text-slate-300 flex items-center gap-1.5">
                                <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />{s}
                              </p>
                            ))}
                          </div>
                        )}
                        {lesson.topFocusAreas.length > 0 && (
                          <div>
                            <p className="text-xs text-amber-400 mb-1">Focus areas</p>
                            {lesson.topFocusAreas.map((f, i) => (
                              <p key={i} className="text-xs text-slate-300 flex items-center gap-1.5">
                                <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />{f}
                              </p>
                            ))}
                          </div>
                        )}
                        {lesson.nextLessonFocus && (
                          <div className="flex items-start gap-1.5 pt-1">
                            <Target className="w-3 h-3 text-sky-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-sky-300">{lesson.nextLessonFocus}</p>
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

        {/* Footer */}
        <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl">
          <p className="text-xs text-slate-500 leading-relaxed">
            <span className="font-medium text-slate-400">🟢 Coaching lessons</span> show what you practised and what to focus on — no score.{' '}
            <span className="font-medium text-slate-400">🎯 Mock assessments</span> produce a score similar to the real test.{' '}
            Follow your instructor's advice on when you're ready to book your test.
          </p>
        </div>

      </div>
    </div>
  );
}
