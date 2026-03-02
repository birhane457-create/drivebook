import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'INSTRUCTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructor = await prisma.instructor.findUnique({
      where: { userId: session.user.id },
      select: {
        brandLogo: true,
        brandColorPrimary: true,
        brandColorSecondary: true,
        showBrandingOnBookingPage: true,
        customDomain: true,
        subscriptionTier: true,
      },
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Allow access for all tiers (BASIC users will see upgrade prompt in UI)
    // PRO and BUSINESS users can use branding features

    return NextResponse.json(instructor);
  } catch (error) {
    console.error('Error fetching branding:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branding settings' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'INSTRUCTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructor = await prisma.instructor.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        subscriptionTier: true,
      },
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Allow access for all tiers (BASIC users will see upgrade prompt in UI)
    // PRO and BUSINESS users can use branding features

    const body = await req.json();
    const {
      brandLogo,
      brandColorPrimary,
      brandColorSecondary,
      showBrandingOnBookingPage,
      customDomain,
    } = body;

    // Validate subdomain if provided
    if (customDomain) {
      // Check format
      const subdomainRegex = /^[a-z0-9-]{3,30}$/;
      if (!subdomainRegex.test(customDomain)) {
        return NextResponse.json(
          { error: 'Invalid subdomain format. Use lowercase letters, numbers, and hyphens only (3-30 characters)' },
          { status: 400 }
        );
      }

      // Check if already taken by another instructor
      const existing = await prisma.instructor.findFirst({
        where: {
          customDomain: customDomain,
          id: { not: instructor.id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'This subdomain is already taken. Please choose another one.' },
          { status: 400 }
        );
      }
    }

    // Validate hex colors
    const hexColorRegex = /^#[0-9A-F]{6}$/i;
    if (brandColorPrimary && !hexColorRegex.test(brandColorPrimary)) {
      return NextResponse.json(
        { error: 'Invalid primary color format. Use hex format (#RRGGBB)' },
        { status: 400 }
      );
    }

    if (brandColorSecondary && !hexColorRegex.test(brandColorSecondary)) {
      return NextResponse.json(
        { error: 'Invalid secondary color format. Use hex format (#RRGGBB)' },
        { status: 400 }
      );
    }

    // Update branding settings
    const updated = await prisma.instructor.update({
      where: { id: instructor.id },
      data: {
        brandLogo: brandLogo || null,
        brandColorPrimary: brandColorPrimary || null,
        brandColorSecondary: brandColorSecondary || null,
        showBrandingOnBookingPage: showBrandingOnBookingPage || false,
        customDomain: customDomain || null,
      },
      select: {
        brandLogo: true,
        brandColorPrimary: true,
        brandColorSecondary: true,
        showBrandingOnBookingPage: true,
        customDomain: true,
      },
    });

    return NextResponse.json({
      success: true,
      branding: updated,
    });
  } catch (error) {
    console.error('Error updating branding:', error);
    return NextResponse.json(
      { error: 'Failed to update branding settings' },
      { status: 500 }
    );
  }
}
