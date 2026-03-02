const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('📊 FINANCIAL INTEGRITY REPORT');
  console.log('='.repeat(70));
  console.log(`Generated: ${new Date().toISOString()}\n`);
  
  // 1. Wallet System
  console.log('1️⃣  CLIENT WALLET SYSTEM');
  console.log('─'.repeat(70));
  
  const wallets = await prisma.clientWallet.findMany({
    include: {
      user: { select: { email: true } }
    }
  });
  
  let totalWalletBalance = 0;
  for (const wallet of wallets) {
    console.log(`\n  ${wallet.user.email}`);
    console.log(`    Balance: $${wallet.balance.toFixed(2)}`);
    totalWalletBalance += wallet.balance;
    
    const credits = await prisma.walletTransaction.aggregate({
      where: { walletId: wallet.id, type: 'CREDIT' },
      _sum: { amount: true }
    });
    
    const debits = await prisma.walletTransaction.aggregate({
      where: { walletId: wallet.id, type: 'DEBIT' },
      _sum: { amount: true }
    });
    
    console.log(`    Total Added: $${(credits._sum.amount || 0).toFixed(2)}`);
    console.log(`    Total Spent: $${(debits._sum.amount || 0).toFixed(2)}`);
  }
  
  console.log(`\n  TOTAL WALLET LIABILITY: $${totalWalletBalance.toFixed(2)}`);
  
  // 2. Ledger System
  console.log(`\n\n2️⃣  FINANCIAL LEDGER`);
  console.log('─'.repeat(70));
  
  const ledgerEntries = await prisma.financialLedger.findMany();
  const balances = new Map();
  
  for (const entry of ledgerEntries) {
    const debitBalance = balances.get(entry.debitAccount) || 0;
    balances.set(entry.debitAccount, debitBalance - entry.amount);
    
    const creditBalance = balances.get(entry.creditAccount) || 0;
    balances.set(entry.creditAccount, creditBalance + entry.amount);
  }
  
  let totalInstructorPayable = 0;
  let totalInstructorPaid = 0;
  let totalPlatformRevenue = 0;
  let totalEscrow = 0;
  let totalClientWallet = 0;
  
  console.log(`\n  Account Balances:`);
  for (const [account, balance] of balances.entries()) {
    if (account.startsWith('INSTRUCTOR_PAYABLE:')) {
      totalInstructorPayable += balance;
    } else if (account.startsWith('INSTRUCTOR_PAID:')) {
      totalInstructorPaid += balance;
    } else if (account === 'PLATFORM_REVENUE') {
      totalPlatformRevenue = balance;
    } else if (account === 'PLATFORM_ESCROW') {
      totalEscrow = balance;
    } else if (account.startsWith('CLIENT_WALLET:')) {
      totalClientWallet += balance;
      console.log(`    ${account}: $${balance.toFixed(2)}`);
    }
  }
  
  console.log(`\n  Summary:`);
  console.log(`    Instructor Payable: $${totalInstructorPayable.toFixed(2)}`);
  console.log(`    Instructor Paid: $${totalInstructorPaid.toFixed(2)}`);
  console.log(`    Platform Revenue: $${totalPlatformRevenue.toFixed(2)}`);
  console.log(`    Platform Escrow: $${totalEscrow.toFixed(2)}`);
  console.log(`    Client Wallets (Ledger): $${totalClientWallet.toFixed(2)}`);
  
  console.log(`\n  Ledger Entries: ${ledgerEntries.length}`);
  
  // 3. Old Transaction System
  console.log(`\n\n3️⃣  OLD TRANSACTION SYSTEM`);
  console.log('─'.repeat(70));
  
  const pendingPayouts = await prisma.transaction.aggregate({
    where: { status: 'PENDING' },
    _sum: { instructorPayout: true, platformFee: true }
  });
  
  const completedPayouts = await prisma.transaction.aggregate({
    where: { status: 'COMPLETED' },
    _sum: { instructorPayout: true, platformFee: true }
  });
  
  console.log(`\n  Pending Payouts: $${(pendingPayouts._sum.instructorPayout || 0).toFixed(2)}`);
  console.log(`  Completed Payouts: $${(completedPayouts._sum.instructorPayout || 0).toFixed(2)}`);
  console.log(`  Total Platform Fees: $${((pendingPayouts._sum.platformFee || 0) + (completedPayouts._sum.platformFee || 0)).toFixed(2)}`);
  
  // 4. Integrity Checks
  console.log(`\n\n4️⃣  INTEGRITY CHECKS`);
  console.log('─'.repeat(70));
  
  const checks = [];
  
  // Check 1: Escrow should be ~$0
  if (Math.abs(totalEscrow) < 0.01) {
    checks.push({ name: 'Escrow Balance', status: '✅ PASS', detail: '$0.00 (correct)' });
  } else {
    checks.push({ name: 'Escrow Balance', status: '❌ FAIL', detail: `$${totalEscrow.toFixed(2)} (should be ~$0)` });
  }
  
  // Check 2: Ledger double-entry balance
  let ledgerSum = 0;
  for (const balance of balances.values()) {
    ledgerSum += balance;
  }
  
  if (Math.abs(ledgerSum) < 0.01) {
    checks.push({ name: 'Ledger Double-Entry', status: '✅ PASS', detail: 'All debits = credits' });
  } else {
    checks.push({ name: 'Ledger Double-Entry', status: '❌ FAIL', detail: `Imbalance: $${ledgerSum.toFixed(2)}` });
  }
  
  // Check 3: Wallet balance consistency
  const walletDiff = Math.abs(totalWalletBalance - totalClientWallet);
  if (walletDiff < 0.01) {
    checks.push({ name: 'Wallet Consistency', status: '✅ PASS', detail: 'Wallet table matches ledger' });
  } else {
    checks.push({ name: 'Wallet Consistency', status: '⚠️  WARN', detail: `Difference: $${walletDiff.toFixed(2)}` });
  }
  
  // Check 4: Instructor payout consistency
  const payoutDiff = Math.abs(totalInstructorPaid - (completedPayouts._sum.instructorPayout || 0));
  if (payoutDiff < 0.01) {
    checks.push({ name: 'Payout Consistency', status: '✅ PASS', detail: 'Ledger matches old system' });
  } else {
    checks.push({ name: 'Payout Consistency', status: '⚠️  WARN', detail: `Difference: $${payoutDiff.toFixed(2)}` });
  }
  
  console.log('');
  for (const check of checks) {
    console.log(`  ${check.status} ${check.name}`);
    console.log(`      ${check.detail}`);
  }
  
  // 5. Recommendations
  console.log(`\n\n5️⃣  RECOMMENDATIONS`);
  console.log('─'.repeat(70));
  
  const passCount = checks.filter(c => c.status.includes('✅')).length;
  const failCount = checks.filter(c => c.status.includes('❌')).length;
  const warnCount = checks.filter(c => c.status.includes('⚠️')).length;
  
  console.log(`\n  Checks: ${passCount} passed, ${warnCount} warnings, ${failCount} failed\n`);
  
  if (failCount === 0 && warnCount === 0) {
    console.log(`  ✅ System is financially sound`);
    console.log(`  ✅ Ready for dual-write implementation`);
  } else {
    console.log(`  ⚠️  Review warnings before proceeding`);
    if (warnCount > 0) {
      console.log(`  📝 Wallet/ledger differences may be due to unmigrated bookings`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  
  await prisma.$disconnect();
}

main().catch(console.error);
