import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * P0 FIX #4: Cleanup Job for Expired Bookings
 * 
 * This endpoint is called by Vercel Cron every 5 minutes to:
 * 1. Expire PENDING_PAYMENT bookings older than 10 minutes
 * 2. Expire PENDING wallet transactions older than 10 minutes
 * 
 * This prevents:
 * - Slot pollution (expired bookings locking time slots)
 * - Wallet inconsistencies (pending transactions never resolved)
 * - Poor UX (users seeing unavailable slots that are actually expired)
 */
export async function GET(req: NextRequest) {
  try {
    // SECURITY: Verify cron secret
    const authHeader = req.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (!process.env.CRON_SECRET) {
      console.error('❌ CRON_SECRET not configured');
      return NextResponse.json({ 
        error: 'Server configuration error' 
      }, { status: 500 });
    }
    
    if (authHeader !== expectedAuth) {
      console.error('❌ Unauthorized cron request');
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    // Expire old PENDING_PAYMENT bookings
    const expiredBookings = await prisma.booking.updateMany({
      where: {
        status: 'PENDING_PAYMENT',
        createdAt: { lt: tenMinutesAgo }
      },
      data: {
        status: 'EXPIRED'
      }
    });
    
    // Expire old PENDING wallet transactions
    const expiredTransactions = await prisma.walletTransaction.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: tenMinutesAgo }
      },
      data: {
        status: 'EXPIRED'
      }
    });
    
    const result = {
      success: true,
      expiredBookings: expiredBookings.count,
      expiredTransactions: expiredTransactions.count,
      timestamp: new Date().toISOString(),
      cutoffTime: tenMinutesAgo.toISOString()
    };
    
    console.log('✅ Cleanup job completed:', result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Cleanup job error:', error);
    return NextResponse.json({ 
      error: 'Cleanup job failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
