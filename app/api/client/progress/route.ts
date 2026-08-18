/**
 * GET /api/client/progress
 *
 * Returns a student's own lesson progress — structured, student-safe, plain English.
 *
 * Security:
 *   - Scoped to the authenticated client's userId only (IDOR protected)
 *   - instructorNotes are NEVER returned — private to instructor
 *   - PDA codes translated to plain English before leaving the server
 *
 * Response design:
 *   - Structured fields, not a raw Booking object
 *   - Skill states computed server-side (never trust client calculation)
 *   - COACHING and MOCK clearly separated
 *   - nextLessonFocus surfaced prominently
 *
 * Skill state logic:
 *   NEEDS_ATTENTION  — code appeared in lessonFeedback[] recently
 *   GOOD             — code appeared in studentStrengths[] recently
 *   IMPROVING        — previously in lessonFeedback[], subsequently in studentStrengths[]
 *   NOT_OBSERVED     — no meaningful observation exists for this category
 *
 * "Recently" = any of the last 5 lessons with feedback.
 * Time-based absence does NOT imply improving — only explicit observation counts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getFeedbackByCode,
  getCategoryDisplayName,
  PDACategory,
} from '@/lib/constants/pda-feedback-codes'

export const dynamic = 'force-dynamic'

// How many recent lessons to use for skill state calculation
const SKILL_WINDOW = 5

type SkillState = 'NEEDS_ATTENTION' | 'IMPROVING' | 'GOOD' | 'NOT_OBSERVED'

interface SkillSummary {
  category: string
  displayName: string
  state: SkillState
  stateLabel: string
  // The most recent observation text (plain English), if any
  recentObservation: string | null
}

function stateLabel(state: SkillState): string {
  switch (state) {
    case 'NEEDS_ATTENTION': return 'Keep practising'
    case 'IMPROVING':       return 'Improving'
    case 'GOOD':            return 'Good'
    case 'NOT_OBSERVED':    return 'Not yet observed'
  }
}

/**
 * Compute skill states across all PDA categories from a window of recent lessons.
 *
 * Rules (from product spec):
 *   GOOD            — code recorded in studentStrengths[] in the most recent observed lesson
 *   IMPROVING       — code was in lessonFeedback[] in earlier lessons AND
 *                     subsequently recorded in studentStrengths[] in a later lesson
 *   NEEDS_ATTENTION — code appears in lessonFeedback[] in the most recent observed lesson
 *   NOT_OBSERVED    — no explicit observation in either direction
 *
 * "Most recent" means the latest lesson in the window that mentioned the code at all.
 */
function computeSkillStates(
  lessons: Array<{
    focusCodes: number[]
    strengthCodes: number[]
  }>
): SkillSummary[] {
  // Build a per-code timeline across lessons (index 0 = most recent)
  const codeTimeline: Record<number, Array<'focus' | 'strength'>> = {}

  lessons.forEach(lesson => {
    lesson.focusCodes.forEach(code => {
      if (!codeTimeline[code]) codeTimeline[code] = []
      codeTimeline[code].push('focus')
    })
    lesson.strengthCodes.forEach(code => {
      if (!codeTimeline[code]) codeTimeline[code] = []
      codeTimeline[code].push('strength')
    })
  })

  // Build category-level state — take the worst/best state across codes in that category
  const categoryStates: Record<string, SkillState> = {}
  const categoryRecentText: Record<string, string> = {}

  for (const [codeStr, timeline] of Object.entries(codeTimeline)) {
    const code = Number(codeStr)
    const fb = getFeedbackByCode(code)
    if (!fb) continue

    const category = fb.category
    const mostRecent = timeline[0] // timeline is ordered most-recent-first via lesson order

    // Determine state for this code
    let codeState: SkillState
    if (mostRecent === 'strength') {
      // Check if it was ever a focus area before this — if so, it's Improving
      const wasFocusBefore = timeline.slice(1).includes('focus')
      codeState = wasFocusBefore ? 'IMPROVING' : 'GOOD'
    } else {
      // mostRecent === 'focus'
      codeState = 'NEEDS_ATTENTION'
    }

    // Category state = worst state among its codes
    // Priority: NEEDS_ATTENTION > IMPROVING > GOOD > NOT_OBSERVED
    const existing = categoryStates[category]
    const priority: Record<SkillState, number> = {
      NEEDS_ATTENTION: 3,
      IMPROVING: 2,
      GOOD: 1,
      NOT_OBSERVED: 0,
    }
    if (!existing || priority[codeState] > priority[existing]) {
      categoryStates[category] = codeState
      categoryRecentText[category] = fb.shortText
    }
  }

  // Build final list across all PDA categories
  return Object.values(PDACategory).map(category => {
    const state = categoryStates[category] ?? 'NOT_OBSERVED'
    return {
      category,
      displayName: getCategoryDisplayName(category),
      state,
      stateLabel: stateLabel(state),
      recentObservation: categoryRecentText[category] ?? null,
    }
  })
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the client record for this user
    const client = await prisma.client.findFirst({
      where: { userId: session.user.id },
      select: { id: true, name: true },
    })

    if (!client) {
      return NextResponse.json({ error: 'No client profile found' }, { status: 404 })
    }

    // Fetch all COMPLETED bookings for this client that have feedback
    // instructorNotes intentionally excluded — private to instructor
    const bookings: any[] = await prisma.booking.findMany({
      where: {
        clientId: client.id,
        status: 'COMPLETED',
        feedbackGivenAt: { not: null },
      },
      select: {
        id: true,
        startTime: true,
        lessonFeedback: true,
        studentStrengths: true,
        assessmentType: true,
        lessonTopics: true,
        performanceScore: true,
        passed: true,
        feedbackGivenAt: true,
        instructorNotes: true,
        // metadata: true,  // Not in schema - access via (booking as any).metadata
        instructor: {
          select: { name: true, id: true },
        },
      },
      orderBy: { startTime: 'desc' },
    })

    if (bookings.length === 0) {
      return NextResponse.json({
        hasData: false,
        latestLesson: null,
        skills: [],
        mockAssessments: [],
        lessonHistory: [],
      })
    }

    // ── Latest lesson (most recent with feedback) ────────────────────────────
    const latest = bookings[0]
    const latestMeta = (latest.metadata as any) ?? {}
    const latestFocusCodes = Array.isArray(latest.lessonFeedback)
      ? (latest.lessonFeedback as number[])
      : []
    const latestStrengthCodes = Array.isArray(latest.studentStrengths)
      ? (latest.studentStrengths as number[])
      : []
    const latestTopics = latest.lessonTopics
      ? latest.lessonTopics.split(',').map((t: string) => t.trim()).filter(Boolean)
      : []

    const latestLesson = {
      date: latest.startTime?.toISOString() ?? latest.feedbackGivenAt!.toISOString(),
      instructorName: latest.instructor?.name ?? 'Your instructor',
      assessmentType: latest.assessmentType ?? 'COACHING',
      topics: latestTopics,
      // Plain English translations — not raw codes
      strengths: latestStrengthCodes
        .map(code => getFeedbackByCode(code))
        .filter(Boolean)
        .map(fb => ({
          category: getCategoryDisplayName(fb!.category),
          text: fb!.shortText,
          tip: fb!.improvementTip,
        })),
      focusAreas: latestFocusCodes
        .map(code => getFeedbackByCode(code))
        .filter(Boolean)
        .map(fb => ({
          category: getCategoryDisplayName(fb!.category),
          text: fb!.shortText,
          tip: fb!.improvementTip,
        })),
      // nextLessonFocus — first-class, shown prominently to student
      nextLessonFocus: latestMeta.nextLessonFocus ?? null,
      // MOCK-only fields — null for COACHING lessons
      isMockAssessment: latest.assessmentType === 'MOCK',
      mockScore: latest.assessmentType === 'MOCK' ? latest.performanceScore : null,
      mockPassed: latest.assessmentType === 'MOCK' ? latest.passed : null,
    }

    // ── Skill states — computed from last SKILL_WINDOW lessons ───────────────
    const skillWindowLessons = bookings.slice(0, SKILL_WINDOW).map(b => ({
      focusCodes: Array.isArray(b.lessonFeedback) ? (b.lessonFeedback as number[]) : [],
      strengthCodes: Array.isArray(b.studentStrengths) ? (b.studentStrengths as number[]) : [],
    }))
    const skills = computeSkillStates(skillWindowLessons)

    // ── Mock assessments — historical record ─────────────────────────────────
    // Wording follows product spec: "Mock assessment readiness" not "test ready %"
    const mockAssessments = bookings
      .filter(b => b.assessmentType === 'MOCK' && b.performanceScore !== null)
      .map(b => ({
        date: b.startTime?.toISOString() ?? b.feedbackGivenAt!.toISOString(),
        score: b.performanceScore,
        passed: b.passed,
        // Student-safe label — not "87% test ready"
        assessmentLabel: b.passed === true
          ? 'On track'
          : b.passed === false
          ? 'Improvement recommended'
          : 'Completed',
        disclaimer: 'Based on your instructor\'s assessment. This is not an official result.',
      }))

    // ── Lesson history — plain English summary per lesson ────────────────────
    const lessonHistory = bookings.map(b => {
      const meta = (b.metadata as any) ?? {}
      const focusCodes = Array.isArray(b.lessonFeedback) ? (b.lessonFeedback as number[]) : []
      const strengthCodes = Array.isArray(b.studentStrengths) ? (b.studentStrengths as number[]) : []
      const topics = b.lessonTopics
        ? b.lessonTopics.split(',').map((t: string) => t.trim()).filter(Boolean)
        : []

      return {
        id: b.id,
        date: b.startTime?.toISOString() ?? b.feedbackGivenAt!.toISOString(),
        assessmentType: b.assessmentType ?? 'COACHING',
        topics,
        focusAreaCount: focusCodes.length,
        strengthCount: strengthCodes.length,
        // Only include top 2 of each for the history list — full detail on latest
        topFocusAreas: focusCodes.slice(0, 2).map(code => {
          const fb = getFeedbackByCode(code)
          return fb ? fb.shortText : null
        }).filter(Boolean),
        topStrengths: strengthCodes.slice(0, 2).map(code => {
          const fb = getFeedbackByCode(code)
          return fb ? fb.shortText : null
        }).filter(Boolean),
        nextLessonFocus: meta.nextLessonFocus ?? null,
        // MOCK only
        mockScore: b.assessmentType === 'MOCK' ? b.performanceScore : null,
        mockPassed: b.assessmentType === 'MOCK' ? b.passed : null,
      }
    })

    return NextResponse.json({
      hasData: true,
      studentName: client.name,
      latestLesson,
      skills,
      mockAssessments,
      lessonHistory,
      meta: {
        totalLessonsWithFeedback: bookings.length,
        skillWindow: SKILL_WINDOW,
      },
    })
  } catch (error) {
    console.error('[client/progress] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
