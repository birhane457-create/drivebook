import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { safeClientSelect, sanitizeClientForInstructor, logDataAccess } from '@/lib/utils/sanitize'

const clientSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: z.string().email(),
  addressText: z.string().optional(),
  addressLatitude: z.number().optional(),
  addressLongitude: z.number().optional(),
  notes: z.string().optional()
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = clientSchema.parse(body)

    const client = await prisma.client.create({
      data: {
        instructorId: session.user.instructorId,
        name: data.name,
        phone: data.phone,
        email: data.email,
        addressText: data.addressText,
        addressLatitude: data.addressLatitude,
        addressLongitude: data.addressLongitude,
        notes: data.notes
      }
    })

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Client creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // FIXED: Use safe selector to limit exposed data
    const clients = await prisma.client.findMany({
      where: {
        instructorId: session.user.instructorId
      },
      select: safeClientSelect,
      orderBy: {
        createdAt: 'desc'
      }
    })

    // FIXED: Sanitize phone numbers
    const sanitizedClients = clients.map(sanitizeClientForInstructor)

    // FIXED: Log data access for GDPR compliance
    await logDataAccess(
      prisma,
      session.user.instructorId,
      'INSTRUCTOR',
      'CLIENT',
      clients.map(c => c.id),
      'VIEW',
      req.headers.get('x-forwarded-for')
    )

    return NextResponse.json(sanitizedClients)
  } catch (error) {
    console.error('Fetch clients error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
