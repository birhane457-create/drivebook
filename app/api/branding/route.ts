import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const instructorId = searchParams.get('instructorId');

    if (!instructorId) {
      return NextResponse.json(
        { error: 'instructorId is required' },
        { status: 400 }
      );
    }

    // Fetch instructor branding settings
    const instructor = await prisma.user.findUnique({
      where: {
        id: instructorId,
        role: 'INSTRUCTOR',
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        // Add branding fields when you add them to schema
        // brandingColor: true,
        // brandingLogo: true,
        // businessName: true,
      },
    });

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      );
    }

    // Return branding configuration
    // TODO: Add actual branding fields to User model
    return NextResponse.json({
      instructorId: instructor.id,
      businessName: instructor.name || 'DriveBook',
      logo: instructor.image || '/logo.png',
      primaryColor: '#4F46E5', // Default indigo
      // When you add branding fields:
      // primaryColor: instructor.brandingColor || '#4F46E5',
      // logo: instructor.brandingLogo || instructor.image || '/logo.png',
      // businessName: instructor.businessName || instructor.name || 'DriveBook',
    });
  } catch (error) {
    console.error('Error fetching branding:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branding' },
      { status: 500 }
    );
  }
}
