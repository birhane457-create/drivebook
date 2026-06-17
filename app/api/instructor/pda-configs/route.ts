import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const pdaConfigSchema = z.object({
  name: z.string().min(1, 'Name required'),
  durationMinutes: z.number().min(60, 'Minimum 60 minutes'),
  price: z.number().min(0, 'Price cannot be negative'),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
  testCentreIds: z.array(z.string()).min(1, 'Select at least one test centre'),
  includes: z.object({
    pickup: z.boolean(),
    dropoff: z.boolean(),
    debriefing: z.boolean()
  }).optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().default(true)
})

// GET - List all PDA configs for current instructor
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user?.instructorId) {
      return NextResponse.json({ error: 'Not an instructor' }, { status: 403 })
    }

    const configs = await prisma.pDATestConfig.findMany({
      where: { instructorId: user.instructorId },
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

    return NextResponse.json({ configs })
  } catch (error) {
    console.error('Error fetching PDA configs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch PDA configs' },
      { status: 500 }
    )
  }
}

// POST - Create new PDA config
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user?.instructorId) {
      return NextResponse.json({ error: 'Not an instructor' }, { status: 403 })
    }

    const body = await req.json()
    const data = pdaConfigSchema.parse(body)

    // Verify test centres exist and are valid
    const testCentres = await prisma.testCentre.findMany({
      where: {
        id: { in: data.testCentreIds },
        isActive: true
      }
    })

    if (testCentres.length !== data.testCentreIds.length) {
      return NextResponse.json(
        { error: 'One or more test centres not found' },
        { status: 404 }
      )
    }

    const config = await prisma.pDATestConfig.create({
      data: {
        instructorId: user.instructorId,
        name: data.name,
        durationMinutes: data.durationMinutes,
        price: data.price,
        discountPercent: data.discountPercent || null,
        includes: data.includes || { pickup: true, dropoff: true, debriefing: true },
        notes: data.notes,
        isActive: data.isActive,
        testCentres: {
          create: data.testCentreIds.map(id => ({
            testCentreId: id
          }))
        }
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

    return NextResponse.json(config, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error creating PDA config:', error)
    return NextResponse.json(
      { error: 'Failed to create PDA config' },
      { status: 500 }
    )
  }
}
