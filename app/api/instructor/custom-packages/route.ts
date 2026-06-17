import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const customPackageSchema = z.object({
  type: z.enum(['PDA_TEST', 'MOCK_TEST', 'CUSTOM_SERVICE']).default('PDA_TEST'),
  name: z.string().min(1).max(100),
  durationMinutes: z.number().min(30).max(480), // 30 min to 8 hours
  price: z.number().positive(),
  discountPercent: z.number().min(0).max(100).optional(),
  // For PDA tests: required to have test centres
  testCentreIds: z.array(z.string()).min(1).optional(),
  includes: z.object({
    pickup: z.boolean().optional(),
    dropoff: z.boolean().optional(),
    debriefing: z.boolean().optional()
  }).optional(),
  notes: z.string().max(500).optional()
})

// GET - List all custom packages (PDA test configs) for instructor
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const configs = await prisma.pDATestConfig.findMany({
      where: { instructorId: session.user.instructorId },
      include: {
        testCentres: {
          include: {
            testCentre: {
              select: { id: true, name: true, address: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ customPackages: configs })
  } catch (error) {
    console.error('Get custom packages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new custom package (PDA test config)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = customPackageSchema.parse(body)

    // Verify instructor exists
    const instructor = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId }
    })

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 })
    }

    // For PDA tests, verify all test centres exist
    if (data.testCentreIds && data.testCentreIds.length > 0) {
      const testCentres = await prisma.testCentre.findMany({
        where: { id: { in: data.testCentreIds } }
      })

      if (testCentres.length !== data.testCentreIds.length) {
        return NextResponse.json({
          error: 'One or more test centres not found'
        }, { status: 404 })
      }
    }

    // Create config with test centre relations
    const config = await prisma.pDATestConfig.create({
      data: {
        instructorId: session.user.instructorId,
        name: data.name,
        durationMinutes: data.durationMinutes,
        price: data.price,
        discountPercent: data.discountPercent,
        includes: data.includes,
        notes: data.notes,
        ...(data.testCentreIds && {
          testCentres: {
            create: data.testCentreIds.map(id => ({
              testCentreId: id
            }))
          }
        })
      },
      include: {
        testCentres: {
          include: {
            testCentre: {
              select: { id: true, name: true, address: true }
            }
          }
        }
      }
    })

    return NextResponse.json({ customPackage: config }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Create custom package error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
