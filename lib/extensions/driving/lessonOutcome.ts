/**
 * lib/extensions/driving/lessonOutcome.ts
 *
 * Helpers for reading and writing driving lesson outcome data.
 * Reads exclusively from DrivingLessonOutcome (Phase 2B table).
 *
 * D6 complete: fallback to Booking columns removed.
 * D7 pending: legacy Booking columns will be dropped via migration.
 */

import { prisma } from '@/lib/prisma'

export interface LessonOutcomeData {
  assessmentType:      string
  lessonTopics:        string | null
  passed:              boolean | null
  performanceScore:    number | null
  studentStrengths:    number[]
  focusAreas:          number[]
  lessonFeedback:      number[]
  instructorNotes:     string | null
  whiteboardSketchUrl: string | null
  feedbackGivenAt:     Date | null
}

const EMPTY_OUTCOME: LessonOutcomeData = {
  assessmentType: 'COACHING',
  lessonTopics: null, passed: null, performanceScore: null,
  studentStrengths: [], focusAreas: [], lessonFeedback: [],
  instructorNotes: null, whiteboardSketchUrl: null, feedbackGivenAt: null,
}

/**
 * Get lesson outcome data for a booking.
 * Reads from DrivingLessonOutcome. Returns empty defaults if no record exists.
 */
export async function getLessonOutcome(bookingId: string): Promise<LessonOutcomeData> {
  try {
    const outcome = await (prisma as any).drivingLessonOutcome.findUnique({
      where: { bookingId },
    })
    return outcome ? (outcome as LessonOutcomeData) : EMPTY_OUTCOME
  } catch {
    return EMPTY_OUTCOME
  }
}

/**
 * Merge outcome fields into a booking record shape.
 * API response shape stays identical — UI doesn't need to know data moved.
 *
 * If no DrivingLessonOutcome record exists (booking has no feedback yet),
 * the booking fields remain unchanged (will be null/empty).
 */
export async function mergeLessonOutcome<T extends Record<string, unknown>>(
  bookingId: string,
  booking: T
): Promise<T> {
  let outcome: LessonOutcomeData | null = null
  try {
    outcome = await (prisma as any).drivingLessonOutcome.findUnique({
      where: { bookingId },
    }) as LessonOutcomeData | null
  } catch {
    return booking
  }

  if (!outcome) return booking

  const outcomeFields = [
    'assessmentType', 'lessonTopics', 'passed', 'performanceScore',
    'studentStrengths', 'focusAreas', 'lessonFeedback',
    'instructorNotes', 'whiteboardSketchUrl', 'feedbackGivenAt',
  ] as const

  const merged = { ...booking }
  for (const field of outcomeFields) {
    if (outcome[field as keyof LessonOutcomeData] !== undefined) {
      ;(merged as any)[field] = outcome[field as keyof LessonOutcomeData]
    }
  }
  return merged as T
}

/**
 * Merge lesson outcomes into an array of booking records (batch).
 */
export async function mergeLessonOutcomes<T extends { id: string }>(
  bookings: T[]
): Promise<T[]> {
  if (bookings.length === 0) return bookings
  return Promise.all(bookings.map((b: any) => mergeLessonOutcome(b.id, b as any) as Promise<T>))
}

/**
 * Write lesson outcome data to DrivingLessonOutcome.
 * D6: no longer dual-writes to Booking columns.
 */
export async function saveLessonOutcome(
  bookingId: string,
  data: Partial<LessonOutcomeData>
): Promise<void> {
  try {
    await (prisma as any).drivingLessonOutcome.upsert({
      where: { bookingId },
      create: { bookingId, ...EMPTY_OUTCOME, ...data },
      update: data,
    })
  } catch (e) {
    console.error('[saveLessonOutcome] Failed to upsert extension record:', e)
  }
}
