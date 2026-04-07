import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const exceptionSchema = z.object({
  label: z.string().optional(),
  exceptionDate: z.string(), // ISO date string
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  allDay: z.boolean().optional().default(false),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.instructorId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const exceptions = await (prisma as any).availabilityException.findMany({
    where: {
      instructorId: session.user.instructorId,
      ...(from && to ? {
        exceptionDate: {
          gte: new Date(from),
          lte: new Date(to),
        }
      } : {}),
    },
    orderBy: { exceptionDate: 'asc' },
  })

  return NextResponse.json(exceptions)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.instructorId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const data = exceptionSchema.parse(body)

  if (data.startTime >= data.endTime && !data.allDay) {
    return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
  }

  const exception = await (prisma as any).availabilityException.create({
    data: {
      instructorId: session.user.instructorId,
      label: data.label || null,
      exceptionDate: new Date(data.exceptionDate),
      startTime: data.allDay ? '00:00' : data.startTime,
      endTime: data.allDay ? '23:59' : data.endTime,
      allDay: data.allDay,
    },
  })

  return NextResponse.json(exception, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.instructorId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Verify ownership
  const existing = await (prisma as any).availabilityException.findFirst({
    where: { id, instructorId: session.user.instructorId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await (prisma as any).availabilityException.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
