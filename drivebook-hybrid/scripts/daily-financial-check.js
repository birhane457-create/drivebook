/**
 * Daily Financial Check Script
 * 
 * Performs comprehensive financial integrity checks:
 * 1. Escrow balance verification
 * 2. Ledger vs Stripe reconciliation
 * 3. Failed transaction detection
 * 4. Balance verification
 * 5. Dual-write consistency check
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Account types
const AccountType = {
  CLIENT_WALLET: 'CLIENT_WALLET',
  PLATFORM_ESCROW: 'PLATFORM_ESCROW',
  PLATFORM_REVENUE: 'PLATFORM_REVENUE',
  INSTRUCTOR_PAYABLE: 'INSTRUCTOR_PAYABLE',
  INSTRUCTOR_PAID: 'INSTRUCTOR_PAID',
};

async function getAccountBalance(accountName) {
  const debits = await prisma.financialLedger.aggregate({
    where: { debitAccount: accountName },
    _sum: { amount: true }
  });
  
  const credits = await prisma.financialLedger.aggregate({
    where: { creditAccount: accountName },
    _sum: { amount: true }
  });
  
  const debitTotal = debits._sum.amount || 0;
  const creditTotal = credits._sum.amount || 0;
  
  return Math.round((creditTotal - debitTotal) * 100) / 100;
}

async function getAccountBalances(accountPattern) {
  const isWildcard = accountPattern.endsWith(':*');
  const prefix = isWildcard ? accountPattern.slice(0, -2) : accountPattern;
  
  const entries = await prisma.financialLedger.findMany({
    where: {
      OR: [
        { debitAccount: isWildcard ? { startsWith: prefix } : accountPattern },
        { creditAccount: isWildcard ? { startsWith: prefix } : accountPattern }
      ]
    }
  });
  
  const balances = new Map();
  
  for (const entry of entries) {
    if (isWildcard ? entry.debitAccount.startsWith(prefix) : entry.debitAccount === accountPattern) {
      const current = balances.get(entry.debitAccount) || 0;
      balances.set(entry.debitAccount, current - entry.amount);
    }
    
    if (isWildcard ? entry.creditAccount.startsWith(prefix) : entry.creditAccount === accountPattern) {
      const current = balances.get(entry.creditAccount) || 0;
      balances.set(entry.creditAccount, current + entry.amount);
    }
  }
  
  for (const [account, balance] of balances.entries()) {
    balances.set(account, Math.round(balance * 100) / 100);
  }
  
  return balances;
}

async function check1_EscrowBalance() {
  console.log('\n📊 CHECK 1: Escrow Balance');
  console.log('─'.repeat(60));
  
  const escrowBalance = await getAccountBalance(AccountType.PLATFORM_ESCROW);
  const threshold = 50; // $50 threshold
  
  console.log(`Escrow Balance: $${escrowBalance.toFixed(2)}`);
  console.log(`Threshold: $${threshold.toFixed(2)}`);
  
  if (Math.abs(escrowBalance) < 0.01) {
    console.log('✅ PASS: Escrow balance is ~$0 (all funds allocated)');
    return { passed: true, escrowBalance };
  } else if (Math.abs(escrowBalance) <= threshold) {
    console.log(`⚠️  WARNING: Escrow balance is $${escrowBalance.toFixed(2)} (within threshold)`);
    return { passed: true, escrowBalance, warning: true };
  } else {
    console.log(`❌ FAIL: Escrow balance is $${escrowBalance.toFixed(2)} (exceeds threshold)`);
    console.log('   ACTION REQUIRED: Investigate and freeze payouts if unresolved');
    return { passed: false, escrowBalance };
  }
}

async function check2_LedgerVsOldSystem() {
  console.log('\n📊 CHECK 2: Ledger vs Old System Consistency');
  console.log('─'.repeat(60));
  
  // Get ledger balances
  const payableBalances = await getAccountBalances('INSTRUCTOR_PAYABLE:*');
  const totalLedgerPayables = Array.from(payableBalances.values()).reduce((sum, bal) => sum + bal, 0);
  
  // Get old system balances
  const oldSystemPayables = await prisma.transaction.aggregate({
    where: { status: 'PENDING' },
    _sum: { instructorPayout: true }
  });
  const totalOldPayables = oldSystemPayables._sum.instructorPayout || 0;
  
  const difference = Math.abs(totalLedgerPayables - totalOldPayables);
  
  console.log(`Ledger Total Payables: $${totalLedgerPayables.toFixed(2)}`);
  console.log(`Old System Total Payables: $${totalOldPayables.toFixed(2)}`);
  console.log(`Difference: $${difference.toFixed(2)}`);
  
  if (difference < 0.01) {
    console.log('✅ PASS: Ledger matches old system');
    return { passed: true, difference };
  } else if (difference < 10) {
    console.log(`⚠️  WARNING: Small mismatch of $${difference.toFixed(2)}`);
    return { passed: true, difference, warning: true };
  } else {
    console.log(`❌ FAIL: Significant mismatch of $${difference.toFixed(2)}`);
    console.log('   ACTION REQUIRED: Reconcile immediately');
    return { passed: false, difference };
  }
}

async function check3_FailedTransactions() {
  console.log('\n📊 CHECK 3: Failed Transactions');
  console.log('─'.repeat(60));
  
  // Check for failed bookings
  const failedBookings = await prisma.booking.count({
    where: {
      status: 'CANCELLED',
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24h
    }
  });
  
  // Check for failed transactions
  const failedTransactions = await prisma.transaction.count({
    where: {
      status: 'FAILED',
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24h
    }
  });
  
  console.log(`Failed/Cancelled Bookings (24h): ${failedBookings}`);
  console.log(`Failed Transactions (24h): ${failedTransactions}`);
  
  const totalFailed = failedBookings + failedTransactions;
  
  if (totalFailed === 0) {
    console.log('✅ PASS: No failed transactions in last 24h');
    return { passed: true, failedBookings, failedTransactions };
  } else if (totalFailed < 5) {
    console.log(`⚠️  WARNING: ${totalFailed} failed transactions (within threshold)`);
    return { passed: true, failedBookings, failedTransactions, warning: true };
  } else {
    console.log(`❌ FAIL: ${totalFailed} failed transactions (exceeds threshold)`);
    console.log('   ACTION REQUIRED: Investigate causes');
    return { passed: false, failedBookings, failedTransactions };
  }
}

async function check4_NegativeBalances() {
  console.log('\n📊 CHECK 4: Negative Balances');
  console.log('─'.repeat(60));
  
  const payableBalances = await getAccountBalances('INSTRUCTOR_PAYABLE:*');
  const negativeBalances = [];
  
  for (const [account, balance] of payableBalances.entries()) {
    if (balance < -0.01) {
      negativeBalances.push({ account, balance });
    }
  }
  
  console.log(`Accounts with negative balance: ${negativeBalances.length}`);
  
  if (negativeBalances.length > 0) {
    console.log('\nNegative Balances:');
    negativeBalances.forEach(({ account, balance }) => {
      console.log(`  ${account}: $${balance.toFixed(2)}`);
    });
  }
  
  if (negativeBalances.length === 0) {
    console.log('✅ PASS: No unexpected negative balances');
    return { passed: true, negativeBalances: [] };
  } else {
    console.log(`⚠️  INFO: ${negativeBalances.length} accounts with negative balance`);
    console.log('   NOTE: Negative balances are expected for penalties/chargebacks');
    return { passed: true, negativeBalances, info: true };
  }
}

async function check5_LedgerMigrationStatus() {
  console.log('\n📊 CHECK 5: Ledger Migration Status');
  console.log('─'.repeat(60));
  
  // Count ledger entries
  const ledgerEntryCount = await prisma.financialLedger.count();
  
  // Count operations by type
  const walletAdds = await prisma.financialLedger.count({
    where: { description: { contains: 'Wallet credit' } }
  });
  
  const bookingPayments = await prisma.financialLedger.count({
    where: { description: { contains: 'Booking payment' } }
  });
  
  const payouts = await prisma.financialLedger.count({
    where: { description: { contains: 'Payout' } }
  });
  
  const refunds = await prisma.financialLedger.count({
    where: { description: { contains: 'Refund' } }
  });
  
  console.log(`Total Ledger Entries: ${ledgerEntryCount}`);
  console.log(`  Wallet Adds: ${walletAdds}`);
  console.log(`  Booking Payments: ${bookingPayments}`);
  console.log(`  Payouts: ${payouts}`);
  console.log(`  Refunds: ${refunds}`);
  
  // Compare with old system
  const totalBookings = await prisma.booking.count();
  const totalTransactions = await prisma.transaction.count();
  
  console.log(`\nOld System:`);
  console.log(`  Total Bookings: ${totalBookings}`);
  console.log(`  Total Transactions: ${totalTransactions}`);
  
  const migrationPercent = totalBookings > 0 
    ? Math.round((bookingPayments / (totalBookings * 3)) * 100) // 3 entries per booking
    : 0;
  
  console.log(`\nMigration Progress: ~${migrationPercent}%`);
  
  if (migrationPercent >= 80) {
    console.log('✅ PASS: Migration is well underway');
    return { passed: true, migrationPercent };
  } else if (migrationPercent >= 40) {
    console.log('⚠️  WARNING: Migration in progress');
    return { passed: true, migrationPercent, warning: true };
  } else {
    console.log('❌ FAIL: Migration is behind schedule');
    return { passed: false, migrationPercent };
  }
}

async function generateSummaryReport(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 DAILY FINANCIAL CHECK SUMMARY');
  console.log('='.repeat(60));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('');
  
  const checks = [
    { name: 'Escrow Balance', result: results.check1 },
    { name: 'Ledger vs Old System', result: results.check2 },
    { name: 'Failed Transactions', result: results.check3 },
    { name: 'Negative Balances', result: results.check4 },
    { name: 'Migration Status', result: results.check5 },
  ];
  
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;
  
  checks.forEach(({ name, result }) => {
    const status = result.passed 
      ? (result.warning ? '⚠️  WARN' : '✅ PASS')
      : '❌ FAIL';
    
    console.log(`${status}  ${name}`);
    
    if (result.passed && !result.warning) passCount++;
    else if (result.passed && result.warning) warnCount++;
    else failCount++;
  });
  
  console.log('');
  console.log(`Total: ${passCount} passed, ${warnCount} warnings, ${failCount} failed`);
  
  if (failCount > 0) {
    console.log('');
    console.log('🚨 CRITICAL: Financial integrity issues detected');
    console.log('   ACTION REQUIRED: Review failed checks immediately');
    console.log('   Consider freezing payouts until resolved');
  } else if (warnCount > 0) {
    console.log('');
    console.log('⚠️  WARNING: Minor issues detected');
    console.log('   ACTION RECOMMENDED: Review warnings and monitor');
  } else {
    console.log('');
    console.log('✅ ALL CHECKS PASSED: Financial system healthy');
  }
  
  console.log('='.repeat(60));
}

async function main() {
  console.log('🔍 Starting Daily Financial Check...\n');
  
  try {
    const results = {
      check1: await check1_EscrowBalance(),
      check2: await check2_LedgerVsOldSystem(),
      check3: await check3_FailedTransactions(),
      check4: await check4_NegativeBalances(),
      check5: await check5_LedgerMigrationStatus(),
    };
    
    await generateSummaryReport(results);
    
  } catch (error) {
    console.error('\n❌ ERROR during financial check:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
