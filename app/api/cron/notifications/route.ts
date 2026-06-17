// Cron endpoint for generating notifications
// Can be called by Vercel Cron, external scheduler, or manually for testing
// IMPORTANT: Protect with authorization in production

import { NextRequest, NextResponse } from 'next/server';
import { generateBookingReminders } from '@/lib/jobs/bookingReminders';
import { generatePackageExpiryAlerts } from '@/lib/jobs/packageExpiryAlerts';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Security: Check authorization header (optional - add if using external scheduler)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, verify the secret
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (!authHeader || !authHeader.includes(cronSecret)) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('🔔 Running notification generation cron jobs...');

    const results: any = {
      bookingReminders: null,
      packageExpiryAlerts: null,
      errors: [],
      completedAt: new Date().toISOString(),
    };

    // Run booking reminders job
    try {
      results.bookingReminders = await generateBookingReminders();
    } catch (error) {
      results.errors.push({
        job: 'bookingReminders',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Run package expiry alerts job
    try {
      results.packageExpiryAlerts = await generatePackageExpiryAlerts();
    } catch (error) {
      results.errors.push({
        job: 'packageExpiryAlerts',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    console.log('✅ Cron jobs completed');

    // Return 200 even if there are errors (so the cron doesn't retry indefinitely)
    return NextResponse.json(results);
  } catch (error) {
    console.error('❌ Error in notifications cron:', error);

    return NextResponse.json({
      error: 'Cron job failed',
      message: error instanceof Error ? error.message : String(error),
      completedAt: new Date().toISOString(),
    });
  }
}

export async function POST(req: NextRequest) {
  // Allow POST for testing/manual triggers
  return GET(req);
}
