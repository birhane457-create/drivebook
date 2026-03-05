import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { googleCalendarService } from '@/lib/services/googleCalendar'


export const dynamic = 'force-dynamic';
// Get connection status
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { prisma } = await import('@/lib/prisma')
    const instructor = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId },
      select: {
        syncGoogleCalendar: true,
        googleTokenExpiry: true,
        calendarBufferMode: true
      }
    })

    return NextResponse.json({
      connected: instructor?.syncGoogleCalendar || false,
      tokenExpiry: instructor?.googleTokenExpiry,
      bufferMode: instructor?.calendarBufferMode || 'auto'
    })
  } catch (error) {
    console.error('Get calendar status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get auth URL to connect
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const authUrl = googleCalendarService.getAuthUrl(session.user.instructorId)

    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('Get auth URL error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Disconnect calendar
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await googleCalendarService.disconnect(session.user.instructorId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Disconnect calendar error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
