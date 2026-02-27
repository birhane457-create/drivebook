import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

/**
 * LIQUIDITY BUFFER CONTROL
 * 
 * Ensures platform has sufficient cash reserves to handle:
 * - Mass refund events
 * - Instructor payouts
 * - Dispute losses
 * - Operational expenses
 */

// ============================================
// LIQUIDITY POLICY
// ============================================

export const LIQUIDITY_POLICY = {
  // Minimum days of refund exposure to keep in reserve
  MIN_REFUND_RESERVE_DAYS: 30,
  
  // Minimum % of monthly GMV to keep in Stripe
  MIN_GMV_PERCENTAGE: 15, // 15% of monthly GMV
  
  // Absolute minimum balance (emergency floor)
  ABSOLUTE_MIN_BALANCE: 5000, // $5,000 AUD
  
  // Alert thresholds
  CRITICAL_THRESHOLD: 0.5, // 50% of required reserve
  WARNING_THRESHOLD: 0.75, // 75% of required reserve
  
  // Auto-actions
  AUTO_PAUSE_PAYOUTS_BELOW: 0.3, // Pause payouts if below 30% of reserve
  AUTO_NOTIFY_OWNER_BELOW: 0.5, // Notify owner if below 50%
} as const;

// ============================================
// LIQUIDITY MONITORING
// ============================================

interface LiquidityStatus {
  currentBalance: number;
  requiredReserve: number;
  reserveRatio: number; // Current / Required
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  daysOfCoverage: number;
  breakdown: {
    refundExposure30Days: number;
    pendingPayouts: number;
    disputeLiability: number;
    monthlyGMV: number;
  };
  actions: string[];
}

export async function checkLiquidityStatus(): Promise<LiquidityStatus> {
  console.log('[LIQUIDITY] Checking liquidity status...');

  // ============================================
  // 1. Get current Stripe balance
  // ============================================
  const balance = await stripe.balance.retrieve();
  const availableBalance = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
  const pendingBalance = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100;
  
  console.log('[LIQUIDITY] Stripe available balance:', availableBalance);
  console.log('[LIQUIDITY] Stripe pending balance:', pendingBalance);

  // ============================================
  // 2. Calculate refund exposure (30 days)
  // ============================================
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentBookings = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      startTime: {
        gte: new Date(), // Future bookings
        lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next 30 days
      },
    },
    select: {
      price: true,
    },
  });

  const refundExposure30Days = recentBookings.reduce((sum, b) => sum + b.price, 0);
  console.log('[LIQUIDITY] 30-day refund exposure:', refundExposure30Days);

  // ============================================
  // 3. Calculate pending payouts
  // ============================================
  const pendingPayouts = await prisma.payout.aggregate({
    where: {
      status: 'pending',
    },
    _sum: {
      amount: true,
    },
  });

  const pendingPayoutAmount = pendingPayouts._sum.amount || 0;
  console.log('[LIQUIDITY] Pending payouts:', pendingPayoutAmount);

  // ============================================
  // 4. Calculate dispute liability
  // ============================================
  const activeDisputes = await prisma.booking.count({
    where: {
      status: 'DISPUTED',
    },
  });

  // Estimate: Each dispute = booking amount + $15 fee
  const disputeLiability = activeDisputes * 85; // Average booking $70 + $15 fee
  console.log('[LIQUIDITY] Dispute liability estimate:', disputeLiability);

  // ============================================
  // 5. Calculate monthly GMV
  // ============================================
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  const monthlyBookings = await prisma.booking.aggregate({
    where: {
      createdAt: { gte: lastMonth },
      status: { in: ['CONFIRMED', 'COMPLETED'] },
    },
    _sum: {
      price: true,
    },
  });

  const monthlyGMV = monthlyBookings._sum.price || 0;
  console.log('[LIQUIDITY] Monthly GMV:', monthlyGMV);

  // ============================================
  // 6. Calculate required reserve
  // ============================================
  const refundReserve = refundExposure30Days;
  const gmvReserve = monthlyGMV * (LIQUIDITY_POLICY.MIN_GMV_PERCENTAGE / 100);
  const absoluteMin = LIQUIDITY_POLICY.ABSOLUTE_MIN_BALANCE;

  const requiredReserve = Math.max(refundReserve, gmvReserve, absoluteMin);
  console.log('[LIQUIDITY] Required reserve:', requiredReserve);

  // ============================================
  // 7. Calculate reserve ratio
  // ============================================
  const reserveRatio = availableBalance / requiredReserve;
  console.log('[LIQUIDITY] Reserve ratio:', (reserveRatio * 100).toFixed(1) + '%');

  // ============================================
  // 8. Calculate days of coverage
  // ============================================
  const dailyRefundRate = refundExposure30Days / 30;
  const daysOfCoverage = dailyRefundRate > 0 ? availableBalance / dailyRefundRate : 999;
  console.log('[LIQUIDITY] Days of coverage:', daysOfCoverage.toFixed(1));

  // ============================================
  // 9. Determine status
  // ============================================
  let status: LiquidityStatus['status'];
  const actions: string[] = [];

  if (reserveRatio < LIQUIDITY_POLICY.AUTO_PAUSE_PAYOUTS_BELOW) {
    status = 'EMERGENCY';
    actions.push('🚨 PAUSE ALL PAYOUTS IMMEDIATELY');
    actions.push('🚨 NOTIFY OWNER - EMERGENCY');
    actions.push('🚨 TRANSFER FUNDS TO STRIPE');
  } else if (reserveRatio < LIQUIDITY_POLICY.AUTO_NOTIFY_OWNER_BELOW) {
    status = 'CRITICAL';
    actions.push('⚠️ Notify owner - critical liquidity');
    actions.push('⚠️ Delay non-urgent payouts');
    actions.push('⚠️ Prepare fund transfer');
  } else if (reserveRatio < LIQUIDITY_POLICY.WARNING_THRESHOLD) {
    status = 'WARNING';
    actions.push('⚠️ Monitor closely');
    actions.push('⚠️ Review payout schedule');
  } else {
    status = 'HEALTHY';
    actions.push('✅ Liquidity healthy');
  }

  // ============================================
  // 10. Return status
  // ============================================
  return {
    currentBalance: availableBalance,
    requiredReserve,
    reserveRatio,
    status,
    daysOfCoverage,
    breakdown: {
      refundExposure30Days,
      pendingPayouts: pendingPayoutAmount,
      disputeLiability,
      monthlyGMV,
    },
    actions,
  };
}

/**
 * Auto-pause payouts if liquidity critical
 */
export async function autoManageLiquidity() {
  const status = await checkLiquidityStatus();

  if (status.status === 'EMERGENCY' || status.status === 'CRITICAL') {
    console.log('[LIQUIDITY] 🚨 CRITICAL LIQUIDITY - Taking action...');

    // Pause all pending payouts
    await prisma.payout.updateMany({
      where: { status: 'pending' },
      data: { status: 'paused' },
    });

    // Create critical audit log
    await prisma.auditLog.create({
      data: {
        actorId: 'SYSTEM',
        actorRole: 'SYSTEM',
        action: 'LIQUIDITY_CRITICAL',
        targetType: 'PLATFORM',
        targetId: 'liquidity',
        metadata: {
          status: status.status,
          currentBalance: status.currentBalance,
          requiredReserve: status.requiredReserve,
          reserveRatio: status.reserveRatio,
          actions: status.actions,
          timestamp: new Date().toISOString(),
        } as any,
      },
    });

    // Send emergency notification
    await sendEmergencyNotification({
      type: 'LIQUIDITY_CRITICAL',
      status,
    });

    console.log('[LIQUIDITY] ✅ Emergency actions taken');
  }

  return status;
}

/**
 * Daily liquidity report
 */
export async function generateLiquidityReport() {
  const status = await checkLiquidityStatus();

  const report = `
📊 DAILY LIQUIDITY REPORT
========================

Status: ${status.status}
Current Balance: $${status.currentBalance.toFixed(2)}
Required Reserve: $${status.requiredReserve.toFixed(2)}
Reserve Ratio: ${(status.reserveRatio * 100).toFixed(1)}%
Days of Coverage: ${status.daysOfCoverage.toFixed(1)} days

BREAKDOWN:
- 30-Day Refund Exposure: $${status.breakdown.refundExposure30Days.toFixed(2)}
- Pending Payouts: $${status.breakdown.pendingPayouts.toFixed(2)}
- Dispute Liability: $${status.breakdown.disputeLiability.toFixed(2)}
- Monthly GMV: $${status.breakdown.monthlyGMV.toFixed(2)}

ACTIONS REQUIRED:
${status.actions.map(a => `- ${a}`).join('\n')}

========================
Generated: ${new Date().toISOString()}
  `;

  console.log(report);

  // Store report
  await prisma.auditLog.create({
    data: {
      actorId: 'SYSTEM',
      actorRole: 'SYSTEM',
      action: 'LIQUIDITY_REPORT',
      targetType: 'PLATFORM',
      targetId: 'liquidity',
      metadata: {
        report,
        status,
        timestamp: new Date().toISOString(),
      } as any,
    },
  });

  return report;
}

/**
 * Send emergency notification
 */
async function sendEmergencyNotification(params: { type: string; status: LiquidityStatus }) {
  // TODO: Implement email/SMS notification
  console.log('[LIQUIDITY] 🚨 EMERGENCY NOTIFICATION:', params.type);
  console.log('[LIQUIDITY] Status:', params.status.status);
  console.log('[LIQUIDITY] Reserve Ratio:', (params.status.reserveRatio * 100).toFixed(1) + '%');
}
