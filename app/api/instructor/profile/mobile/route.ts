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
    let providerId: string;

    try {
      const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
        userId: string;
        role: string;
        providerId?: string;
      };
      
      console.log('[Instructor Profile Mobile API] Token decoded:', { 
        userId: decoded.userId, 
        role: decoded.role, 
        providerId: decoded.providerId 
      });
      
      if (!decoded.providerId) {
        console.log('[Instructor Profile Mobile API] No providerId in token');
        return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
      }
      
      providerId = decoded.providerId;
    } catch (error) {
      console.log('[Instructor Profile Mobile API] Token verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get instructor profile
    const instructor = await prisma.provider.findUnique({
      where: { id: providerId },
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
