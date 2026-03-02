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

    const { searchParams } = new URL(req.url);
    const subdomain = searchParams.get('subdomain');

    if (!subdomain) {
      return NextResponse.json({ error: 'Subdomain required' }, { status: 400 });
    }

    // Validate format
    const subdomainRegex = /^[a-z0-9-]{3,30}$/;
    if (!subdomainRegex.test(subdomain)) {
      return NextResponse.json({
        available: false,
        reason: 'Invalid format. Use lowercase letters, numbers, and hyphens only (3-30 characters)',
      });
    }

    // Reserved subdomains
    const reserved = [
      'www', 'api', 'admin', 'app', 'mail', 'email', 'support', 'help',
      'blog', 'docs', 'status', 'cdn', 'static', 'assets', 'images',
      'dashboard', 'login', 'signup', 'register', 'auth', 'account',
      'billing', 'payment', 'checkout', 'book', 'booking', 'bookings',
      'instructor', 'instructors', 'client', 'clients', 'user', 'users',
      'test', 'testing', 'dev', 'development', 'staging', 'production',
    ];

    if (reserved.includes(subdomain.toLowerCase())) {
      return NextResponse.json({
        available: false,
        reason: 'This subdomain is reserved',
      });
    }

    // Check if already taken
    const existing = await prisma.instructor.findFirst({
      where: { customDomain: subdomain },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({
        available: false,
        reason: 'This subdomain is already taken',
      });
    }

    return NextResponse.json({
      available: true,
      subdomain: subdomain,
      url: `https://${subdomain}.drivebook.com`,
    });
  } catch (error) {
    console.error('Error checking subdomain:', error);
    return NextResponse.json(
      { error: 'Failed to check subdomain availability' },
      { status: 500 }
    );
  }
}
