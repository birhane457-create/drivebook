import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import dns from 'dns/promises';

export const dynamic = 'force-dynamic';

const VERCEL_CNAME_TARGET = 'cname.vercel-dns.com';

// Add domain to Vercel project via API
async function addDomainToVercel(domain: string): Promise<{ success: boolean; error?: string }> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) {
    const missing = [!token && 'VERCEL_API_TOKEN', !projectId && 'VERCEL_PROJECT_ID'].filter(Boolean).join(', ');
    console.warn(`[domain-verify] Skipping Vercel auto-add — missing env vars: ${missing}`);
    return { success: false, error: `Missing env vars: ${missing}` };
  }

  const url = `https://api.vercel.com/v10/projects/${projectId}/domains${teamId ? `?teamId=${teamId}` : ''}`;
  console.log(`[domain-verify] Calling Vercel API: POST ${url} domain=${domain}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    });

    const data = await res.json();
    console.log(`[domain-verify] Vercel API response ${res.status}:`, JSON.stringify(data));

    if (res.ok) return { success: true };

    // Domain already added — not an error
    if (data.error?.code === 'domain_already_in_use' || data.error?.code === 'domain_already_exists') {
      console.log(`[domain-verify] Domain already in Vercel — treating as success`);
      return { success: true };
    }

    return { success: false, error: data.error?.message || `Vercel API error ${res.status}` };
  } catch (err) {
    console.error('[domain-verify] Vercel API call failed:', err);
    return { success: false, error: 'Vercel API unreachable' };
  }
}

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
      verified = false;
    }

    if (verified) {
      // Auto-add to Vercel project so SSL is provisioned and traffic is accepted
      const vercelResult = await addDomainToVercel(domain);

      await prisma.instructor.update({
        where: { id: instructor.id },
        data: {
          customDomain: domain,
          domainVerified: true,
          domainVerifiedAt: new Date(),
        },
      });

      return NextResponse.json({
        verified: true,
        domain,
        dnsValue,
        vercelAdded: vercelResult.success,
        // If Vercel API isn't configured, tell the admin they need to add it manually
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
      message: `CNAME not pointing to ${VERCEL_CNAME_TARGET}. Current value: ${dnsValue || 'not found'}`,
    });
  } catch (error) {
    console.error('Domain verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
