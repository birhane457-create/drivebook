import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET — list all active test centres (accessible to authenticated instructors)
export async function GET() {
  try {
    const centres = await prisma.testCentre.findMany({
      where: { isActive: true },
      orderBy: [{ region: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, address: true, suburb: true, region: true, lat: true, lng: true },
    });
    return NextResponse.json(centres);
  } catch (error) {
    console.error('Test centres fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch test centres' }, { status: 500 });
  }
}
