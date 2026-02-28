import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { googleCalendarService } from '@/lib/services/googleCalendar'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await googleCalendarService.syncCalendarEvents(session.user.instructorId)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Sync calendar error:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
