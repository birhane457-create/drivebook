import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';


export const dynamic = 'force-dynamic';
const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key';

interface JWTPayload {
  userId: string;
  role: string;
  instructorId: string;
}

// GET - Get instructor settings
export async function GET(req: NextRequest) {
  try {
    console.log('[Settings Mobile API] GET request received');
    
    // Get token from Authorization header
    const authHeader = req.headers.get('authorization');
    console.log('[Settings Mobile API] Authorization header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Settings Mobile API] No valid authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify token
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      console.log('[Settings Mobile API] Token decoded:', decoded);
    } catch (error) {
      console.log('[Settings Mobile API] Token verification failed:', error);
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

    console.log('[Settings Mobile API] Settings retrieved successfully');
    return NextResponse.json(instructor);
  } catch (error) {
    console.error('[Settings Mobile API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PUT - Update instructor settings
export async function PUT(req: NextRequest) {
  try {
    console.log('[Settings Mobile API] PUT request received');
    
    // Get token from Authorization header
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Settings Mobile API] No valid authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify token
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      console.log('[Settings Mobile API] Token decoded:', decoded);
    } catch (error) {
      console.log('[Settings Mobile API] Token verification failed:', error);
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

    console.log('[Settings Mobile API] Settings updated successfully');
    return NextResponse.json(updatedInstructor);
  } catch (error) {
    console.error('[Settings Mobile API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
