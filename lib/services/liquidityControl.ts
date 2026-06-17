// @ts-nocheck
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
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
  // Note: Disputes are tracked via Stripe metadata, not booking status
  // For now, we'll estimate based on recent refunds
  const recentRefunds = await prisma.booking.count({
    where: {
      refundAmount: { gt: 0 },
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // Last 90 days
    },
  });

  // Estimate: Each potential dispute = average booking amount + $15 fee
  const disputeLiability = recentRefunds * 85; // Average booking $70 + $15 fee
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
 * Send emergency notification via email to configured admin address
 */
async function sendEmergencyNotification(params: { type: string; status: LiquidityStatus }) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.ADMIN_REPORT_EMAIL
  if (!adminEmail) {
    console.error('[LIQUIDITY] 🚨 EMERGENCY: ADMIN_EMAIL not configured — cannot send notification')
    return
  }

  try {
    const { emailService } = await import('@/lib/services/email')
    const statusColor = params.status.status === 'EMERGENCY' ? '#dc2626' : '#d97706'
    const ratioPercent = (params.status.reserveRatio * 100).toFixed(1)

    await emailService.sendGenericEmail({
      to: adminEmail,
      subject: `🚨 DriveBook ${params.status.status}: Liquidity Alert — Reserve at ${ratioPercent}%`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <div style="background:${statusColor};color:white;padding:16px;border-radius:8px;margin-bottom:24px">
            <h2 style="margin:0">🚨 ${params.status.status} Liquidity Alert</h2>
            <p style="margin:8px 0 0">Immediate action required</p>
          </div>

          <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
            <tr style="background:#f9fafb">
              <td style="padding:10px;border:1px solid #e5e7eb;font-weight:600">Current Balance</td>
              <td style="padding:10px;border:1px solid #e5e7eb">$${params.status.currentBalance.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #e5e7eb;font-weight:600">Required Reserve</td>
              <td style="padding:10px;border:1px solid #e5e7eb">$${params.status.requiredReserve.toFixed(2)}</td>
            </tr>
            <tr style="background:#f9fafb">
              <td style="padding:10px;border:1px solid #e5e7eb;font-weight:600">Reserve Ratio</td>
              <td style="padding:10px;border:1px solid #e5e7eb;color:${statusColor};font-weight:700">${ratioPercent}%</td>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #e5e7eb;font-weight:600">Days of Coverage</td>
              <td style="padding:10px;border:1px solid #e5e7eb">${params.status.daysOfCoverage.toFixed(1)} days</td>
            </tr>
          </table>

          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:24px">
            <p style="margin:0;font-weight:600;color:#991b1b">Actions Required:</p>
            <ul style="margin:8px 0 0;padding-left:20px;color:#7f1d1d">
              ${params.status.actions.map(a => `<li>${a}</li>`).join('')}
            </ul>
          </div>

          <p style="color:#6b7280;font-size:12px">
            Generated ${new Date().toLocaleString('en-AU')} · DriveBook Platform
          </p>
        </div>
      `,
    })
    console.log(`[LIQUIDITY] Emergency notification sent to ${adminEmail}`)
  } catch (err) {
    console.error('[LIQUIDITY] Failed to send emergency notification email:', err)
  }
}
