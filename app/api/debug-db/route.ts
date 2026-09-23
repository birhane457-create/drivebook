/**
 * TEMPORARY DIAGNOSTIC — PAY-H-04 production verification
 * Exposes only: whether DB is reachable, no credentials, no connection strings.
 * MUST be removed after the 500 root cause is confirmed.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Minimal query — just checks connectivity
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ db: 'reachable' });
  } catch (err: any) {
    // Report only the error class and first 80 chars of message — no credentials
    const kind = err?.constructor?.name ?? 'unknown';
    const msg  = (err?.message ?? '').substring(0, 80);
    return NextResponse.json({ db: 'unreachable', kind, msg }, { status: 503 });
  }
}
