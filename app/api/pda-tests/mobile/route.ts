// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded: { userId: string; role: string; providerId?: string };
    try {
      decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as typeof decoded;
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!decoded.providerId || (decoded.role !== 'provider' && decoded.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        providerId: decoded.providerId,
        bookingType: 'PDA_TEST',
        deletedAt: null,
      } as any,
      include: { customer: true },
      orderBy: { startTime: 'desc' },
    });

    const tests = bookings.map((b: any) => ({
      id: b.id,
      testDate: b.startTime,
      testTime: b.startTime
        ? new Date(b.startTime).toISOString().slice(11, 16)
        : '',
      testCenterName: b.pickupAddress || 'Test Centre',
      testCenterAddress: b.pickupAddress || '',
      result: b.instructorNotes?.startsWith('RESULT:')
        ? b.instructorNotes.split(':')[1]?.trim() ?? 'PENDING'
        : 'PENDING',
      notes: b.notes || '',
      status: b.status,
      client: b.client
        ? { name: b.customer.name, phone: b.customer.phone, email: b.customer.email }
        : { name: b.customerName || 'Unknown', phone: b.customerPhone || '', email: '' },
    }));

    return NextResponse.json(tests);
  } catch (error) {
    console.error('PDA tests mobile GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
