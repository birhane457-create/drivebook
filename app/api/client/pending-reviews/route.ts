import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { validateMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    // Try JWT token first (for mobile), then NextAuth session (for web)
    const auth = await validateMobileToken(req);
    const userId = auth.valid ? auth.user?.id : null;

    if (!userId) {
      // Fall back to NextAuth for web clients
      const session = await getServerSession(authOptions);
      if (!session?.user?.email) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      return getClientPendingReviews(user.id);
    }

    return getClientPendingReviews(userId);
  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getClientPendingReviews(userId: string) {
  try {
    // First, find all clients associated with this user
    const clients = await prisma.client.findMany({
      where: { userId: userId },
      select: { id: true }
    });

    const clientIds = clients.map(c => c.id);

    // Get completed bookings that don't have reviews yet
    const completedBookings = await prisma.booking.findMany({
      where: {
        clientId: { in: clientIds },
        status: 'COMPLETED',
        reviews: {
          none: {} // No reviews yet
        }
      },
      include: {
        instructor: true,
        reviews: true
      },
      orderBy: { endTime: 'desc' }
    });

    const pendingReviews = completedBookings.map(booking => ({
      id: booking.id,
      bookingId: booking.id,
      instructorName: booking.instructor.name,
      bookingDate: booking.startTime?.toISOString() || new Date().toISOString()
    }));

    return NextResponse.json(pendingReviews);
  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
