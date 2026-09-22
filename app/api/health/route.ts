/**
 * Health Check Endpoint
 * Used by integration tests to verify server is running
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
