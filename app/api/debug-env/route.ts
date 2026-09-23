/**
 * TEMPORARY DEBUG ROUTE — remove after diagnosis
 * Shows whether DATABASE_URL is set in the Vercel function environment
 */
import { NextResponse } from 'next/server';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  return NextResponse.json({
    hasDatabaseUrl: !!dbUrl,
    dbUrlPrefix: dbUrl ? dbUrl.substring(0, 30) + '...' : 'NOT SET',
    nodeEnv: process.env.NODE_ENV,
  });
}
