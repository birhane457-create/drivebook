/**
 * Reviews API
 *
 * Reviews are stored directly on the Booking record — there is no separate
 * Review model in the schema. Fields used:
 *   Booking.clientRating      Int?       — 1-5 star rating
 *   Booking.clientReview      String?    — text comment
 *   Booking.reviewGivenAt     DateTime?  — when the review was submitted
 *   Booking.isReviewed        Boolean    — dedup guard (via (prisma as any))
 *
 * GET  /api/reviews?instructorId=  — public: all reviewed bookings for an instructor
 * GET  /api/reviews                — authenticated: reviews left by the current user
 * POST /api/reviews                — authenticated: submit a review for a completed booking
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { validateMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import { notifyReviewReceived } from '@/lib/services/notifications';

export const dynamic = 'force-dynamic';

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const instructorId = searchParams.get('instructorId');

    // Public: reviews for a specific instructor
    if (instructorId) {
      const reviewedBookings = await prisma.booking.findMany({
        where: {
          instructorId,
          clientRating: { not: null },
          reviewGivenAt: { not: null },
        },
        select: {
          id: true,
          clientRating: true,
          clientReview: true,
          reviewGivenAt: true,
          clientName: true,
          startTime: true,
        },
        orderBy: { reviewGivenAt: 'desc' },
      });

      const reviews = reviewedBookings.map((b) => ({
        id: b.id,
        rating: b.clientRating,
        comment: b.clientReview,
        reviewedAt: b.reviewGivenAt,
        clientName: b.clientName ?? 'Anonymous',
        lessonDate: b.startTime,
      }));

      const avgRating =
        reviews.length > 0
          ? reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length
          : 0;

      return NextResponse.json({
        reviews,
        averageRating: parseFloat(avgRating.toFixed(2)),
        totalReviews: reviews.length,
      });
    }

    // Authenticated: reviews submitted by the current user
    const auth = await validateMobileToken(req);
    let userEmail: string | null = null;

    if (auth.valid) {
      userEmail = auth.user?.email ?? null;
    } else {
      const session = await getServerSession(authOptions);
      userEmail = session?.user?.email ?? null;
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find bookings where this user was the client and left a review
    const reviewedBookings = await prisma.booking.findMany({
      where: {
        client: { userId: user.id },
        clientRating: { not: null },
      },
      select: {
        id: true,
        clientRating: true,
        clientReview: true,
        reviewGivenAt: true,
        startTime: true,
        instructor: { select: { name: true } },
      },
      orderBy: { reviewGivenAt: 'desc' },
    });

    const reviews = reviewedBookings.map((b) => ({
      id: b.id,
      instructorName: b.instructor.name,
      rating: b.clientRating,
      comment: b.clientReview,
      date: b.reviewGivenAt?.toISOString() ?? null,       // matches page field: review.date
      bookingDate: b.startTime?.toISOString() ?? null,    // matches page field: review.bookingDate
    }));

    return NextResponse.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Support both mobile JWT and web session
    const auth = await validateMobileToken(req);
    let userEmail: string | null = null;

    if (auth.valid) {
      userEmail = auth.user?.email ?? null;
    } else {
      const session = await getServerSession(authOptions);
      userEmail = session?.user?.email ?? null;
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { bookingId, rating, comment } = body;

    if (!bookingId || !rating) {
      return NextResponse.json({ error: 'bookingId and rating are required' }, { status: 400 });
    }

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 });
    }

    // Fetch booking with client + instructor
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        client: { include: { user: true } },
        instructor: { include: { user: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Ownership check — must be the client who made the booking
    if (booking.client?.user?.email !== userEmail) {
      return NextResponse.json({ error: 'You can only review your own bookings' }, { status: 403 });
    }

    // Must be a completed or past-confirmed booking
    const now = new Date();
    const bookingHasPassed = booking.startTime && new Date(booking.startTime) <= now;
    const reviewableStatuses = ['CONFIRMED', 'COMPLETED'];

    if (!bookingHasPassed || !reviewableStatuses.includes(booking.status)) {
      return NextResponse.json({ error: 'You can only review completed bookings' }, { status: 400 });
    }

    // Dedup — check reviewGivenAt instead of non-existent isReviewed field
    if (booking.reviewGivenAt) {
      return NextResponse.json({ error: 'This booking has already been reviewed' }, { status: 400 });
    }

    // Write review fields onto the Booking record (no separate Review model)
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        clientRating: Math.round(rating),
        clientReview: comment ?? null,
        reviewGivenAt: now,
      } as any,
    });

    // Update instructor aggregate rating
    const reviewedBookings = await prisma.booking.findMany({
      where: {
        instructorId: booking.instructorId,
        clientRating: { not: null },
        reviewGivenAt: { not: null },
      },
      select: { clientRating: true },
    });

    const avgRating =
      reviewedBookings.length > 0
        ? reviewedBookings.reduce((sum, b) => sum + (b.clientRating ?? 0), 0) / reviewedBookings.length
        : 0;

    await prisma.instructor.update({
      where: { id: booking.instructorId },
      data: {
        averageRating: parseFloat(avgRating.toFixed(2)),
        totalReviews: reviewedBookings.length,
      },
    });

    // Notify instructor (non-critical)
    try {
      if (booking.instructor?.user?.email) {
        const ratingLabel = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][Math.round(rating) - 1] ?? `${rating} stars`;
        await emailService.sendGenericEmail({
          to: booking.instructor.user.email,
          subject: `New Review from ${booking.clientName ?? 'a student'} — ${ratingLabel}`,
          html: `
            <h2>You received a new review</h2>
            <p>Hi ${booking.instructor.name},</p>
            <p><strong>${booking.clientName ?? 'A student'}</strong> left you a ${rating}/5 ⭐ review.</p>
            ${comment ? `<blockquote style="border-left:3px solid #e5e7eb;padding-left:12px;color:#374151">${comment}</blockquote>` : ''}
            <p>Log in to your dashboard to see all your reviews.</p>
          `,
        });
      }
      if (booking.instructor?.userId) {
        await notifyReviewReceived(booking.instructor.userId, booking.clientName ?? 'A student', Math.round(rating));
      }
    } catch (notifyErr) {
      console.error('Review notification failed (non-critical):', notifyErr);
    }

    return NextResponse.json({
      success: true,
      review: {
        bookingId,
        rating: Math.round(rating),
        comment: comment ?? null,
        reviewedAt: now,
      },
    });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
  }
}
