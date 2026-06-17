import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/instructors/[id]/pda-configs
 * 
 * Public endpoint for students to fetch instructor's available PDA configs
 * 
 * Response:
 * {
 *   configs: [
 *     {
 *       id: string
 *       name: string
 *       durationMinutes: number
 *       price: number
 *       discountPercent?: number
 *       testCentres: [{ id, name, address }]
 *       includes?: { pickup, dropoff, debriefing }
 *       isActive: boolean
 *     }
 *   ]
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Verify instructor exists
    const instructor = await prisma.instructor.findUnique({
      where: { id },
      select: { id: true }
    })

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      )
    }

    // Get all active PDA configs for this instructor with their test centres
    const configs = await prisma.pDATestConfig.findMany({
      where: {
        instructorId: id,
        isActive: true
      },
      include: {
        testCentres: {
          include: {
            testCentre: {
              select: {
                id: true,
                name: true,
                address: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json({
      configs: configs.map(config => ({
        id: config.id,
        name: config.name,
        durationMinutes: config.durationMinutes,
        price: config.price,
        discountPercent: config.discountPercent,
        testCentres: config.testCentres.map(jt => jt.testCentre),
        includes: config.includes,
        isActive: config.isActive
      }))
    })
  } catch (error) {
    console.error('Error fetching PDA configs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch PDA configs' },
      { status: 500 }
    )
  }
}
