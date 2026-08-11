import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { assignVoiceLine, releaseVoiceLine, getPoolStats } from '@/lib/services/voice-line-service'

import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic'

function requireAdmin(session: any) {
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

/**
 * GET /api/admin/voice-lines
 * Returns pool stats + full number list with assignment details.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const authError = requireAdmin(session)
  if (authError) return authError

  const [stats, numbers] = await Promise.all([
    getPoolStats(),
    prisma.twilioPhoneNumber.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        instructor: {
          select: { id: true, name: true, subscriptionTier: true, voiceLineStatus: true },
        },
      },
    }),
  ])

  return NextResponse.json({ stats, numbers })
}

const addNumberSchema = z.object({
  sid: z.string().min(1, 'Twilio SID is required'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  friendlyName: z.string().optional(),
  areaCode: z.string().optional(),
  notes: z.string().optional(),
})

/**
 * POST /api/admin/voice-lines
 * Add a number to the pool (entered manually from Twilio console).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const authError = requireAdmin(session)
  if (authError) return authError

  const body = await req.json()
  const parsed = addNumberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { sid, phoneNumber, friendlyName, areaCode, notes } = parsed.data

  // Check for duplicate
  const existing = await prisma.twilioPhoneNumber.findFirst({
    where: { OR: [{ sid }, { phoneNumber }] },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'A number with this SID or phone number already exists in the pool.' },
      { status: 409 }
    )
  }

  const number = await prisma.twilioPhoneNumber.create({
    data: { sid, phoneNumber, friendlyName, areaCode, notes, status: 'AVAILABLE' },
  })

  return NextResponse.json({ number }, { status: 201 })
}
