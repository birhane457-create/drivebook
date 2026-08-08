/**
 * Instructor Onboarding Email Sequence
 *
 * Central registry for all lifecycle emails sent to instructors after registration.
 * Each step has a stable id + version — changing either creates a new sequence entry,
 * so existing instructors are not re-sent emails they already received.
 *
 * Deduplication: checked via auditLog (action: ONBOARDING_EMAIL_SENT, metadata.emailId + .version).
 * Future: migrate to InstructorEmailSequence table for full workflow state visibility.
 *
 * Send logic:
 *   Steps 1              — fired at registration (register route)
 *   Steps 2–5            — cron-driven (/api/cron/instructor-onboarding)
 *   Step  6              — event-driven (approve route)
 */

import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/services/email'
import { buildOnboardingWelcome }      from './onboarding-welcome'
import { buildOnboardingSetup }        from './onboarding-setup'
import { buildOnboardingBookings }     from './onboarding-bookings'
import { buildOnboardingProfileTips }  from './onboarding-profile-tips'
import { buildOnboardingAI }           from './onboarding-ai'
import { buildOnboardingApproved }     from './onboarding-approved'
import { formatSender } from '@/lib/email/senders'

// ---------------------------------------------------------------------------
// Step registry
// ---------------------------------------------------------------------------

export interface OnboardingStep {
  /** Stable dot-notation ID. Never change — used for deduplication. */
  id: string
  /** Increment when template content changes significantly. Old version = old instructors not re-sent. */
  version: number
  /** Days after createdAt to send. Ignored for step 1 (immediate) and step 6 (event). */
  delayDays: number
  /** Human label for admin UI */
  label: string
  /** How this step is triggered */
  trigger: 'registration' | 'cron' | 'approval'
}

export const ONBOARDING_SEQUENCE: readonly OnboardingStep[] = [
  { id: 'onboarding.welcome',         version: 1, delayDays: 0, label: 'Welcome',                   trigger: 'registration' },
  { id: 'onboarding.setup',           version: 2, delayDays: 1, label: 'Setup guide',                trigger: 'cron'         },
  { id: 'onboarding.bookings',        version: 1, delayDays: 3, label: 'How bookings work',           trigger: 'cron'         },
  { id: 'onboarding.profile-tips',    version: 1, delayDays: 5, label: 'Get more bookings',           trigger: 'cron'         },
  { id: 'onboarding.ai-receptionist', version: 1, delayDays: 7, label: 'AI receptionist',             trigger: 'cron'         },
  { id: 'onboarding.approved',        version: 1, delayDays: 0, label: 'Approved — activate',         trigger: 'approval'     },
] as const

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

export async function hasBeenSent(
  instructorId: string,
  emailId: string,
  version: number
): Promise<boolean> {
  const existing = await prisma.auditLog.findFirst({
    where: {
      action: 'ONBOARDING_EMAIL_SENT',
      targetType: 'INSTRUCTOR',
      targetId: instructorId,
      metadata: {
        path: ['emailId'],
        equals: emailId,
      },
    },
    select: { id: true, metadata: true },
  })
  if (!existing) return false
  // If the version stored matches the current version, it's been sent
  const meta = existing.metadata as Record<string, unknown>
  return (meta?.version ?? 1) === version
}

export async function markSent(
  actorId: string,
  instructorId: string,
  emailId: string,
  version: number,
  extra?: Record<string, unknown>
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: 'ONBOARDING_EMAIL_SENT',
      actorId,
      actorRole: 'SYSTEM',
      targetType: 'INSTRUCTOR',
      targetId: instructorId,
      success: true,
      metadata: {
        emailId,
        version,
        sentAt: new Date().toISOString(),
        ...extra,
      } as any,
    },
  })
}

// ---------------------------------------------------------------------------
// Instructor data shape needed across templates
// ---------------------------------------------------------------------------

export interface OnboardingInstructor {
  id: string
  name: string
  email: string
  voiceLineStatus: string
  subscriptionTier: string
}

// ---------------------------------------------------------------------------
// Send a single step
// ---------------------------------------------------------------------------

/**
 * Builds and sends one onboarding email.
 * Checks deduplication first unless force=true (admin manual trigger).
 * Records the send in auditLog after success.
 * Returns true if sent, false if skipped.
 */
export async function sendOnboardingStep(
  instructor: OnboardingInstructor,
  stepId: string,
  version: number,
  options?: { force?: boolean; triggeredBy?: string }
): Promise<boolean> {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'
  const supportEmail = process.env.ADMIN_EMAIL || 'support@drivebook.com.au'
  const force = options?.force ?? false

  if (!force && await hasBeenSent(instructor.id, stepId, version)) return false

  let result: { subject: string; html: string } | null = null
  let skip = false

  switch (stepId) {
    case 'onboarding.welcome':
      result = buildOnboardingWelcome({ instructorName: instructor.name, baseUrl, supportEmail })
      break

    case 'onboarding.setup':
      result = buildOnboardingSetup({ instructorName: instructor.name, baseUrl, supportEmail })
      break

    case 'onboarding.bookings':
      result = buildOnboardingBookings({ instructorName: instructor.name, baseUrl, supportEmail })
      break

    case 'onboarding.profile-tips':
      result = buildOnboardingProfileTips({ instructorName: instructor.name, baseUrl, supportEmail })
      break

    case 'onboarding.ai-receptionist': {
      const hasAI = instructor.voiceLineStatus !== 'NONE'
      if (!hasAI) { skip = true; break }
      result = buildOnboardingAI({ instructorName: instructor.name, baseUrl, supportEmail })
      break
    }

    case 'onboarding.approved':
      result = buildOnboardingApproved({ instructorName: instructor.name, baseUrl, supportEmail })
      break

    default:
      console.warn(`[onboarding] Unknown step id: ${stepId}`)
      return false
  }

  if (skip || !result) {
    await markSent('SYSTEM', instructor.id, stepId, version, { skipped: true, reason: 'condition_not_met' })
    return false
  }

  await emailService.sendEmail({
    to: instructor.email,
    subject: result.subject,
    html: result.html,
    context: { event: 'INSTRUCTOR_REGISTRATION' },
  })

  await markSent(
    options?.triggeredBy ?? 'SYSTEM',
    instructor.id,
    stepId,
    version,
    options?.triggeredBy ? { triggeredBy: options.triggeredBy, manual: true } : undefined
  )
  return true
}
