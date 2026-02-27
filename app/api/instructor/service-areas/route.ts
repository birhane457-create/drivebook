import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const serviceAreaSchema = z.object({
  postcode: z.string(),
  suburb: z.string().optional(),
  state: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceAreas = await prisma.serviceArea.findMany({
      where: {
        instructorId: session.user.instructorId,
        isActive: true
      },
      orderBy: {
        postcode: 'asc'
      }
    })

    return NextResponse.json(serviceAreas)
  } catch (error) {
    console.error('Fetch service areas error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { postcode } = body

    // Check if already exists
    const existing = await prisma.serviceArea.findFirst({
      where: {
        instructorId: session.user.instructorId,
        postcode: postcode
      }
    })

    if (existing) {
      return NextResponse.json({ error: 'Postcode already added' }, { status: 400 })
    }

    const serviceArea = await prisma.serviceArea.create({
      data: {
        instructorId: session.user.instructorId,
        postcode: postcode,
        suburb: '', // Can be populated from API
        state: 'WA', // Default to WA, can be updated
        isActive: true
      }
    })

    return NextResponse.json(serviceArea, { status: 201 })
  } catch (error) {
    console.error('Create service area error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
