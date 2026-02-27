import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // JWT authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Allow INSTRUCTOR or SUPER_ADMIN roles
    if (!decoded.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    if (decoded.role !== 'INSTRUCTOR' && decoded.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { result } = await req.json();

    if (!result || !['PASS', 'FAIL', 'PENDING'].includes(result)) {
      return NextResponse.json({ error: 'Invalid result' }, { status: 400 });
    }

    // Verify test belongs to this instructor
    const test = await prisma.pDATest.findUnique({
      where: { id: params.id },
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    if (test.instructorId !== decoded.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update test result
    const updatedTest = await prisma.pDATest.update({
      where: { id: params.id },
      data: { result },
    });

    return NextResponse.json(updatedTest);
  } catch (error) {
    console.error('PDA test PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
