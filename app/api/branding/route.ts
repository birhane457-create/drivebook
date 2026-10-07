import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/branding?providerId=<id>
 *
 * Public endpoint — returns display-only branding for the mobile booking page.
 * MobileLayout.tsx calls this to render logo/colours for an instructor's booking page.
 *
 * V-17 FIX: The original endpoint returned name and email (PII) with no authentication.
 * This version returns only display branding fields (logo, colours, businessName).
 * name/email are NOT returned. providerId is echoed back as it was caller-supplied anyway.
 */
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

    // V-17 FIX: select only public display branding fields — no PII (name, email)
    const provider = await prisma.provider.findFirst({
      where: { id: providerId },
      select: {
        businessName:      true,
        brandLogo:         true,
        brandColorPrimary: true,
        showBrandingOnBookingPage: true,
      },
    });

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      providerId,
      businessName: provider.businessName ?? 'DriveBook',
      logo:         provider.brandLogo ?? '/logo.png',
      primaryColor: provider.brandColorPrimary ?? '#4F46E5',
    });
  } catch (error) {
    console.error('Error fetching branding:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branding' },
      { status: 500 }
    );
  }
}
