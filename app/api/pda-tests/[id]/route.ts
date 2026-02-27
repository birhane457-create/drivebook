import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'


export const dynamic = 'force-dynamic';
const updateTestSchema = z.object({
  result: z.enum(['PENDING', 'PASS', 'FAIL'])
})

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = updateTestSchema.parse(body)

    // Verify test belongs to instructor
    const existingTest = await prisma.pDATest.findUnique({
      where: { id: params.id },
      select: { instructorId: true }
    })

    if (!existingTest || existingTest.instructorId !== session.user.instructorId) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    // Update test result
    const test = await prisma.pDATest.update({
      where: { id: params.id },
      data: { result: data.result }
    })

    return NextResponse.json(test)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Update test error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
