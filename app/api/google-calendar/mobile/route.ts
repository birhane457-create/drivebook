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

// GET - Get calendar connection status
export async function GET(req: NextRequest) {
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

    const instructor = await prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        syncGoogleCalendar: true,
        googleTokenExpiry: true,
        calendarBufferMode: true,
      }
    });

    return NextResponse.json({
      connected: instructor?.syncGoogleCalendar || false,
      tokenExpiry: instructor?.googleTokenExpiry,
      bufferMode: instructor?.calendarBufferMode || 'auto',
    });
  } catch (error) {
    logger.error('Get calendar status error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Get auth URL to connect
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

    const authUrl = googleCalendarService.getAuthUrl(providerId);

    return NextResponse.json({ authUrl });
  } catch (error) {
    logger.error('Get auth URL error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Disconnect calendar
export async function DELETE(req: NextRequest) {
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

    await googleCalendarService.disconnect(providerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Disconnect calendar error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
