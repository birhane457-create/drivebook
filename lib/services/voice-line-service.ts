/**
 * Voice Line Assignment Service
 *
 * Manages the lifecycle of dedicated Twilio numbers for PRO+ instructors:
 *   assignVoiceLine(instructorId)  — picks first AVAILABLE number, writes both records
 *   releaseVoiceLine(instructorId) — frees the number back to the pool
 *
 * Called by:
 *   - Admin panel: manual assign/release
 *   - Subscription webhook: auto-assign on PRO upgrade, auto-release on downgrade/cancel
 *
 * Plans that get a dedicated line: PRO | STUDIO | BUSINESS
 * Plans that use the general DriveBook line: BASIC | TRIAL
 */

import { prisma } from '@/lib/prisma'

export const DEDICATED_LINE_TIERS = ['PRO', 'STUDIO', 'BUSINESS']

export function isDedicatedLineTier(tier: string): boolean {
  return DEDICATED_LINE_TIERS.includes(tier.toUpperCase())
}

/**
 * Assign the first available Twilio number to an instructor.
 * If no numbers are available, throws — admin must stock the pool.
 * Optionally pass areaCode to prefer a regionally matching number.
 */
export async function assignVoiceLine(
  instructorId: string,
  options: { adminUserId?: string; areaCode?: string } = {}
): Promise<{ phoneNumber: string; sid: string; friendlyName: string | null }> {
  // Check instructor exists and doesn't already have a line
  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: { id: true, name: true, voiceLine: true, voiceLineStatus: true },
  })

  if (!instructor) throw new Error(`Instructor ${instructorId} not found`)
  if (instructor.voiceLine) {
    throw new Error(
      `Instructor ${instructor.name} already has a voice line: ${instructor.voiceLine}. Release it first.`
    )
  }

  // Find an available number — prefer area code match if provided
  const available = await prisma.twilioPhoneNumber.findFirst({
    where: {
      status: 'AVAILABLE',
      ...(options.areaCode ? { areaCode: options.areaCode } : {}),
    },
    orderBy: { createdAt: 'asc' }, // oldest first — fair queue
  })

  // If no area-code match, fall back to any available number
  const number =
    available ??
    (options.areaCode
      ? await prisma.twilioPhoneNumber.findFirst({
          where: { status: 'AVAILABLE' },
          orderBy: { createdAt: 'asc' },
        })
      : null)

  if (!number) {
    throw new Error(
      'No Twilio numbers available in the pool. Add more numbers via the admin panel.'
    )
  }

  const now = new Date()

  // Atomic update: mark number as assigned + write voice line to instructor
  await prisma.$transaction([
    prisma.twilioPhoneNumber.update({
      where: { id: number.id },
      data: {
        status: 'ASSIGNED',
        assignedTo: instructorId,
        assignedAt: now,
        assignedBy: options.adminUserId ?? null,
      },
    }),
    prisma.instructor.update({
      where: { id: instructorId },
      data: {
        voiceLine: number.phoneNumber,
        voiceLineSid: number.sid,
        voiceLineStatus: 'ACTIVE',
      },
    }),
  ])

  return {
    phoneNumber: number.phoneNumber,
    sid: number.sid,
    friendlyName: number.friendlyName,
  }
}

/**
 * Release a voice line from an instructor back to the available pool.
 * Clears the instructor's voice line fields.
 */
export async function releaseVoiceLine(
  instructorId: string,
  options: { adminUserId?: string } = {}
): Promise<void> {
  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: { id: true, name: true, voiceLine: true, voiceLineSid: true },
  })

  if (!instructor) throw new Error(`Instructor ${instructorId} not found`)
  if (!instructor.voiceLine) return // already has no line, nothing to do

  const now = new Date()

  await prisma.$transaction([
    // Return number to pool
    prisma.twilioPhoneNumber.updateMany({
      where: { assignedTo: instructorId },
      data: {
        status: 'AVAILABLE',
        assignedTo: null,
        assignedAt: null,
        releasedAt: now,
        releasedBy: options.adminUserId ?? null,
      },
    }),
    // Clear instructor voice line fields
    prisma.instructor.update({
      where: { id: instructorId },
      data: {
        voiceLine: null,
        voiceLineSid: null,
        voiceLineStatus: 'NONE',
      },
    }),
  ])
}

/**
 * Suspend a voice line without releasing it from the pool.
 * The number stays assigned but calls won't resolve to a dedicated line.
 * Used for temporary suspensions (e.g. failed payment, admin action).
 */
export async function suspendVoiceLine(instructorId: string): Promise<void> {
  await prisma.instructor.update({
    where: { id: instructorId },
    data: { voiceLineStatus: 'SUSPENDED' },
  })
}

/**
 * Reactivate a previously suspended voice line.
 */
export async function reactivateVoiceLine(instructorId: string): Promise<void> {
  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: { voiceLine: true },
  })
  if (!instructor?.voiceLine) throw new Error('No voice line to reactivate')

  await prisma.instructor.update({
    where: { id: instructorId },
    data: { voiceLineStatus: 'ACTIVE' },
  })
}

/**
 * Get pool stats for the admin panel.
 */
export async function getPoolStats() {
  const [available, assigned, total] = await Promise.all([
    prisma.twilioPhoneNumber.count({ where: { status: 'AVAILABLE' } }),
    prisma.twilioPhoneNumber.count({ where: { status: 'ASSIGNED' } }),
    prisma.twilioPhoneNumber.count(),
  ])
  return { available, assigned, total, released: total - available - assigned }
}
