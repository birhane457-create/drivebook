import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all bookings with client and instructor details
    const bookings = await prisma.booking.findMany({
      include: {
        client: {
          select: {
            name: true,
            email: true,
            phone: true,
          }
        },
        instructor: {
          select: {
            id: true,
            name: true,
            phone: true,
          }
        }
      },
      orderBy: {
        startTime: 'desc'
      }
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error('Admin bookings fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}
