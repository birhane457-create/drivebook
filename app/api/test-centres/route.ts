import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - List all active test centres
export async function GET(req: NextRequest) {
  try {
    const testCentres = await prisma.testCentre.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        address: true,
        suburb: true,
        state: true,
        region: true
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ testCentres })
  } catch (error) {
    console.error('Error fetching test centres:', error)
    return NextResponse.json(
      { error: 'Failed to fetch test centres' },
      { status: 500 }
    )
  }
}
