import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';


export const dynamic = 'force-dynamic';
const JWT_SECRET = process.env.NEXTAUTH_SECRET
if (!JWT_SECRET) throw new Error('NEXTAUTH_SECRET is not configured')

interface JWTPayload {
  userId: string;
  role: string;
  instructorId: string;
}

// GET - Get instructor settings
export async function GET(req: NextRequest) {
  try {
    logger.info('[Settings Mobile API] GET request received');
    
    // Get token from Authorization header
    const authHeader = req.headers.get('authorization');
    logger.info('[Settings Mobile API] Authorization header', {
      present: !!authHeader,
    });
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.info('[Settings Mobile API] No valid authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify token
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET!) as unknown as JWTPayload;
      logger.info('[Settings Mobile API] Token decoded', decoded as unknown as Record<string, unknown>);
    } catch (error) {
      logger.info('[Settings Mobile API] Token verification failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { instructorId } = decoded;

    // Get instructor settings
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: {
        hourlyRate: true,
        serviceRadiusKm: true,
        bookingBufferMinutes: true,
        enableTravelTime: true,
        travelTimeMinutes: true,
        allowedDurations: true,
        workingHours: true,
      },
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    logger.info('[Settings Mobile API] Settings retrieved successfully');
    return NextResponse.json(instructor);
  } catch (error) {
    logger.error('[Settings Mobile API] Error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PUT - Update instructor settings
export async function PUT(req: NextRequest) {
  try {
    logger.info('[Settings Mobile API] PUT request received');
    
    // Get token from Authorization header
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.info('[Settings Mobile API] No valid authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify token
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET!) as unknown as JWTPayload;
      logger.info('[Settings Mobile API] Token decoded', decoded as unknown as Record<string, unknown>);
    } catch (error) {
      logger.info('[Settings Mobile API] Token verification failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { instructorId } = decoded;
    const body = await req.json();

    // Validate required fields
    if (body.hourlyRate !== undefined && body.hourlyRate <= 0) {
      return NextResponse.json(
        { error: 'Hourly rate must be greater than 0' },
        { status: 400 }
      );
    }

    if (body.allowedDurations && body.allowedDurations.length === 0) {
      return NextResponse.json(
        { error: 'At least one lesson duration must be selected' },
        { status: 400 }
      );
    }

    // Update instructor settings
    const updatedInstructor = await prisma.instructor.update({
      where: { id: instructorId },
      data: {
        hourlyRate: body.hourlyRate,
        serviceRadiusKm: body.serviceRadiusKm,
        bookingBufferMinutes: body.bookingBufferMinutes,
        enableTravelTime: body.enableTravelTime,
        travelTimeMinutes: body.travelTimeMinutes,
        allowedDurations: body.allowedDurations,
        workingHours: body.workingHours,
      },
      select: {
        hourlyRate: true,
        serviceRadiusKm: true,
        bookingBufferMinutes: true,
        enableTravelTime: true,
        travelTimeMinutes: true,
        allowedDurations: true,
        workingHours: true,
      },
    });

    logger.info('[Settings Mobile API] Settings updated successfully');
    return NextResponse.json(updatedInstructor);
  } catch (error) {
    logger.error('[Settings Mobile API] Error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
