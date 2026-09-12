// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'


export const dynamic = 'force-dynamic';
const consentSchema = z.object({
  consentCalendarSync: z.boolean().optional()
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = consentSchema.parse(body)

    await prisma.provider.update({
      where: { id: session!.user!.providerId },
      data: {
        ...data,
        consentDate: new Date()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Update consent error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const instructor = await prisma.provider.findUnique({
      where: { id: session!.user!.providerId },
      select: {
        consentCalendarSync: true,
        consentDate: true
      }
    })

    return NextResponse.json(instructor)
  } catch (error) {
    console.error('Get consent error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
