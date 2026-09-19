import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { googleCalendarService } from '@/lib/services/googleCalendar'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const providerId = session!.user!.providerId

    // INT-M-03F FIX: verify calendar is still connected before calling Google
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { syncGoogleCalendar: true },
    })
    if (!provider?.syncGoogleCalendar) {
      return NextResponse.json(
        { error: 'Google Calendar is not connected', code: 'CALENDAR_NOT_CONNECTED' },
        { status: 400 }
      )
    }

    const result = await googleCalendarService.syncCalendarEvents(providerId)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Sync calendar error:', error)
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
