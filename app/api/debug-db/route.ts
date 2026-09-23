/**
 * TEMPORARY DIAGNOSTIC v3 — checks what URLs are set, no values exposed
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db     = process.env.DATABASE_URL  ?? '';
  const direct = process.env.DIRECT_URL    ?? '';

  const dbType     = db     ? (db.includes('pooler')     ? 'pooler'  : db.includes('supabase.co') ? 'direct' : 'other') : 'empty';
  const directType = direct ? (direct.includes('pooler') ? 'pooler' : direct.includes('supabase') ? 'direct' : 'other') : 'empty';

  let dbStatus = 'not-tested';
  try {
    const { PrismaClient } = await import('@prisma/client');
    const p = new PrismaClient();
    await p.$queryRaw`SELECT 1`;
    await p.$disconnect();
    dbStatus = 'reachable';
  } catch (e: any) {
    dbStatus = 'unreachable: ' + (e?.message ?? '').substring(0, 80);
  }

  return NextResponse.json({ dbType, directType, dbStatus });
}
