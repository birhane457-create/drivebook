import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { googleCalendarService } from '@/lib/services/googleCalendar';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.NEXTAUTH_SECRET
if (!JWT_SECRET) throw new Error('NEXTAUTH_SECRET is not configured')

interface JWTPayload {
  userId: string;
  role: string;
  providerId: string;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET!) as unknown as JWTPayload;
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { providerId } = decoded;

    // INT-M-03F FIX: verify calendar is still connected before calling Google
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { syncGoogleCalendar: true },
    });
    if (!provider?.syncGoogleCalendar) {
      return NextResponse.json(
        { error: 'Google Calendar is not connected', code: 'CALENDAR_NOT_CONNECTED' },
        { status: 400 }
      );
    }

    const result = await googleCalendarService.syncCalendarEvents(providerId);

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('Sync calendar error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
