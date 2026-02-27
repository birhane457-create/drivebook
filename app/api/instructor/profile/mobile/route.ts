import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    console.log('[Instructor Profile Mobile API] Request received');
    
    // JWT authentication for mobile
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Instructor Profile Mobile API] No authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let instructorId: string;

    try {
      const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
        userId: string;
        role: string;
        instructorId?: string;
      };
      
      console.log('[Instructor Profile Mobile API] Token decoded:', { 
        userId: decoded.userId, 
        role: decoded.role, 
        instructorId: decoded.instructorId 
      });
      
      if (!decoded.instructorId) {
        console.log('[Instructor Profile Mobile API] No instructorId in token');
        return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
      }
      
      instructorId = decoded.instructorId;
    } catch (error) {
      console.log('[Instructor Profile Mobile API] Token verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get instructor profile
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
    });

    if (!instructor) {
      console.log('[Instructor Profile Mobile API] Instructor not found');
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    console.log('[Instructor Profile Mobile API] Profile found:', instructor.id);
    return NextResponse.json(instructor);
  } catch (error) {
    console.error('[Instructor Profile Mobile API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
