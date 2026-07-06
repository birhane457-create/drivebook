import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { assignVoiceLine, releaseVoiceLine, suspendVoiceLine, reactivateVoiceLine } from '@/lib/services/voice-line-service'

export const dynamic = 'force-dynamic'

function requireAdmin(session: any) {
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

const actionSchema = z.object({
  action: z.enum(['assign', 'release', 'suspend', 'reactivate']),
  instructorId: z.string().optional(), // required for assign
})

/**
 * PATCH /api/admin/voice-lines/:id
 * Perform an action on a specific number: assign | release | suspend | reactivate
 *
 * assign:     assign this number to an instructor (instructorId required)
 * release:    return to available pool (removes from instructor)
 * suspend:    keep assigned but mark SUSPENDED (calls fall to general line)
 * reactivate: un-suspend a suspended line
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const authError = requireAdmin(session)
  if (authError) return authError

  const body = await req.json()
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { action, instructorId } = parsed.data
  const numberId = params.id

  const number = await prisma.twilioPhoneNumber.findUnique({ where: { id: numberId } })
  if (!number) return NextResponse.json({ error: 'Number not found' }, { status: 404 })

  try {
    switch (action) {
      case 'assign': {
        if (!instructorId) {
          return NextResponse.json({ error: 'instructorId is required for assign' }, { status: 400 })
        }
        if (number.status !== 'AVAILABLE') {
          return NextResponse.json(
            { error: `Number is ${number.status} — release it first before reassigning.` },
            { status: 409 }
          )
        }
        // Use the specific number by assigning directly
        await prisma.$transaction([
          prisma.twilioPhoneNumber.update({
            where: { id: numberId },
            data: {
              status: 'ASSIGNED',
              assignedTo: instructorId,
              assignedAt: new Date(),
              assignedBy: session!.user.id,
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
        break
      }

      case 'release': {
        if (!number.assignedTo) {
          return NextResponse.json({ error: 'Number is not assigned to anyone.' }, { status: 409 })
        }
        await releaseVoiceLine(number.assignedTo, { adminUserId: session!.user.id })
        break
      }

      case 'suspend': {
        if (!number.assignedTo) {
          return NextResponse.json({ error: 'Number is not assigned.' }, { status: 409 })
        }
        await suspendVoiceLine(number.assignedTo)
        break
      }

      case 'reactivate': {
        if (!number.assignedTo) {
          return NextResponse.json({ error: 'Number is not assigned.' }, { status: 409 })
        }
        await reactivateVoiceLine(number.assignedTo)
        break
      }
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  // Return updated number
  const updated = await prisma.twilioPhoneNumber.findUnique({
    where: { id: numberId },
    include: {
      instructor: { select: { id: true, name: true, subscriptionTier: true } },
    },
  })

  return NextResponse.json({ number: updated })
}

/**
 * DELETE /api/admin/voice-lines/:id
 * Remove a number from the pool entirely (only if AVAILABLE).
 * Does NOT cancel it in Twilio — admin must do that in the Twilio console.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const authError = requireAdmin(session)
  if (authError) return authError

  const number = await prisma.twilioPhoneNumber.findUnique({ where: { id: params.id } })
  if (!number) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (number.status === 'ASSIGNED') {
    return NextResponse.json(
      { error: 'Cannot delete an assigned number. Release it first.' },
      { status: 409 }
    )
  }

  await prisma.twilioPhoneNumber.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
