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
    let decoded: { userId: string; role: string; instructorId?: string };
    try {
      decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as typeof decoded;
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!decoded.instructorId || (decoded.role !== 'INSTRUCTOR' && decoded.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        instructorId: decoded.instructorId,
        bookingType: 'PDA_TEST',
        deletedAt: null,
      } as any,
      include: { client: true },
      orderBy: { startTime: 'desc' },
    });

    const tests = bookings.map((b: any) => ({
      id: b.id,
      testDate: b.startTime,
      testTime: b.startTime
        ? new Date(b.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '',
      testCenterName: b.pickupAddress || 'Test Centre',
      testCenterAddress: b.pickupAddress || '',
      result: b.instructorNotes?.startsWith('RESULT:')
        ? b.instructorNotes.split(':')[1]?.trim() ?? 'PENDING'
        : 'PENDING',
      notes: b.notes || '',
      status: b.status,
      client: b.client
        ? { name: b.client.name, phone: b.client.phone, email: b.client.email }
        : { name: b.clientName || 'Unknown', phone: b.clientPhone || '', email: '' },
    }));

    return NextResponse.json(tests);
  } catch (error) {
    console.error('PDA tests mobile GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
