// app/api/instructor/devices/[id]/route.ts
//
// DELETE — remove a specific recognised device
//
// Security: userId is always included in the where clause (deleteMany).
// A user cannot delete another user's device by guessing an ID.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: deviceId } = params

  if (!deviceId || typeof deviceId !== 'string') {
    return NextResponse.json({ error: 'Invalid device ID' }, { status: 400 })
  }

  try {
    const { prisma } = await import('@/lib/prisma')

    // deleteMany with both id and userId ensures ownership —
    // if the device doesn't belong to this user, count = 0 (no error, no data leak)
    const result = await prisma.loginDevice.deleteMany({
      where: {
        id: deviceId,
        userId: session.user.id,
      },
    })

    if (result.count === 0) {
      // Device not found or doesn't belong to this user
      // Return 404 either way — don't reveal which
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err?.code === 'P2021' || err?.message?.includes('does not exist')) {
      return NextResponse.json({ error: 'Device table not yet migrated' }, { status: 503 })
    }
    throw err
  }
}
