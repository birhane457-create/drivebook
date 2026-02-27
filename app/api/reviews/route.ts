import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../lib/auth';
import { validateMobileToken } from '../../../../../lib/mobile-auth';
import { prisma } from '../../../../../lib/prisma';
import { emailService } from '../../../../../lib/services/email';

// GET - Fetch reviews
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const instructorId = searchParams.get('instructorId');

    // If no instructorId, fetch current user's reviews
    if (!instructorId) {
      // Try JWT token first (for mobile), then NextAuth session (for web)
      const auth = await validateMobileToken(req);
      const userId = auth.valid ? auth.user?.id : null;

      if (!userId) {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }

        const user = await prisma.user.findUnique({
          where: { email: session.user.email }
        });

        if (!user) {
          return NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          );
        }

        return getUserReviews(user.id);
      }

      return getUserReviews(userId);
    }

    // Fetch reviews for a specific instructor
    const reviews = await (prisma as any).review.findMany({
      where: {
        instructorId,
        isPublished: true
      },
      include: {
        client: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate average rating
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
      : 0;

    return NextResponse.json({
      reviews,
      averageRating: avgRating,
      totalReviews: reviews.length
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

async function getUserReviews(userId: string) {
  try {
    const userReviews = await (prisma as any).review.findMany({
      where: {
        clientId: userId
      },
      include: {
        booking: {
          include: {
            instructor: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const reviews = userReviews.map((r: any) => ({
      id: r.id,
      instructorName: r.booking.instructor.name,
      rating: r.rating,
      comment: r.comment,
      date: r.createdAt.toISOString(),
      bookingDate: r.booking.startTime.toISOString()
    }));

    return NextResponse.json(reviews);
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

// POST - Create a new review
export async function POST(req: NextRequest) {
  try {
    // Try JWT token first (for mobile), then NextAuth session (for web)
    const auth = await validateMobileToken(req);
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (auth.valid) {
      userId = auth.user?.id || null;
      userEmail = auth.user?.email || null;
    } else {
      const session = await getServerSession(authOptions);
      if (!session?.user?.email) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      userEmail = session.user.email;
    }

    const body = await req.json();
    const { bookingId, rating, comment } = body;

    // Validate required fields
    if (!bookingId || !rating || !comment) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if booking exists and is completed
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        client: true,
        instructor: {
          include: {
            user: true
          }
        },
        user: true
      }
    }) as any;

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Verify the user is the client who made the booking
    if (booking.user.email !== userEmail) {
      return NextResponse.json(
        { error: 'You can only review your own bookings' },
        { status: 403 }
      );
    }

    // Check if booking is in the past (startTime has passed) and status is CONFIRMED or COMPLETED
    const now = new Date();
    const bookingHasPassed = new Date(booking.startTime) <= now;
    const allowedStatuses = ['CONFIRMED', 'COMPLETED'];
    
    if (!bookingHasPassed || !allowedStatuses.includes(booking.status)) {
      return NextResponse.json(
        { error: 'Can only review completed bookings' },
        { status: 400 }
      );
    }

    if (booking.isReviewed) {
      return NextResponse.json(
        { error: 'This booking has already been reviewed' },
        { status: 400 }
      );
    }

    // Create review
    const review = await (prisma as any).review.create({
      data: {
        bookingId,
        instructorId: booking.instructorId,
        clientId: booking.userId,
        rating,
        comment,
        isVerified: true
      }
    });

    // Mark booking as reviewed
    await prisma.booking.update({
      where: { id: bookingId },
      data: { isReviewed: true } as any
    });

    // Update instructor's average rating
    const allReviews = await (prisma as any).review.findMany({
      where: { instructorId: booking.instructorId, isPublished: true }
    });

    const avgRating = allReviews.length > 0
      ? allReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / allReviews.length
      : 0;

    await prisma.instructor.update({
      where: { id: booking.instructorId },
      data: {
        averageRating: avgRating,
        totalReviews: allReviews.length
      } as any
    });

    // Send notification email to instructor
    try {
      const ratingText = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating - 1] || `${rating} stars`;
      await emailService.sendGenericEmail({
        to: booking.instructor.user.email,
        subject: `New Review from ${booking.client.name} - ${ratingText}`,
        html: `
          <h2>You've received a new review!</h2>
          <p>Hi ${booking.instructor.name},</p>
          <p><strong>${booking.client.name}</strong> left you a review after your lesson on ${new Date(booking.startTime).toLocaleDateString()}.</p>
          <h3>Rating: ${rating}/5 ⭐</h3>
          <h3>Comment:</h3>
          <p>${comment}</p>
          <p>Login to your dashboard to see all your reviews and ratings.</p>
        `
      });
      console.log(`✅ Review notification sent to ${booking.instructor.user.email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send review notification: ${emailError}`);
    }

    return NextResponse.json({ success: true, review });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
  }
}
