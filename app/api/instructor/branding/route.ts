import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'INSTRUCTOR' && session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructor = await prisma.instructor.findFirst({
      where: session.user.instructorId
        ? { id: session.user.instructorId }
        : { userId: session.user.id },
      select: {
        brandLogo: true,
        brandColorPrimary: true,
        brandColorSecondary: true,
        showBrandingOnBookingPage: true,
        customSlug: true,
        customDomain: true,
        domainVerified: true,
        domainVerifiedAt: true,
        subscriptionTier: true,
      },
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    return NextResponse.json(instructor);
  } catch (error) {
    console.error('Error fetching branding:', error);
    return NextResponse.json({ error: 'Failed to fetch branding settings' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'INSTRUCTOR' && session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructor = await prisma.instructor.findFirst({
      where: session.user.instructorId
        ? { id: session.user.instructorId }
        : { userId: session.user.id },
      select: { id: true, subscriptionTier: true, subscriptionStatus: true, trialEndsAt: true },
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Feature gate: Check trial status for branded pages
    const isTrialExpired = instructor.subscriptionStatus === 'TRIAL' && 
                          instructor.trialEndsAt && 
                          new Date(instructor.trialEndsAt) < new Date();
    
    if (isTrialExpired && instructor.subscriptionTier !== 'BASIC') {
      return NextResponse.json({ 
        error: 'Your trial has expired. Upgrade to a paid plan to use branding features.' 
      }, { status: 403 });
    }

    const body = await req.json();
    const { brandLogo, brandColorPrimary, brandColorSecondary, showBrandingOnBookingPage, customSlug, customDomain } = body;

    // Validate slug if provided
    if (customSlug) {
      const slugRegex = /^[a-z0-9-]{3,30}$/;
      if (!slugRegex.test(customSlug)) {
        return NextResponse.json(
          { error: 'Invalid slug format. Use lowercase letters, numbers, and hyphens only (3–30 characters)' },
          { status: 400 }
        );
      }
      const existing = await prisma.instructor.findFirst({
        where: { customSlug, id: { not: instructor.id } },
      });
      if (existing) {
        return NextResponse.json({ error: 'This slug is already taken. Please choose another.' }, { status: 400 });
      }
    }

    // Validate hex colors
    const hexRegex = /^#[0-9A-F]{6}$/i;
    if (brandColorPrimary && !hexRegex.test(brandColorPrimary)) {
      return NextResponse.json({ error: 'Invalid primary color format. Use hex (#RRGGBB)' }, { status: 400 });
    }
    if (brandColorSecondary && !hexRegex.test(brandColorSecondary)) {
      return NextResponse.json({ error: 'Invalid secondary color format. Use hex (#RRGGBB)' }, { status: 400 });
    }

    const updated = await prisma.instructor.update({
      where: { id: instructor.id },
      data: {
        brandLogo: brandLogo || null,
        brandColorPrimary: brandColorPrimary || null,
        brandColorSecondary: brandColorSecondary || null,
        showBrandingOnBookingPage: showBrandingOnBookingPage === true,
        customSlug: customSlug || null,
        customDomain: customDomain || null,
      },
      select: {
        brandLogo: true,
        brandColorPrimary: true,
        brandColorSecondary: true,
        showBrandingOnBookingPage: true,
        customSlug: true,
        customDomain: true,
      },
    });

    return NextResponse.json({ success: true, branding: updated });
  } catch (error) {
    console.error('Error updating branding:', error);
    return NextResponse.json({ error: 'Failed to update branding settings' }, { status: 500 });
  }
}
