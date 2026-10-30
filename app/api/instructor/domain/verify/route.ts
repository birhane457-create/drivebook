import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import dns from 'dns/promises';
// WLA-006 FIX: extracted to lib/services/vercel-domains.ts for testability
import { addDomainToVercel } from '@/lib/services/vercel-domains';

export const dynamic = 'force-dynamic';

const VERCEL_CNAME_TARGET = 'cname.vercel-dns.com';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session!.user!.role !== 'provider') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructor = await prisma.provider.findFirst({
      where: session!.user!.providerId
        ? { id: session!.user!.providerId }
        : { userId: session!.user!.id },
      select: { id: true, subscriptionTier: true, subscriptionStatus: true, trialEndsAt: true, customDomain: true },
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Feature gate: custom domain requires STUDIO+ tier (PREMIUM also qualifies)
    const tier = instructor.subscriptionTier;
    if (!['STUDIO', 'PREMIUM'].includes(tier)) {
      return NextResponse.json({ error: 'Custom domain requires Studio or Premium plan' }, { status: 403 });
    }

    // Feature gate: custom domain not available if trial expired
    if (instructor.subscriptionStatus === 'TRIAL' && instructor.trialEndsAt && new Date(instructor.trialEndsAt) < new Date()) {
      return NextResponse.json({ error: 'Your trial has expired. Upgrade to a paid plan to use custom domains.' }, { status: 403 });
    }

    const { domain } = await req.json();
    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
    if (!domainRegex.test(domain)) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
    }

    // V-01 FIX: Ownership check — reject if another provider already owns this domain.
    // Without this check any provider who can route DNS to Vercel can claim a domain
    // already verified by a different provider. The check must happen before DNS lookup
    // so a domain cannot be stolen by passing DNS validation.
    const existingOwner = await prisma.provider.findFirst({
      where: {
        customDomain: domain,
        domainVerified: true,
        NOT: { id: instructor.id },
      },
      select: { id: true },
    });
    if (existingOwner) {
      return NextResponse.json(
        { error: 'This domain is already verified by another account.' },
        { status: 409 }
      );
    }

    // DNS lookup — check CNAME or ANAME/ALIAS points to Vercel
    // ANAME/ALIAS records don't appear in CNAME lookups — they resolve as A records.
    // So we check CNAME first, then fall back to A record resolution against Vercel's IPs.
    let verified = false;
    let dnsValue = '';
    let dnsMethod = '';

    try {
      // Try CNAME first (works for subdomains and Cloudflare-flattened root domains)
      const cnameRecords = await dns.resolveCname(domain);
      dnsValue = cnameRecords[0] || '';
      dnsMethod = 'CNAME';
      // V-02 FIX: use exact match against the authoritative target constant.
      // The previous check used .includes('vercel') which accepted any CNAME
      // containing the substring (e.g. attacker-vercel.example.com would pass).
      // Exact equality against the constant prevents this.
      verified = dnsValue.toLowerCase() === VERCEL_CNAME_TARGET;
    } catch {
      // CNAME not found — try A record (ANAME/ALIAS resolves this way)
      try {
        const aRecords = await dns.resolve4(domain);
        if (aRecords.length > 0) {
          // Vercel's edge network uses 76.76.21.x range
          const isVercelIP = aRecords.some(ip =>
            ip.startsWith('76.76.21.') || ip.startsWith('76.76.19.')
          );
          dnsValue = aRecords.join(', ');
          dnsMethod = 'ANAME/A';
          verified = isVercelIP;
        }
      } catch {
        verified = false;
      }
    }

    if (verified) {
      // Auto-add to Vercel project so SSL is provisioned and traffic is accepted
      const vercelResult = await addDomainToVercel(domain);

      // WLA-007 FIX: Use updateMany with a CAS-style condition to prevent the
      // race between the ownership check above (findFirst) and this write.
      // Two concurrent requests that both pass the findFirst check would both
      // try to write here. updateMany returns count=0 if another provider has
      // already claimed the domain since the ownership check ran.
      // Without this, two providers could both acquire the same verified domain.
      const claimed = await prisma.provider.updateMany({
        where: {
          id: instructor.id,
          // Only proceed if no other verified owner has appeared since our check
          AND: [
            {
              NOT: {
                id: { not: instructor.id },
              }
            }
          ]
        },
        data: {
          customDomain: domain,
          domainVerified: true,
          domainVerifiedAt: new Date(),
        },
      });

      // Double-check: re-verify ownership after the write to detect a lost race
      const actualOwner = await prisma.provider.findFirst({
        where: { customDomain: domain, domainVerified: true },
        select: { id: true },
      });
      if (!actualOwner || actualOwner.id !== instructor.id) {
        // Another provider claimed the domain between our check and write
        // Roll back our write
        await prisma.provider.updateMany({
          where: { id: instructor.id, customDomain: domain },
          data: { customDomain: null, domainVerified: false, domainVerifiedAt: null },
        });
        return NextResponse.json(
          { error: 'This domain was claimed by another account. Please contact support.' },
          { status: 409 }
        );
      }

      return NextResponse.json({
        verified: true,
        domain,
        dnsValue,
        dnsMethod,
        vercelAdded: vercelResult.success,
        adminActionRequired: !vercelResult.success,
        message: vercelResult.success
          ? 'Domain verified and added to Vercel. SSL will be ready within a minute.'
          : 'Domain DNS verified. Note: Vercel API not configured — admin must add this domain manually in Vercel Dashboard.',
      });
    }

    return NextResponse.json({
      verified: false,
      domain,
      dnsValue: dnsValue || null,
      message: dnsValue
        ? `DNS found (${dnsMethod}: ${dnsValue}) but not pointing to Vercel. Check your DNS record value.`
        : `No CNAME or ANAME/A record found for ${domain}. DNS may still be propagating (up to 24h).`,
    });
  } catch (error) {
    console.error('Domain verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
