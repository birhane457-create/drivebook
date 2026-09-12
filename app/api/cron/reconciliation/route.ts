/**
 * Daily Reconciliation Cron Endpoint
 * AUDIT FIX #6: API endpoint for triggering daily financial reconciliation
 * 
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/reconciliation",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 * 
 * This runs daily at 2:00 AM UTC to reconcile previous day's transactions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDailyReconciliation } from '@/lib/cron/daily-reconciliation';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

export async function GET(req: NextRequest) {
  try {
    // SECURITY: Verify cron secret to prevent unauthorized calls
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      logger.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      );
    }
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized cron request', {
        ip: req.headers.get('x-forwarded-for'),
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('🚀 Daily reconciliation cron triggered');
    
    const result = await runDailyReconciliation();
    
    return NextResponse.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Daily reconciliation cron failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
