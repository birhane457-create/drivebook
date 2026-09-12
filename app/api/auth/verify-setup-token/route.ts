import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { setupTokenRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Rate limit: 20 requests per 15 minutes per IP (prevents setup-token enumeration)
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'anonymous';
  const identifier = getRateLimitIdentifier(undefined, ip, 'setup-token');
  const rl = await checkRateLimit(setupTokenRateLimit, identifier);
  if (!rl.success) {
    return NextResponse.json(
      { error: rl.error ?? 'Too many requests. Please try again later.' },
      { status: 429, headers: rl.headers }
    );
  }

  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gt: new Date() },
    },
    select: { email: true },
  });

  if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
  return NextResponse.json({ email: user.email });
}
