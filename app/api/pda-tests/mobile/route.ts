import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export async function GET(req: NextRequest) {
  try {
    console.log('[PDA Tests Mobile API] Request received');
    
    // JWT authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[PDA Tests Mobile API] No authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
        userId: string;
        role: string;
        instructorId?: string;
      };
      console.log('[PDA Tests Mobile API] Token decoded:', { userId: decoded.userId, role: decoded.role, instructorId: decoded.instructorId });
    } catch (error) {
      console.log('[PDA Tests Mobile API] Token verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Allow INSTRUCTOR or SUPER_ADMIN roles
    if (!decoded.instructorId) {
      console.log('[PDA Tests Mobile API] Authorization failed - no instructorId');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    if (decoded.role !== 'INSTRUCTOR' && decoded.role !== 'SUPER_ADMIN') {
      console.log('[PDA Tests Mobile API] Authorization failed - invalid role:', decoded.role);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all PDA tests for this instructor
    const tests = await prisma.pDATest.findMany({
      where: {
        instructorId: decoded.instructorId,
      },
      include: {
        client: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: {
        testDate: 'desc',
      },
    });

    return NextResponse.json(tests);
  } catch (error) {
    console.error('PDA tests GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
