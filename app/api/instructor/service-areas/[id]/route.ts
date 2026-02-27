import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceArea = await prisma.serviceArea.findFirst({
      where: {
        id: params.id,
        instructorId: session.user.instructorId
      }
    })

    if (!serviceArea) {
      return NextResponse.json({ error: 'Service area not found' }, { status: 404 })
    }

    await prisma.serviceArea.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete service area error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
