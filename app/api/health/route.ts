/**
 * Health Check Endpoint
 *
 * Returns the deployed commit SHA from the Vercel runtime environment variable
 * VERCEL_GIT_COMMIT_SHA. This allows production verification scripts to
 * independently read the running SHA from the application itself rather than
 * relying on operator-supplied values.
 *
 * In local development, sha is 'dev'.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    sha:       process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev',
    env:       process.env.NODE_ENV ?? 'unknown',
  });
}
