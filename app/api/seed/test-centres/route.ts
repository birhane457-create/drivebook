import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST - Seed test centres (admin only)
export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Sample test centres for Australia (WA focus)
    const testCentres = [
      {
        name: 'Perth Test Centre',
        address: '123 Hay Street',
        suburb: 'Perth',
        state: 'WA',
        region: 'Metropolitan',
        lat: -31.9454,
        lng: 115.8604
      },
      {
        name: 'Fremantle Test Centre',
        address: '456 South Street',
        suburb: 'Fremantle',
        state: 'WA',
        region: 'Metropolitan',
        lat: -32.0578,
        lng: 115.7452
      },
      {
        name: 'Midland Test Centre',
        address: '789 Great Eastern Highway',
        suburb: 'Midland',
        state: 'WA',
        region: 'Metropolitan',
        lat: -31.8739,
        lng: 116.0012
      },
      {
        name: 'Joondalup Test Centre',
        address: '321 Connolly Drive',
        suburb: 'Joondalup',
        state: 'WA',
        region: 'Metropolitan',
        lat: -31.7405,
        lng: 115.7697
      },
      {
        name: 'Armadale Test Centre',
        address: '654 Jull Street',
        suburb: 'Armadale',
        state: 'WA',
        region: 'South-East',
        lat: -32.1489,
        lng: 116.0089
      }
    ]

    // Create test centres if they don't exist
    for (const centre of testCentres) {
      await prisma.testCentre.upsert({
        where: { name: centre.name },
        update: { isActive: true },
        create: {
          name: centre.name,
          address: centre.address,
          suburb: centre.suburb,
          state: centre.state,
          region: centre.region,
          lat: centre.lat,
          lng: centre.lng,
          isActive: true
        }
      })
    }

    const all = await prisma.testCentre.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({
      message: `✅ Created/updated ${testCentres.length} test centres`,
      testCentres: all
    })
  } catch (error) {
    console.error('Error seeding test centres:', error)
    return NextResponse.json(
      { error: 'Failed to seed test centres' },
      { status: 500 }
    )
  }
}

// GET - Show current test centres
export async function GET(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const centres = await prisma.testCentre.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({
      count: centres.length,
      testCentres: centres
    })
  } catch (error) {
    console.error('Error fetching test centres:', error)
    return NextResponse.json(
      { error: 'Failed to fetch test centres' },
      { status: 500 }
    )
  }
}
