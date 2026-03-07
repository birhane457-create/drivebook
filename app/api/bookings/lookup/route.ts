import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    // Normalize phone number (remove spaces, dashes, etc.)
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '')

    // Get active future bookings by phone
    const now = new Date()
    const bookings = await prisma.booking.findMany({
      where: {
        clientPhone: normalizedPhone,
        status: {
          in: ['PENDING_PAYMENT', 'CONFIRMED', 'RESCHEDULED']
        },
        startTime: {
          gte: now
        }
      },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    })

    if (bookings.length === 0) {
      return NextResponse.json({ 
        bookings: [],
        message: 'No bookings found for this phone number'
      })
    }

    return NextResponse.json({
      bookings: bookings.map(booking => ({
        id: booking.id,
        status: booking.status,
        startTime: booking.startTime?.toISOString(),
        duration: booking.duration,
        pickupLocation: booking.pickupAddress,
        price: booking.price,
        instructor: {
          id: booking.instructor.id,
          name: booking.instructor.name,
          phone: booking.instructor.phone
        }
      }))
    })
  } catch (error) {
    console.error('Lookup bookings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
