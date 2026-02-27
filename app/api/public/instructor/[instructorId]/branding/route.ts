import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { instructorId: string } }
) {
  try {
    const { instructorId } = params;

    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: {
        brandLogo: true,
        brandColorPrimary: true,
        brandColorSecondary: true,
        showBrandingOnBookingPage: true,
        subscriptionTier: true,
      },
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Only return branding if enabled and PRO/BUSINESS tier
    if (
      !instructor.showBrandingOnBookingPage ||
      (instructor.subscriptionTier !== 'PRO' && instructor.subscriptionTier !== 'BUSINESS')
    ) {
      return NextResponse.json({
        enabled: false,
        brandLogo: null,
        brandColorPrimary: null,
        brandColorSecondary: null,
      });
    }

    return NextResponse.json({
      enabled: true,
      brandLogo: instructor.brandLogo,
      brandColorPrimary: instructor.brandColorPrimary || '#3B82F6',
      brandColorSecondary: instructor.brandColorSecondary || '#10B981',
    });
  } catch (error) {
    console.error('Error fetching instructor branding:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branding' },
      { status: 500 }
    );
  }
}
