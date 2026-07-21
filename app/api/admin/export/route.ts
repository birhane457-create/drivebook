/**
 * GET /api/admin/export?type=bookings|revenue|instructors
 *
 * CSV data export for admin. Returns a downloadable CSV file.
 * Auth: ADMIN or SUPER_ADMIN session required.
 *
 * ?type=bookings    — all platform bookings with client, instructor, amount, status
 * ?type=revenue     — daily revenue aggregation (platform fee + instructor payout)
 * ?type=instructors — instructor roster with subscription, rating, address, location
 *
 * Optional filters:
 *   ?from=YYYY-MM-DD  — start date (inclusive)
 *   ?to=YYYY-MM-DD    — end date (inclusive)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ── CSV helpers ───────────────────────────────────────────────────────────────

function escape(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // Wrap in quotes if it contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(fields: unknown[]): string {
  return fields.map(escape).join(',');
}

function csvResponse(filename: string, header: string[], rows: unknown[][]): NextResponse {
  const lines = [header.join(','), ...rows.map(r => row(r))].join('\n');
  return new NextResponse(lines, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function dateFilter(from?: string | null, to?: string | null) {
  const filter: Record<string, Date> = {};
  if (from) filter.gte = new Date(from + 'T00:00:00.000Z');
  if (to)   filter.lte = new Date(to   + 'T23:59:59.999Z');
  return Object.keys(filter).length ? filter : undefined;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'bookings';
  const from = searchParams.get('from');
  const to   = searchParams.get('to');
  const now  = new Date();
  const dateTag = now.toISOString().slice(0, 10);

  // ── Bookings export ───────────────────────────────────────────────────────
  if (type === 'bookings') {
    const createdAtFilter = dateFilter(from, to);
    const bookings = await prisma.booking.findMany({
      where: {
        source: 'platform',
        deletedAt: null,
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      } as any,
      select: {
        id: true,
        status: true,
        createdAt: true,
        startTime: true,
        endTime: true,
        duration: true,
        price: true,
        platformFee: true,
        instructorPayout: true,
        commissionRate: true,
        isPaid: true,
        isPackageBooking: true,
        packageHours: true,
        clientName: true,
        clientPhone: true,
        pickupAddress: true,
        bookingType: true,
        instructor: { select: { name: true, suburb: true, state: true } },
        client:     { select: { name: true, phone: true, user: { select: { email: true } } } },
      },
      orderBy: { createdAt: 'desc' } as any,
    });

    const header = [
      'Booking ID', 'Status', 'Created At', 'Lesson Date', 'Lesson Time',
      'Duration (min)', 'Price ($)', 'Platform Fee ($)', 'Instructor Payout ($)',
      'Commission %', 'Is Paid', 'Package Booking', 'Package Hours',
      'Client Name', 'Client Email', 'Client Phone',
      'Instructor Name', 'Instructor Suburb', 'Instructor State',
      'Pickup Address', 'Booking Type',
    ];

    const rows = bookings.map(b => [
      b.id,
      b.status,
      b.createdAt?.toISOString() ?? '',
      b.startTime?.toLocaleDateString('en-AU', { timeZone: 'Australia/Perth' }) ?? '',
      b.startTime?.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Perth' }) ?? '',
      b.duration ?? '',
      b.price ?? '',
      b.platformFee ?? '',
      b.instructorPayout ?? '',
      b.commissionRate ? (b.commissionRate * 100).toFixed(1) + '%' : '',
      b.isPaid ? 'Yes' : 'No',
      (b as any).isPackageBooking ? 'Yes' : 'No',
      (b as any).packageHours ?? '',
      b.client?.name ?? b.clientName ?? '',
      b.client?.user?.email ?? '',
      b.client?.phone ?? b.clientPhone ?? '',
      b.instructor?.name ?? '',
      b.instructor?.suburb ?? '',
      b.instructor?.state ?? '',
      b.pickupAddress ?? '',
      b.bookingType ?? '',
    ]);

    return csvResponse(`drivebook-bookings-${dateTag}.csv`, header, rows);
  }

  // ── Revenue export ────────────────────────────────────────────────────────
  if (type === 'revenue') {
    const createdAtFilter = dateFilter(from, to);
    const transactions = await (prisma as any).transaction.findMany({
      where: {
        status: 'SETTLED',
        type: 'BOOKING_PAYMENT',
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
      select: {
        id: true,
        createdAt: true,
        amount: true,
        platformFee: true,
        instructorPayout: true,
        commissionRate: true,
        status: true,
        booking: {
          select: {
            id: true,
            status: true,
            instructor: { select: { name: true, suburb: true, state: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' } as any,
    });

    const header = [
      'Transaction ID', 'Date', 'Gross Amount ($)', 'Platform Fee ($)',
      'Instructor Payout ($)', 'Commission %', 'Status',
      'Booking ID', 'Booking Status', 'Instructor', 'Suburb', 'State',
    ];

    const rows = transactions.map((t: any) => [
      t.id,
      t.createdAt?.toLocaleDateString('en-AU', { timeZone: 'Australia/Perth' }) ?? '',
      t.amount ?? '',
      t.platformFee ?? '',
      t.instructorPayout ?? '',
      t.commissionRate ? (t.commissionRate * 100).toFixed(1) + '%' : '',
      t.status,
      t.booking?.id ?? '',
      t.booking?.status ?? '',
      t.booking?.instructor?.name ?? '',
      t.booking?.instructor?.suburb ?? '',
      t.booking?.instructor?.state ?? '',
    ]);

    // Summary row at top
    const totalGross   = transactions.reduce((s: number, t: any) => s + (t.amount ?? 0), 0);
    const totalFee     = transactions.reduce((s: number, t: any) => s + (t.platformFee ?? 0), 0);
    const totalPayout  = transactions.reduce((s: number, t: any) => s + (t.instructorPayout ?? 0), 0);

    const summaryRows = [
      ['SUMMARY', '', totalGross.toFixed(2), totalFee.toFixed(2), totalPayout.toFixed(2), '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', ''],
      ...rows,
    ];

    return csvResponse(`drivebook-revenue-${dateTag}.csv`, header, summaryRows);
  }

  // ── Instructors export ────────────────────────────────────────────────────
  if (type === 'instructors') {
    const instructors = await prisma.instructor.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        baseAddress: true,
        suburb:   true,
        state:    true,
        postcode: true,
        serviceAreas: true,
        hourlyRate: true,
        vehicleTypes: true,
        languages: true,
        averageRating: true,
        totalReviews: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        approvalStatus: true,
        isActive: true,
        abnVerified: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        createdAt: true,
        user: { select: { email: true } },
        _count: { select: { bookings: true, clients: true } },
      } as any,
      orderBy: { createdAt: 'desc' } as any,
    });

    const header = [
      'ID', 'Name', 'Email', 'Phone',
      'Base Address', 'Suburb', 'State', 'Postcode', 'Service Areas',
      'Hourly Rate', 'Vehicle Types', 'Languages',
      'Avg Rating', 'Total Reviews', 'Total Bookings', 'Total Clients',
      'Subscription Tier', 'Subscription Status', 'Trial Ends At',
      'Approval Status', 'Active', 'ABN Verified',
      'Stripe Charges Enabled', 'Stripe Payouts Enabled',
      'Joined',
    ];

    const rows = (instructors as any[]).map(i => [
      i.id,
      i.name,
      i.user?.email ?? '',
      i.phone,
      i.baseAddress ?? '',
      i.suburb ?? '',
      i.state ?? '',
      i.postcode ?? '',
      i.serviceAreas ?? '',
      i.hourlyRate,
      i.vehicleTypes ?? '',
      i.languages ?? '',
      i.averageRating ?? '',
      i.totalReviews ?? 0,
      i._count?.bookings ?? 0,
      i._count?.clients ?? 0,
      i.subscriptionTier,
      i.subscriptionStatus,
      i.trialEndsAt ? new Date(i.trialEndsAt).toLocaleDateString('en-AU') : '',
      i.approvalStatus,
      i.isActive ? 'Yes' : 'No',
      i.abnVerified ? 'Yes' : 'No',
      i.chargesEnabled ? 'Yes' : 'No',
      i.payoutsEnabled ? 'Yes' : 'No',
      i.createdAt ? new Date(i.createdAt).toLocaleDateString('en-AU') : '',
    ]);

    return csvResponse(`drivebook-instructors-${dateTag}.csv`, header, rows);
  }

  return NextResponse.json({ error: 'Invalid type. Use: bookings, revenue, or instructors' }, { status: 400 });
}
