import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pdaService } from '@/lib/services/pda'
import { z } from 'zod'

const pdaTestSchema = z.object({
  clientId: z.string(),
  testCenterLatitude: z.number(),
  testCenterLongitude: z.number(),
  testCenterName: z.string(),
  testCenterAddress: z.string(),
  testDate: z.string(),
  testTime: z.string()
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = pdaTestSchema.parse(body)

    const pdaTest = await pdaService.createPDATest({
      instructorId: session.user.instructorId,
      clientId: data.clientId,
      testCenterLatitude: data.testCenterLatitude,
      testCenterLongitude: data.testCenterLongitude,
      testCenterName: data.testCenterName,
      testCenterAddress: data.testCenterAddress,
      testDate: new Date(data.testDate),
      testTime: data.testTime
    })

    return NextResponse.json(pdaTest, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('PDA test creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tests = await prisma.pDATest.findMany({
      where: {
        instructorId: session.user.instructorId
      },
      include: {
        client: true
      },
      orderBy: {
        testDate: 'desc'
      }
    })

    return NextResponse.json(tests)
  } catch (error) {
    console.error('Fetch PDA tests error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
