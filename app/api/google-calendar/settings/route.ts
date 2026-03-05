import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { bufferMode } = body

    if (!bufferMode || !['auto', 'manual'].includes(bufferMode)) {
      return NextResponse.json({ 
        error: 'Invalid buffer mode. Must be "auto" or "manual"' 
      }, { status: 400 })
    }

    // Update instructor's calendar buffer mode preference
    await prisma.instructor.update({
      where: { id: session.user.instructorId },
      data: {
        calendarBufferMode: bufferMode
      }
    })

    return NextResponse.json({ 
      success: true,
      bufferMode 
    })
  } catch (error) {
    console.error('Update calendar settings error:', error)
    return NextResponse.json({ 
      error: 'Failed to update settings' 
    }, { status: 500 })
  }
}
