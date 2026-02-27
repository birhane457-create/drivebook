import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'


export const dynamic = 'force-dynamic';
const waitingListSchema = z.object({
  instructorId: z.string(),
  clientName: z.string(),
  clientEmail: z.string().email(),
  clientPhone: z.string(),
  originalBookingDate: z.string().datetime(),
  originalBookingTime: z.string(),
  earliestDate: z.string().datetime(),
  preferredDuration: z.number(),
  pickupAddress: z.string().optional(),
  notes: z.string().optional()
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = waitingListSchema.parse(body)

    const waitingListEntry = await prisma.waitingList.create({
      data: {
        instructorId: data.instructorId,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone,
        originalBookingDate: new Date(data.originalBookingDate),
        originalBookingTime: data.originalBookingTime,
        earliestDate: new Date(data.earliestDate),
        preferredDuration: data.preferredDuration,
        pickupAddress: data.pickupAddress,
        notes: data.notes,
        isActive: true
      }
    })

    return NextResponse.json({ success: true, entry: waitingListEntry }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Waiting list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const instructorId = searchParams.get('instructorId')

    if (!instructorId) {
      return NextResponse.json({ error: 'Missing instructorId' }, { status: 400 })
    }

    const waitingList = await prisma.waitingList.findMany({
      where: {
        instructorId,
        isActive: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return NextResponse.json(waitingList)
  } catch (error) {
    console.error('Get waiting list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
