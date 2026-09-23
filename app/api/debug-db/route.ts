/**
 * TEMPORARY DIAGNOSTIC v2 — reveals DB endpoint type, no credentials
 * Reports whether DATABASE_URL is pointing to direct or pooler endpoint.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.DATABASE_URL ?? '';
  const isDirect = url.includes('db.ikhqphbbilrocsghjyda.supabase.co');
  const isPooler = url.includes('pooler.supabase.com');
  const isEmpty  = url === '';

  // Try to connect
  let dbStatus = 'not-tested';
  try {
    const { PrismaClient } = await import('@prisma/client');
    const p = new PrismaClient();
    await p.$queryRaw`SELECT 1`;
    await p.$disconnect();
    dbStatus = 'reachable';
  } catch (e: any) {
    dbStatus = 'unreachable: ' + (e?.message ?? '').substring(0, 60);
  }

  return NextResponse.json({
    urlSet: !isEmpty,
    urlType: isEmpty ? 'empty' : isDirect ? 'direct' : isPooler ? 'pooler' : 'other',
    dbStatus,
  });
}
