import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId');

    if (!providerId) {
      return NextResponse.json(
        { error: 'providerId is required' },
        { status: 400 }
      );
    }

    const instructor = await prisma.user.findUnique({
      where: {
        id: providerId,
        role: 'provider',
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      providerId: instructor.id,
      businessName: instructor.name || 'DriveBook',
      logo: '/logo.png',
      primaryColor: '#4F46E5',
    });
  } catch (error) {
    console.error('Error fetching branding:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branding' },
      { status: 500 }
    );
  }
}
