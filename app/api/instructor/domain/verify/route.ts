import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import dns from 'dns/promises';

export const dynamic = 'force-dynamic';

// Vercel's CNAME target for custom domains
const VERCEL_CNAME_TARGET = 'cname.vercel-dns.com';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'INSTRUCTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructor = await prisma.instructor.findFirst({
      where: session.user.instructorId
        ? { id: session.user.instructorId }
        : { userId: session.user.id },
      select: { id: true, subscriptionTier: true, customDomain: true },
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    if (instructor.subscriptionTier !== 'STUDIO' && instructor.subscriptionTier !== 'BUSINESS') {
      return NextResponse.json({ error: 'Custom domain requires Studio or Business plan' }, { status: 403 });
    }

    const { domain } = await req.json();
    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    // Basic domain format check
    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
    if (!domainRegex.test(domain)) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
    }

    // DNS lookup — check CNAME points to Vercel
    let verified = false;
    let dnsValue = '';
    try {
      const records = await dns.resolveCname(domain);
      dnsValue = records[0] || '';
      verified = dnsValue.toLowerCase().includes('vercel');
    } catch {
      // DNS lookup failed — domain not configured or doesn't exist yet
      verified = false;
    }

    if (verified) {
      await prisma.instructor.update({
        where: { id: instructor.id },
        data: {
          customDomain: domain,
          domainVerified: true,
          domainVerifiedAt: new Date(),
        },
      });
      return NextResponse.json({ verified: true, domain, dnsValue });
    }

    return NextResponse.json({
      verified: false,
      domain,
      dnsValue: dnsValue || null,
      message: `CNAME not pointing to ${VERCEL_CNAME_TARGET}. Current value: ${dnsValue || 'not found'}`,
    });
  } catch (error) {
    console.error('Domain verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
