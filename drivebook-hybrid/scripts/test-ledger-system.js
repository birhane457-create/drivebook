/**
 * Test Financial Ledger System
 * 
 * This script tests the new double-entry ledger system
 * without touching existing data.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import ledger functions (we'll use require since this is a test script)
const {
  createLedgerEntry,
  getAccountBalance,
  getClientWalletBalance,
  getInstructorPayable,
  getPlatformRevenue,
  getPlatformEscrow,
  verifyLedgerIntegrity,
  getAllInstructorPayables,
  getPlatformFinancialSummary,
  buildAccount,
  AccountType,
} = require('../lib/services/ledger.ts');

const {
  recordBookingPayment,
  recordInstructorPayout,
  recordFullRefund,
  recordPartialRefund,
  recordWalletCredit,
  recordAdminWalletAdjustment,
  validateBookingAmounts,
  calculateRefundAmounts,
} = require('../lib/services/ledger-operations.ts');

async function testLedgerSystem() {
  console.log('🧪 Testing Financial Ledger System\n');

  try {
    // Test 1: Verify ledger integrity
    console.log('Test 1: Verify Ledger Integrity');
    const integrity = await verifyLedgerIntegrity();
    console.log('  Debits:', integrity.totalDebits);
    console.log('  Credits:', integrity.totalCredits);
    console.log('  Valid:', integrity.valid ? '✅' : '❌');
    console.log('  Difference:', integrity.difference);
    console.log('');

    // Test 2: Get platform financial summary
    console.log('Test 2: Platform Financial Summary');
    const summary = await getPlatformFinancialSummary();
    console.log('  Revenue:', summary.revenue);
    console.log('  Escrow:', summary.escrow);
    console.log('  Instructor Payables:', summary.instructorPayables);
    console.log('  Instructor Paid:', summary.instructorPaid);
    console.log('  Outstanding Payables:', summary.outstandingPayables);
    console.log('');

    // Test 3: Get all instructor payables
    console.log('Test 3: Instructor Payables');
    const payables = await getAllInstructorPayables();
    console.log(`  Found ${payables.length} instructors with outstanding payables`);
    payables.slice(0, 5).forEach((p) => {
      console.log(`    Instructor ${p.instructorId}: $${p.balance.toFixed(2)}`);
    });
    console.log('');

    // Test 4: Simulate booking payment (DRY RUN - won't actually create)
    console.log('Test 4: Validate Booking Amounts');
    const testBooking = {
      totalAmount: 100,
      platformFee: 20,
      instructorPayout: 80,
    };
    const validation = validateBookingAmounts(
      testBooking.totalAmount,
      testBooking.platformFee,
      testBooking.instructorPayout
    );
    console.log('  Valid:', validation.valid ? '✅' : '❌');
    if (!validation.valid) {
      console.log('  Error:', validation.error);
    }
    console.log('');

    // Test 5: Calculate refund amounts
    console.log('Test 5: Calculate Refund Amounts (50%)');
    const refund = calculateRefundAmounts(100, 20, 80, 50);
    console.log('  Refund Amount:', refund.refundAmount);
    console.log('  Refunded Platform Fee:', refund.refundedPlatformFee);
    console.log('  Refunded Instructor Payout:', refund.refundedInstructorPayout);
    console.log('');

    // Test 6: Count ledger entries
    console.log('Test 6: Ledger Entry Count');
    const entryCount = await prisma.financialLedger.count();
    console.log(`  Total entries: ${entryCount}`);
    console.log('');

    // Test 7: Recent ledger entries
    console.log('Test 7: Recent Ledger Entries (last 5)');
    const recentEntries = await prisma.financialLedger.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        debitAccount: true,
        creditAccount: true,
        amount: true,
        description: true,
        createdAt: true,
      },
    });
    recentEntries.forEach((entry) => {
      console.log(`  ${entry.debitAccount} → ${entry.creditAccount}: $${entry.amount}`);
      console.log(`    ${entry.description}`);
      console.log(`    ${entry.createdAt.toISOString()}`);
      console.log('');
    });

    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testLedgerSystem();
