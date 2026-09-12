import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDisplayName } from '@/lib/utils/account';

export const dynamic = 'force-dynamic';
export async function GET(
  _req: NextRequest,
  { params }: { params: { instructorId: string } }
) {
  try {
    const { instructorId } = params;

    const instructor = await prisma.provider.findUnique({
      where: { id: instructorId },
      select: {
        name: true,
        businessName: true,
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

    const displayName = getDisplayName(instructor as any);

    // Only return full branding if enabled and PRO/STUDIO/PREMIUM tier
    if (
      !instructor.showBrandingOnBookingPage ||
      (instructor.subscriptionTier !== 'PRO' &&
       instructor.subscriptionTier !== 'STUDIO' &&
       instructor.subscriptionTier !== 'PREMIUM')
    ) {
      return NextResponse.json({
        enabled: false,
        displayName,
        brandLogo: null,
        brandColorPrimary: null,
        brandColorSecondary: null,
      });
    }

    return NextResponse.json({
      enabled: true,
      displayName,
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
