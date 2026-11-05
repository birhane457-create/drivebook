import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session!.user!.role !== 'provider' && session!.user!.role !== 'ADMIN' && session!.user!.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructor = await prisma.provider.findFirst({
      where: session!.user!.providerId
        ? { id: session!.user!.providerId }
        : { userId: session!.user!.id },
      select: {
        id: true,
        customDomain: true,
        domainVerified: true,
        domainVerifiedAt: true,
        subscriptionTier: true,
        accountType: true,
        businessName: true,
        // Legacy fields retained for backward compatibility if canonical is absent
        brandLogo: true,
        brandColorPrimary: true,
        brandColorSecondary: true,
        showBrandingOnBookingPage: true,
        customSlug: true,
      },
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // WLA-014 v3: GET returns canonical branding from BusinessBranding store.
    // Translates field names back to legacy Provider names so the dashboard
    // remains backward-compatible (it reads brandLogo, brandColorPrimary etc).
    const { resolveProviderBranding } = await import('@/lib/branding/resolution')
    const canonical = await resolveProviderBranding(instructor.id)

    return NextResponse.json({
      // Canonical branding fields (translated to Provider field names for dashboard compat)
      brandLogo:                canonical.logo,
      brandColorPrimary:        canonical.primaryColour,
      brandColorSecondary:      canonical.secondaryColour,
      showBrandingOnBookingPage: !canonical.showPlatformBranding,  // inversion
      customSlug:               canonical.customSlug,
      // Non-branding fields always from Provider
      customDomain:             instructor.customDomain,
      domainVerified:           instructor.domainVerified,
      domainVerifiedAt:         instructor.domainVerifiedAt,
      subscriptionTier:         instructor.subscriptionTier,
      accountType:              instructor.accountType,
      businessName:             instructor.businessName,
      // Diagnostic: let the client know where branding came from
      brandingSource:           canonical.source,
    });
  } catch (error) {
    console.error('Error fetching branding:', error);
    return NextResponse.json({ error: 'Failed to fetch branding settings' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session!.user!.role !== 'provider' && session!.user!.role !== 'ADMIN' && session!.user!.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructor = await prisma.provider.findFirst({
      where: session!.user!.providerId
        ? { id: session!.user!.providerId }
        : { userId: session!.user!.id },
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
    const { brandLogo, brandColorPrimary, brandColorSecondary, showBrandingOnBookingPage, customSlug, customDomain, businessName } = body;

    // V-06 FIX: customDomain requires STUDIO or PREMIUM tier.
    // The domain verify endpoint already enforces this gate; the legacy branding PUT
    // must match to prevent a lower-tier provider bypassing the entitlement check.
    // Other branding fields (colors, logo, businessName, customSlug) are not gated here.
    if (customDomain !== undefined && customDomain !== null && customDomain !== '') {
      if (!['STUDIO', 'PREMIUM'].includes(instructor.subscriptionTier)) {
        return NextResponse.json(
          { error: 'Custom domain requires Studio or Premium plan' },
          { status: 403 }
        );
      }
    }

    // businessName available to ALL tiers — any instructor can set a display/trading name.
    // Sole instructors use it for nicknames or trading names; schools use it for the school name.
    // It never replaces instructor.name in legal/payout contexts — display only.
    let cleanBusinessName: string | null | undefined = undefined;
    if (businessName !== undefined) {
      cleanBusinessName = businessName ? businessName.trim().slice(0, 80) || null : null;
    }

    // PREMIUM tier: business name is required — the premium entity cannot be nameless
    const { validateBusinessName } = await import('@/lib/branding/getDisplayIdentity')
    const nameValidation = await validateBusinessName({
      subscriptionTier: instructor.subscriptionTier,
      // Check against the incoming value (if being updated) or the existing DB value
      businessName: cleanBusinessName !== undefined ? cleanBusinessName : (instructor as any).businessName,
    })
    if (!nameValidation.valid) {
      return NextResponse.json({ error: nameValidation.error }, { status: 400 })
    }

    // Validate slug if provided
    if (customSlug) {
      const slugRegex = /^[a-z0-9-]{3,30}$/;
      if (!slugRegex.test(customSlug)) {
        return NextResponse.json(
          { error: 'Invalid slug format. Use lowercase letters, numbers, and hyphens only (3–30 characters)' },
          { status: 400 }
        );
      }
      // Best-effort pre-check for a clear error message before the transaction.
      // The authoritative uniqueness check is the SlugRegistry.claimSlug() call
      // inside the transaction below (P2002 → 409 if slug is taken cross-table).
      const existingProvider = await prisma.provider.findFirst({
        where: { customSlug, id: { not: instructor.id } },
        select: { id: true },
      });
      if (existingProvider) {
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

    // WLA-014-SLUG: Read the provider's current slug before writing.
    // Resolve the canonical Business ID so both routes share the same registry
    // ownership identity: ownerType='businessBranding', ownerId=resolvedBizId.
    // This prevents stale registry entries when slugs are set via either route.
    const currentProvider = await prisma.provider.findUnique({
      where: { id: instructor.id },
      select: { customSlug: true } as any,
    }) as any
    const oldSlug: string | null = currentProvider?.customSlug ?? null

    // Distinguish omitted (undefined) from explicitly cleared ('' → null).
    // When customSlug is omitted from the request, preserve the existing value
    // in the registry — do not release a claim that was never changed.
    const slugIsBeingChanged = customSlug !== undefined
    const newSlug: string | null = slugIsBeingChanged ? (customSlug || null) : oldSlug

    // Resolve the canonical Business ID for registry ownership.
    // Both routes must use the same (ownerType, ownerId) for the same entity.
    // Using ('businessBranding', resolvedBizId) is stable regardless of which route writes.
    const { resolveBusinessId } = await import('@/lib/branding/resolution')
    const resolvedBizId = await resolveBusinessId(instructor.id)
    // resolvedBizId may be null if no Business has been created yet (first save).
    // In that case we defer slug registry to the upsertBusinessBranding() call below,
    // which will create the Business and link Provider.businessId atomically.
    const registryOwnerId = resolvedBizId

    // WLA-014-SLUG v5: Wrap the Provider update AND the canonical BusinessBranding
    // upsert (including slug registry) in a SINGLE transaction. If the registry
    // claim fails (P2002), the entire transaction rolls back — the Provider's
    // customSlug is NOT left in an inconsistent state.
    let updated: any
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Slug registry update (only if we have a resolved bizId)
        if (slugIsBeingChanged && newSlug !== oldSlug && registryOwnerId) {
          const { updateSlugClaim } = await import('@/lib/branding/slug-registry')
          await updateSlugClaim(tx, 'businessBranding', registryOwnerId, oldSlug, newSlug)
        }

        // 2. Provider update (legacy compat fields + customSlug)
        updated = await tx.provider.update({
          where: { id: instructor.id },
          data: {
            brandLogo: brandLogo || null,
            brandColorPrimary: brandColorPrimary || null,
            brandColorSecondary: brandColorSecondary || null,
            showBrandingOnBookingPage: showBrandingOnBookingPage === true,
            ...(slugIsBeingChanged && { customSlug: customSlug || null }),
            ...(customDomain !== undefined && {
              customDomain: customDomain || null,
              domainVerified: false,
              domainVerifiedAt: null,
            }),
            ...(cleanBusinessName !== undefined && { businessName: cleanBusinessName }),
          },
          select: {
            brandLogo: true,
            brandColorPrimary: true,
            brandColorSecondary: true,
            showBrandingOnBookingPage: true,
            customSlug: true,
            customDomain: true,
            domainVerified: true,
            domainVerifiedAt: true,
            businessName: true,
          },
        })

        // 3. Canonical BusinessBranding upsert + slug registry (inside the same tx)
        const { upsertBusinessBranding } = await import('@/lib/branding/resolution')
        await upsertBusinessBranding(instructor.id, {
          ...(brandLogo !== undefined && { logo: brandLogo || null }),
          ...(brandColorPrimary !== undefined && { primaryColour: brandColorPrimary || '#3B82F6' }),
          ...(brandColorSecondary !== undefined && { secondaryColour: brandColorSecondary || null }),
          ...(customSlug !== undefined && { customSlug: customSlug || null }),
          ...(showBrandingOnBookingPage !== undefined && {
            showPlatformBranding: showBrandingOnBookingPage !== true,
          }),
        }, tx)  // Pass the outer tx so everything is atomic
      })
    } catch (txErr: any) {
      // Transaction failed — both Provider and BusinessBranding rolled back.
      // If it's a P2002 on slug, surface as 409.
      if (txErr?.code === 'P2002') {
        const target = txErr?.meta?.target?.toString() ?? ''
        if (target.includes('customSlug') || target.includes('slug')) {
          return NextResponse.json({ error: 'This slug is already taken. Please choose another.' }, { status: 409 })
        }
      }
      throw txErr
    }

    return NextResponse.json({ success: true, branding: updated });
  } catch (error) {
    // WLA-014-SLUG: P2002 on 'slug' means the SlugRegistry caught a concurrent
    // cross-table claim. P2002 on 'customSlug' means the per-table index caught
    // an in-table duplicate. Both surface as 409 Conflict.
    if ((error as any)?.code === 'P2002') {
      const target = (error as any)?.meta?.target?.toString() ?? ''
      if (target.includes('customSlug') || target.includes('slug')) {
        return NextResponse.json({ error: 'This slug is already taken. Please choose another.' }, { status: 409 });
      }
    }
    console.error('Error updating branding:', error);
    return NextResponse.json({ error: 'Failed to update branding settings' }, { status: 500 });
  }
}
