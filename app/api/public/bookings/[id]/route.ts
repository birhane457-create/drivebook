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
        client: true,
        instructor: {
          include: {
            user: true
          }
        }
      }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Return booking details for client to view/manage
    return NextResponse.json({
      id: booking.id,
      startTime: booking.startTime,
      endTime: booking.endTime,
      pickupAddress: booking.pickupAddress,
      price: booking.price,
      status: booking.status,
      notes: booking.notes,
      client: {
        name: booking.client.name,
        email: booking.client.email,
        phone: booking.client.phone
      },
      instructor: {
        name: booking.instructor.name,
        phone: booking.instructor.phone,
        email: booking.instructor.user.email
      },
      createdAt: booking.createdAt
    })
  } catch (error) {
    console.error('Get booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
