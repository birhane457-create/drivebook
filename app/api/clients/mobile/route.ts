// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    console.log('[Clients Mobile API] Request received');
    
    // JWT authentication for mobile
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Clients Mobile API] No authorization header');
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
      
      console.log('[Clients Mobile API] Token decoded:', { userId: decoded.userId, role: decoded.role, providerId: decoded.providerId });
      
      if (!decoded.providerId) {
        console.log('[Clients Mobile API] No providerId in token');
        return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
      }
      
      providerId = decoded.providerId;
    } catch (error) {
      console.log('[Clients Mobile API] Token verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get all clients for this instructor
    const clients = await prisma.customer.findMany({
      where: { providerId },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        addressText: true,
        notes: true,
        createdAt: true,
      },
    });

    console.log('[Clients Mobile API] Found clients:', clients.length);
    return NextResponse.json(clients);
  } catch (error) {
    console.error('[Clients Mobile API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}
