/**
 * Voice Line Assignment Service
 *
 * Manages the lifecycle of dedicated Twilio numbers for PRO+ providers:
 *   assignVoiceLine(providerId)  — picks first AVAILABLE number, writes both records
 *   releaseVoiceLine(providerId) — frees the number back to the pool
 *
 * Called by:
 *   - Admin panel: manual assign/release
 *   - Subscription webhook: auto-assign on PRO upgrade, auto-release on downgrade/cancel
 *
 * Plans that get a dedicated line: PRO | STUDIO | BUSINESS
 * Plans that use the general DriveBook line: BASIC | TRIAL
 *
 * NOTE: voiceLine / voiceLineStatus / voiceLineSid are legacy fields that were on
 * the old Instructor model. They don't exist on the generic Provider model schema.
 * Queries here use `(prisma as any).provider` to bypass TypeScript until these
 * fields are either added to the Provider schema or moved to an extension table.
 */

import { prisma } from '@/lib/prisma'

const p = prisma as any  // voice fields not on Provider schema yet — suppress TS errors

export const DEDICATED_LINE_TIERS = ['PRO', 'STUDIO', 'PREMIUM']

export function isDedicatedLineTier(tier: string): boolean {
  return DEDICATED_LINE_TIERS.includes(tier.toUpperCase())
}

export async function assignVoiceLine(
  providerId: string,
  options: { adminUserId?: string; areaCode?: string } = {}
): Promise<{ phoneNumber: string; sid: string; friendlyName: string | null }> {
  const instructor = await p.provider.findUnique({
    where: { id: providerId },
    select: { id: true, name: true, voiceLine: true, voiceLineStatus: true },
  })

  if (!instructor) throw new Error(`Instructor ${providerId} not found`)
  if (instructor.voiceLine) {
    throw new Error(
      `Instructor ${instructor.name} already has a voice line: ${instructor.voiceLine}. Release it first.`
    )
  }

  const available = await prisma.twilioPhoneNumber.findFirst({
    where: {
      status: 'AVAILABLE',
      ...(options.areaCode ? { areaCode: options.areaCode } : {}),
    },
    orderBy: { createdAt: 'asc' },
  })

  const number =
    available ??
    (options.areaCode
      ? await prisma.twilioPhoneNumber.findFirst({
          where: { status: 'AVAILABLE' },
          orderBy: { createdAt: 'asc' },
        })
      : null)

  if (!number) {
    throw new Error('No Twilio numbers available in the pool. Add more numbers via the admin panel.')
  }

  const now = new Date()

  await prisma.$transaction([
    prisma.twilioPhoneNumber.update({
      where: { id: number.id },
      data: {
        status: 'ASSIGNED',
        assignedTo: providerId,
        assignedAt: now,
        assignedBy: options.adminUserId ?? null,
      },
    }),
    p.provider.update({
      where: { id: providerId },
      data: {
        voiceLine: number.phoneNumber,
        voiceLineSid: number.sid,
        voiceLineStatus: 'ACTIVE',
      },
    }),
  ])

  return { phoneNumber: number.phoneNumber, sid: number.sid, friendlyName: number.friendlyName }
}

export async function releaseVoiceLine(
  providerId: string,
  options: { adminUserId?: string } = {}
): Promise<void> {
  const instructor = await p.provider.findUnique({
    where: { id: providerId },
    select: { id: true, name: true, voiceLine: true, voiceLineSid: true },
  })

  if (!instructor) throw new Error(`Instructor ${providerId} not found`)
  if (!instructor.voiceLine) return

  const now = new Date()

  await prisma.$transaction([
    prisma.twilioPhoneNumber.updateMany({
      where: { assignedTo: providerId },
      data: {
        status: 'AVAILABLE',
        assignedTo: null,
        assignedAt: null,
        releasedAt: now,
        releasedBy: options.adminUserId ?? null,
      },
    }),
    p.provider.update({
      where: { id: providerId },
      data: { voiceLine: null, voiceLineSid: null, voiceLineStatus: 'NONE' },
    }),
  ])
}

export async function suspendVoiceLine(providerId: string): Promise<void> {
  await p.provider.update({
    where: { id: providerId },
    data: { voiceLineStatus: 'SUSPENDED' },
  })
}

export async function reactivateVoiceLine(providerId: string): Promise<void> {
  const instructor = await p.provider.findUnique({
    where: { id: providerId },
    select: { voiceLine: true },
  })
  if (!instructor?.voiceLine) throw new Error('No voice line to reactivate')

  await p.provider.update({
    where: { id: providerId },
    data: { voiceLineStatus: 'ACTIVE' },
  })
}

export async function getPoolStats() {
  const [available, assigned, total] = await Promise.all([
    prisma.twilioPhoneNumber.count({ where: { status: 'AVAILABLE' } }),
    prisma.twilioPhoneNumber.count({ where: { status: 'ASSIGNED' } }),
    prisma.twilioPhoneNumber.count(),
  ])
  return { available, assigned, total, released: total - available - assigned }
}
