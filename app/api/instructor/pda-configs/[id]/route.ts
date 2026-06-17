import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

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

export const dynamic = 'force-dynamic'

// DELETE - Remove a PDA config
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Verify the config belongs to this instructor
    const config = await prisma.pDATestConfig.findUnique({
      where: { id: params.id },
      select: { instructorId: true }
    })

    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    if (config.instructorId !== user.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete the config (this will cascade delete the join table entries)
    await prisma.pDATestConfig.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true, message: 'PDA config deleted' }, { status: 200 })
  } catch (error) {
    console.error('Error deleting PDA config:', error)
    return NextResponse.json(
      { error: 'Failed to delete PDA config' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const config = await prisma.pDATestConfig.findUnique({
      where: { id: params.id },
      select: { instructorId: true }
    })

    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    if (config.instructorId !== user.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const data = pdaConfigSchema.parse(body)

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

    const updatedConfig = await prisma.pDATestConfig.update({
      where: { id: params.id },
      data: {
        name: data.name,
        durationMinutes: data.durationMinutes,
        price: data.price,
        discountPercent: data.discountPercent || null,
        includes: data.includes || { pickup: true, dropoff: true, debriefing: true },
        notes: data.notes,
        isActive: data.isActive,
        testCentres: {
          deleteMany: {},
          create: data.testCentreIds.map(id => ({ testCentreId: id }))
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

    return NextResponse.json(updatedConfig, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }

    console.error('Error updating PDA config:', error)
    return NextResponse.json(
      { error: 'Failed to update PDA config' },
      { status: 500 }
    )
  }
}
