import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateCustomPackageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  durationMinutes: z.number().min(30).max(480).optional(),
  price: z.number().positive().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  testCentreIds: z.array(z.string()).optional(),
  includes: z.object({
    pickup: z.boolean().optional(),
    dropoff: z.boolean().optional(),
    debriefing: z.boolean().optional()
  }).optional(),
  notes: z.string().max(500).optional(),
  isActive: z.boolean().optional()
})

// GET - Fetch specific custom package
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const config = await prisma.pDATestConfig.findUnique({
      where: { id: params.id },
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

    if (!config) {
      return NextResponse.json({ error: 'Custom package not found' }, { status: 404 })
    }

    if (config.instructorId !== session.user.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json({ customPackage: config })
  } catch (error) {
    console.error('Get custom package error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update custom package
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify config exists and belongs to instructor
    const existing = await prisma.pDATestConfig.findUnique({
      where: { id: params.id }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Custom package not found' }, { status: 404 })
    }

    if (existing.instructorId !== session.user.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const data = updateCustomPackageSchema.parse(body)

    // If updating test centres, verify they exist
    if (data.testCentreIds) {
      const testCentres = await prisma.testCentre.findMany({
        where: { id: { in: data.testCentreIds } }
      })

      if (testCentres.length !== data.testCentreIds.length) {
        return NextResponse.json({
          error: 'One or more test centres not found'
        }, { status: 404 })
      }
    }

    // Update config
    const updated = await prisma.pDATestConfig.update({
      where: { id: params.id },
      data: {
        ...data,
        ...(data.testCentreIds && {
          testCentres: {
            deleteMany: {},
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

    return NextResponse.json({ customPackage: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Update custom package error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete custom package
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify config exists and belongs to instructor
    const config = await prisma.pDATestConfig.findUnique({
      where: { id: params.id }
    })

    if (!config) {
      return NextResponse.json({ error: 'Custom package not found' }, { status: 404 })
    }

    if (config.instructorId !== session.user.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if there are active bookings
    const activeBookings = await prisma.pDATestBooking.count({
      where: {
        configId: params.id,
        status: { in: ['PENDING', 'CONFIRMED'] }
      }
    })

    if (activeBookings > 0) {
      return NextResponse.json({
        error: 'Cannot delete custom package with active bookings'
      }, { status: 409 })
    }

    // Delete config
    await prisma.pDATestConfig.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Custom package deleted successfully' })
  } catch (error) {
    console.error('Delete custom package error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
