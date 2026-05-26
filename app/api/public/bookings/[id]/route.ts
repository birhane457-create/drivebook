// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic';
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        client: { include: { user: true } },
        instructor: true
      }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const clientEmail = booking.client?.user?.email || ''
    const clientName = booking.clientName || booking.client?.name || ''

    return NextResponse.json({
      id: booking.id,
      startTime: booking.startTime,
      endTime: booking.endTime,
      pickupAddress: booking.pickupAddress,
      // For package bookings, charge the full package total (stored in packageTotalPaid).
      // For single lessons, charge the booking price.
      price: (booking as any).packageTotalPaid || booking.price,
      status: booking.status,
      isPaid: booking.isPaid,
      notes: booking.notes,
      isPackageBooking: booking.isPackageBooking,
      packageHours: booking.packageHours,
      packageTotalPaid: (booking as any).packageTotalPaid,
      lockedHourlyRate: (booking as any).lockedHourlyRate,
      lockedDiscountPct: (booking as any).lockedDiscountPct,
      instructor: {
        name: booking.instructor.name,
        phone: booking.instructor.phone,
        profileImage: booking.instructor.profileImage,
        hourlyRate: booking.instructor.hourlyRate,
      },
      client: {
        name: clientName,
        email: clientEmail,
      },
      createdAt: booking.createdAt
    })
  } catch (error) {
    console.error('Get booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
