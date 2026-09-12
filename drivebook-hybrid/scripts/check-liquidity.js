/**
 * CHECK LIQUIDITY STATUS
 * 
 * Runs daily liquidity monitoring:
 * - Current Stripe balance
 * - Required reserve calculation
 * - 30-day refund exposure
 * - Pending payouts
 * - Dispute liability
 * 
 * Usage: node scripts/check-liquidity.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLiquidity() {
  console.log('💰 LIQUIDITY STATUS CHECK');
  console.log('========================\n');

  try {
    // Import liquidity control service
    const { checkLiquidityStatus, generateLiquidityReport } = require('../lib/services/liquidityControl');

    // Check current status
    const status = await checkLiquidityStatus();

    // Generate report
    const report = await generateLiquidityReport();

    // Display status
    console.log('\n📊 CURRENT STATUS');
    console.log('========================');
    console.log('Status:', status.status);
    console.log('Current Balance:', status.currentBalance.toFixed(2));
    console.log('Required Reserve:', status.requiredReserve.toFixed(2));
    console.log('Reserve Ratio:', (status.reserveRatio * 100).toFixed(1) + '%');
    console.log('Days of Coverage:', status.daysOfCoverage.toFixed(1), 'days');

    console.log('\n📋 BREAKDOWN');
    console.log('========================');
    console.log('30-Day Refund Exposure:', status.breakdown.refundExposure30Days.toFixed(2));
    console.log('Pending Payouts:', status.breakdown.pendingPayouts.toFixed(2));
    console.log('Dispute Liability:', status.breakdown.disputeLiability.toFixed(2));
    console.log('Monthly GMV:', status.breakdown.monthlyGMV.toFixed(2));

    console.log('\n⚡ ACTIONS REQUIRED');
    console.log('========================');
    status.actions.forEach(action => {
      console.log(action);
    });

    // Check if critical
    if (status.status === 'EMERGENCY' || status.status === 'CRITICAL') {
      console.log('\n🚨 CRITICAL LIQUIDITY ALERT');
      console.log('========================');
      console.log('IMMEDIATE ACTION REQUIRED');
      console.log('Reserve ratio below safe threshold');
      console.log('Payouts may be paused automatically');
      console.log('\nContact owner immediately!');
    }

    console.log('\n✅ Liquidity check complete');
    console.log('Report saved to audit log');

  } catch (error) {
    console.error('❌ Error checking liquidity:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkLiquidity();
