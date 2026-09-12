/**
 * Test Data Migration to Ledger
 * 
 * This script migrates existing test bookings and transactions to the financial ledger.
 * Treats test data as real to validate the complete migration workflow.
 * 
 * CRITICAL: This is a DRY RUN for production migration.
 * Every step must be documented and validated.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import ledger functions
const AccountType = {
  CLIENT_WALLET: 'CLIENT_WALLET',
  PLATFORM_ESCROW: 'PLATFORM_ESCROW',
  PLATFORM_REVENUE: 'PLATFORM_REVENUE',
  INSTRUCTOR_PAYABLE: 'INSTRUCTOR_PAYABLE',
  INSTRUCTOR_PAID: 'INSTRUCTOR_PAID',
  PLATFORM_BANK: 'PLATFORM_BANK',
  STRIPE_EXTERNAL: 'STRIPE_EXTERNAL',
};

function buildAccountName(type, entityId) {
  if (entityId) {
    return `${type}:${entityId}`;
  }
  return type;
}

function generateIdempotencyKey(operation, entityId, suffix) {
  const parts = [operation, entityId];
  if (suffix) parts.push(suffix);
  return parts.join('-');
}

async function createLedgerEntry(tx, entry) {
  // Validation
  if (entry.amount <= 0) {
    throw new Error(`Ledger entry amount must be positive: ${entry.amount}`);
  }
  
  if (entry.debitAccount === entry.creditAccount) {
    throw new Error(`Debit and credit accounts must be different: ${entry.debitAccount}`);
  }
  
  if (!entry.idempotencyKey) {
    throw new Error('Idempotency key is required');
  }
  
  // Round amount to 2 decimal places
  const amount = Math.round(entry.amount * 100) / 100;
  
  // Idempotent create
  try {
    return await tx.financialLedger.create({
      data: {
        debitAccount: entry.debitAccount,
        creditAccount: entry.creditAccount,
        amount,
        description: entry.description,
        idempotencyKey: entry.idempotencyKey,
        bookingId: entry.bookingId,
        transactionId: entry.transactionId,
        userId: entry.userId,
        instructorId: entry.instructorId,
        metadata: entry.metadata || {},
        createdBy: entry.createdBy || 'MIGRATION_SCRIPT',
      }
    });
  } catch (error) {
    // If duplicate key, return existing entry (idempotent)
    if (error.code === 11000 || error.code === 'P2002') {
      const existing = await tx.financialLedger.findUnique({
        where: { idempotencyKey: entry.idempotencyKey }
      });
      
      if (existing) {
        console.log(`  ⚠️  Idempotent: Entry already exists for key ${entry.idempotencyKey}`);
        return existing;
      }
    }
    throw error;
  }
}

async function migrateWalletTransactions() {
  console.log('\n📊 STEP 1: Migrate Wallet Transactions');
  console.log('─'.repeat(60));
  
  const walletTransactions = await prisma.walletTransaction.findMany({
    where: { type: 'CREDIT' },
    include: { wallet: true }
  });
  
  console.log(`Found ${walletTransactions.length} wallet credit transactions`);
  
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const wt of walletTransactions) {
    try {
      await prisma.$transaction(async (tx) => {
        // Create ledger entry: STRIPE_EXTERNAL → CLIENT_WALLET
        await createLedgerEntry(tx, {
          debitAccount: AccountType.STRIPE_EXTERNAL,
          creditAccount: buildAccountName(AccountType.CLIENT_WALLET, wt.wallet.userId),
          amount: wt.amount,
          description: `Wallet credit added (migrated from transaction ${wt.id})`,
          idempotencyKey: generateIdempotencyKey('wallet-credit-migration', wt.id),
          userId: wt.wallet.userId,
          metadata: {
            originalTransactionId: wt.id,
            migratedAt: new Date().toISOString(),
            source: 'MIGRATION_SCRIPT'
          },
          createdBy: 'MIGRATION_SCRIPT'
        });
      });
      
      migrated++;
      console.log(`  ✅ Migrated wallet transaction ${wt.id} ($${wt.amount.toFixed(2)})`);
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        skipped++;
        console.log(`  ⏭️  Skipped wallet transaction ${wt.id} (already migrated)`);
      } else {
        failed++;
        console.error(`  ❌ Failed wallet transaction ${wt.id}:`, error.message);
      }
    }
  }
  
  console.log(`\nWallet Migration Summary:`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed: ${failed}`);
  
  return { migrated, skipped, failed };
}

async function migrateBookingPayments() {
  console.log('\n📊 STEP 2: Migrate Booking Payments');
  console.log('─'.repeat(60));
  
  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ['CONFIRMED', 'COMPLETED'] },
      isPaid: true // Only migrate paid bookings
    },
    include: {
      instructor: true,
      client: true
    }
  });
  
  console.log(`Found ${bookings.length} paid confirmed/completed bookings`);
  
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const booking of bookings) {
    try {
      // Try to find transaction for this booking
      let transaction = await prisma.transaction.findFirst({
        where: { bookingId: booking.id }
      });
      
      // If no transaction, check if booking has payment data directly
      if (!transaction && booking.isPaid && booking.price) {
        // Calculate fees based on booking data
        const totalAmount = booking.price;
        const platformFee = booking.platformFee || 0;
        const instructorPayout = booking.instructorPayout || (totalAmount - platformFee);
        
        // Create a synthetic transaction object
        transaction = {
          id: `synthetic-${booking.id}`,
          amount: totalAmount, // Use 'amount' not 'totalAmount'
          platformFee,
          instructorPayout
        };
      }
      
      if (!transaction) {
        console.log(`  ⚠️  No transaction or payment data for booking ${booking.id}`);
        skipped++;
        continue;
      }
      
      // Get userId - handle cases where client relationship is missing
      // For instructor-created bookings, use clientId as the account identifier
      const userId = booking.client?.userId || booking.userId || booking.clientId;
      if (!userId) {
        console.log(`  ⚠️  No userId or clientId found for booking ${booking.id}`);
        skipped++;
        continue;
      }
      
      const totalAmount = transaction.amount || transaction.totalAmount;
      const platformFee = transaction.platformFee;
      const instructorPayout = transaction.instructorPayout;
      
      await prisma.$transaction(async (tx) => {
        // Entry 1: CLIENT_WALLET → PLATFORM_ESCROW
        await createLedgerEntry(tx, {
          debitAccount: buildAccountName(AccountType.CLIENT_WALLET, userId),
          creditAccount: AccountType.PLATFORM_ESCROW,
          amount: totalAmount,
          description: `Booking payment (migrated from booking ${booking.id})`,
          idempotencyKey: generateIdempotencyKey('booking-payment-migration', booking.id),
          bookingId: booking.id,
          userId: userId,
          instructorId: booking.instructorId,
          metadata: {
            originalTransactionId: transaction.id,
            paymentIntentId: booking.paymentIntentId,
            migratedAt: new Date().toISOString(),
            source: 'MIGRATION_SCRIPT'
          },
          createdBy: 'MIGRATION_SCRIPT'
        });
        
        // Entry 2: PLATFORM_ESCROW → PLATFORM_REVENUE
        await createLedgerEntry(tx, {
          debitAccount: AccountType.PLATFORM_ESCROW,
          creditAccount: AccountType.PLATFORM_REVENUE,
          amount: platformFee,
          description: `Platform commission (migrated from booking ${booking.id})`,
          idempotencyKey: generateIdempotencyKey('booking-commission-migration', booking.id),
          bookingId: booking.id,
          instructorId: booking.instructorId,
          metadata: {
            originalTransactionId: transaction.id,
            commissionRate: (platformFee / totalAmount * 100).toFixed(2),
            migratedAt: new Date().toISOString(),
            source: 'MIGRATION_SCRIPT'
          },
          createdBy: 'MIGRATION_SCRIPT'
        });
        
        // Entry 3: PLATFORM_ESCROW → INSTRUCTOR_PAYABLE
        await createLedgerEntry(tx, {
          debitAccount: AccountType.PLATFORM_ESCROW,
          creditAccount: buildAccountName(AccountType.INSTRUCTOR_PAYABLE, booking.instructorId),
          amount: instructorPayout,
          description: `Instructor payout (migrated from booking ${booking.id})`,
          idempotencyKey: generateIdempotencyKey('booking-payout-migration', booking.id),
          bookingId: booking.id,
          instructorId: booking.instructorId,
          metadata: {
            originalTransactionId: transaction.id,
            migratedAt: new Date().toISOString(),
            source: 'MIGRATION_SCRIPT'
          },
          createdBy: 'MIGRATION_SCRIPT'
        });
      });
      
      migrated++;
      console.log(`  ✅ Migrated booking ${booking.id} ($${totalAmount.toFixed(2)})`);
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        skipped++;
        console.log(`  ⏭️  Skipped booking ${booking.id} (already migrated)`);
      } else {
        failed++;
        console.error(`  ❌ Failed booking ${booking.id}:`, error.message);
      }
    }
  }
  
  console.log(`\nBooking Migration Summary:`);
  console.log(`  Migrated: ${migrated} (${migrated * 3} ledger entries)`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed: ${failed}`);
  
  return { migrated, skipped, failed };
}

async function migrateCompletedPayouts() {
  console.log('\n📊 STEP 3: Migrate Completed Payouts');
  console.log('─'.repeat(60));
  
  const completedTransactions = await prisma.transaction.findMany({
    where: { status: 'COMPLETED' },
    include: { booking: true }
  });
  
  console.log(`Found ${completedTransactions.length} completed payouts`);
  
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const transaction of completedTransactions) {
    try {
      await prisma.$transaction(async (tx) => {
        // Entry 1: INSTRUCTOR_PAYABLE → INSTRUCTOR_PAID
        await createLedgerEntry(tx, {
          debitAccount: buildAccountName(AccountType.INSTRUCTOR_PAYABLE, transaction.instructorId),
          creditAccount: buildAccountName(AccountType.INSTRUCTOR_PAID, transaction.instructorId),
          amount: transaction.instructorPayout,
          description: `Payout processed (migrated from transaction ${transaction.id})`,
          idempotencyKey: generateIdempotencyKey('payout-migration', transaction.id, 'instructor'),
          transactionId: transaction.id,
          bookingId: transaction.bookingId,
          instructorId: transaction.instructorId,
          metadata: {
            originalTransactionId: transaction.id,
            stripePayoutId: transaction.stripePayoutId,
            migratedAt: new Date().toISOString(),
            source: 'MIGRATION_SCRIPT'
          },
          createdBy: 'MIGRATION_SCRIPT'
        });
        
        // Entry 2: STRIPE_EXTERNAL → PLATFORM_BANK
        await createLedgerEntry(tx, {
          debitAccount: AccountType.STRIPE_EXTERNAL,
          creditAccount: AccountType.PLATFORM_BANK,
          amount: transaction.instructorPayout,
          description: `Payout to Stripe (migrated from transaction ${transaction.id})`,
          idempotencyKey: generateIdempotencyKey('payout-migration', transaction.id, 'stripe'),
          transactionId: transaction.id,
          instructorId: transaction.instructorId,
          metadata: {
            originalTransactionId: transaction.id,
            stripePayoutId: transaction.stripePayoutId,
            migratedAt: new Date().toISOString(),
            source: 'MIGRATION_SCRIPT'
          },
          createdBy: 'MIGRATION_SCRIPT'
        });
      });
      
      migrated++;
      console.log(`  ✅ Migrated payout ${transaction.id} ($${transaction.instructorPayout.toFixed(2)})`);
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        skipped++;
        console.log(`  ⏭️  Skipped payout ${transaction.id} (already migrated)`);
      } else {
        failed++;
        console.error(`  ❌ Failed payout ${transaction.id}:`, error.message);
      }
    }
  }
  
  console.log(`\nPayout Migration Summary:`);
  console.log(`  Migrated: ${migrated} (${migrated * 2} ledger entries)`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed: ${failed}`);
  
  return { migrated, skipped, failed };
}

async function verifyMigration() {
  console.log('\n📊 STEP 4: Verify Migration');
  console.log('─'.repeat(60));
  
  // Get ledger balances
  const ledgerEntries = await prisma.financialLedger.findMany();
  
  const balances = new Map();
  
  for (const entry of ledgerEntries) {
    // Debit decreases balance
    const debitCurrent = balances.get(entry.debitAccount) || 0;
    balances.set(entry.debitAccount, debitCurrent - entry.amount);
    
    // Credit increases balance
    const creditCurrent = balances.get(entry.creditAccount) || 0;
    balances.set(entry.creditAccount, creditCurrent + entry.amount);
  }
  
  // Calculate totals
  let totalInstructorPayable = 0;
  let totalInstructorPaid = 0;
  let totalPlatformRevenue = 0;
  let totalEscrow = 0;
  
  for (const [account, balance] of balances.entries()) {
    if (account.startsWith('INSTRUCTOR_PAYABLE:')) {
      totalInstructorPayable += balance;
    } else if (account.startsWith('INSTRUCTOR_PAID:')) {
      totalInstructorPaid += balance;
    } else if (account === 'PLATFORM_REVENUE') {
      totalPlatformRevenue = balance;
    } else if (account === 'PLATFORM_ESCROW') {
      totalEscrow = balance;
    }
  }
  
  console.log(`\nLedger Balances:`);
  console.log(`  Total Instructor Payable: $${totalInstructorPayable.toFixed(2)}`);
  console.log(`  Total Instructor Paid: $${totalInstructorPaid.toFixed(2)}`);
  console.log(`  Total Platform Revenue: $${totalPlatformRevenue.toFixed(2)}`);
  console.log(`  Total Escrow: $${totalEscrow.toFixed(2)}`);
  
  // Compare with old system
  const oldSystemPayables = await prisma.transaction.aggregate({
    where: { status: 'PENDING' },
    _sum: { instructorPayout: true }
  });
  
  const oldSystemPaid = await prisma.transaction.aggregate({
    where: { status: 'COMPLETED' },
    _sum: { instructorPayout: true }
  });
  
  const oldSystemRevenue = await prisma.transaction.aggregate({
    _sum: { platformFee: true }
  });
  
  console.log(`\nOld System Balances:`);
  console.log(`  Total Instructor Payable: $${(oldSystemPayables._sum.instructorPayout || 0).toFixed(2)}`);
  console.log(`  Total Instructor Paid: $${(oldSystemPaid._sum.instructorPayout || 0).toFixed(2)}`);
  console.log(`  Total Platform Revenue: $${(oldSystemRevenue._sum.platformFee || 0).toFixed(2)}`);
  
  // Calculate differences
  const payableDiff = Math.abs(totalInstructorPayable - (oldSystemPayables._sum.instructorPayout || 0));
  const paidDiff = Math.abs(totalInstructorPaid - (oldSystemPaid._sum.instructorPayout || 0));
  const revenueDiff = Math.abs(totalPlatformRevenue - (oldSystemRevenue._sum.platformFee || 0));
  
  console.log(`\nDifferences:`);
  console.log(`  Payable Difference: $${payableDiff.toFixed(2)}`);
  console.log(`  Paid Difference: $${paidDiff.toFixed(2)}`);
  console.log(`  Revenue Difference: $${revenueDiff.toFixed(2)}`);
  console.log(`  Escrow Balance: $${totalEscrow.toFixed(2)} (should be ~$0)`);
  
  const allMatch = payableDiff < 0.01 && paidDiff < 0.01 && revenueDiff < 0.01 && Math.abs(totalEscrow) < 0.01;
  
  if (allMatch) {
    console.log(`\n✅ VERIFICATION PASSED: Ledger matches old system perfectly`);
  } else {
    console.log(`\n⚠️  VERIFICATION WARNING: Discrepancies found`);
    console.log(`   Review differences above and investigate`);
  }
  
  return {
    ledger: { payable: totalInstructorPayable, paid: totalInstructorPaid, revenue: totalPlatformRevenue, escrow: totalEscrow },
    oldSystem: { 
      payable: oldSystemPayables._sum.instructorPayout || 0,
      paid: oldSystemPaid._sum.instructorPayout || 0,
      revenue: oldSystemRevenue._sum.platformFee || 0
    },
    differences: { payable: payableDiff, paid: paidDiff, revenue: revenueDiff },
    allMatch
  };
}

async function generateMigrationReport(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 MIGRATION REPORT');
  console.log('='.repeat(60));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Environment: TEST DATA`);
  console.log('');
  
  console.log('Migration Results:');
  console.log(`  Wallet Transactions: ${results.wallets.migrated} migrated, ${results.wallets.skipped} skipped, ${results.wallets.failed} failed`);
  console.log(`  Booking Payments: ${results.bookings.migrated} migrated, ${results.bookings.skipped} skipped, ${results.bookings.failed} failed`);
  console.log(`  Completed Payouts: ${results.payouts.migrated} migrated, ${results.payouts.skipped} skipped, ${results.payouts.failed} failed`);
  console.log('');
  
  const totalMigrated = results.wallets.migrated + results.bookings.migrated + results.payouts.migrated;
  const totalFailed = results.wallets.failed + results.bookings.failed + results.payouts.failed;
  
  console.log(`Total Operations: ${totalMigrated} migrated, ${totalFailed} failed`);
  console.log('');
  
  if (results.verification.allMatch) {
    console.log('✅ MIGRATION SUCCESSFUL');
    console.log('   Ledger balances match old system perfectly');
    console.log('   Ready for dual-write implementation');
  } else {
    console.log('⚠️  MIGRATION INCOMPLETE');
    console.log('   Discrepancies found - review verification section');
    console.log('   DO NOT proceed to dual-write until resolved');
  }
  
  console.log('='.repeat(60));
  
  // Save report to file
  const report = {
    timestamp: new Date().toISOString(),
    environment: 'TEST_DATA',
    results: {
      wallets: results.wallets,
      bookings: results.bookings,
      payouts: results.payouts,
      verification: results.verification
    },
    status: results.verification.allMatch ? 'SUCCESS' : 'INCOMPLETE'
  };
  
  const fs = require('fs');
  fs.writeFileSync(
    'migration-report.json',
    JSON.stringify(report, null, 2)
  );
  
  console.log('\n📄 Report saved to: migration-report.json');
}

async function main() {
  console.log('🚀 Starting Test Data Migration to Ledger...\n');
  console.log('⚠️  This is a DRY RUN with test data');
  console.log('   Treating all data as real to validate workflow\n');
  
  try {
    const results = {
      wallets: await migrateWalletTransactions(),
      bookings: await migrateBookingPayments(),
      payouts: await migrateCompletedPayouts(),
      verification: await verifyMigration()
    };
    
    await generateMigrationReport(results);
    
    if (!results.verification.allMatch) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
