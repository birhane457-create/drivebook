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
 * voiceLine / voiceLineStatus / voiceLineSid live on DrivingProviderProfile
 * (driving-specific extension table), not on Provider directly.
 */

import { prisma } from '@/lib/prisma'

export const DEDICATED_LINE_TIERS = ['PRO', 'STUDIO', 'PREMIUM']

export function isDedicatedLineTier(tier: string): boolean {
  return DEDICATED_LINE_TIERS.includes(tier.toUpperCase())
}

// Helper: get voiceLine fields from DrivingProviderProfile
async function getVoiceProfile(providerId: string) {
  return prisma.drivingProviderProfile.findUnique({
    where: { providerId },
    select: { voiceLine: true, voiceLineSid: true, voiceLineStatus: true },
  })
}

// Helper: upsert voiceLine fields on DrivingProviderProfile
async function setVoiceProfile(
  providerId: string,
  data: { voiceLine?: string | null; voiceLineSid?: string | null; voiceLineStatus?: string }
) {
  return prisma.drivingProviderProfile.upsert({
    where: { providerId },
    update: data,
    create: { providerId, voiceLineStatus: 'NONE', ...data },
  })
}

export async function assignVoiceLine(
  providerId: string,
  options: { adminUserId?: string; areaCode?: string } = {}
): Promise<{ phoneNumber: string; sid: string; friendlyName: string | null }> {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: { id: true, name: true },
  })
  if (!provider) throw new Error(`Provider ${providerId} not found`)

  const profile = await getVoiceProfile(providerId)
  if (profile?.voiceLine) {
    throw new Error(
      `Provider ${provider.name} already has a voice line: ${profile.voiceLine}. Release it first.`
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

  await Promise.all([
    prisma.twilioPhoneNumber.update({
      where: { id: number.id },
      data: {
        status: 'ASSIGNED',
        assignedTo: providerId,
        assignedAt: now,
        assignedBy: options.adminUserId ?? null,
      },
    }),
    setVoiceProfile(providerId, {
      voiceLine: number.phoneNumber,
      voiceLineSid: number.sid,
      voiceLineStatus: 'ACTIVE',
    }),
  ])

  return { phoneNumber: number.phoneNumber, sid: number.sid, friendlyName: number.friendlyName }
}

export async function releaseVoiceLine(
  providerId: string,
  options: { adminUserId?: string } = {}
): Promise<void> {
  const profile = await getVoiceProfile(providerId)
  if (!profile?.voiceLine) return

  const now = new Date()

  await Promise.all([
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
    setVoiceProfile(providerId, {
      voiceLine: null,
      voiceLineSid: null,
      voiceLineStatus: 'NONE',
    }),
  ])
}

export async function suspendVoiceLine(providerId: string): Promise<void> {
  await setVoiceProfile(providerId, { voiceLineStatus: 'SUSPENDED' })
}

export async function reactivateVoiceLine(providerId: string): Promise<void> {
  const profile = await getVoiceProfile(providerId)
  if (!profile?.voiceLine) throw new Error('No voice line to reactivate')
  await setVoiceProfile(providerId, { voiceLineStatus: 'ACTIVE' })
}

export async function getPoolStats() {
  const [available, assigned, total] = await Promise.all([
    prisma.twilioPhoneNumber.count({ where: { status: 'AVAILABLE' } }),
    prisma.twilioPhoneNumber.count({ where: { status: 'ASSIGNED' } }),
    prisma.twilioPhoneNumber.count(),
  ])
  return { available, assigned, total, released: total - available - assigned }
}
