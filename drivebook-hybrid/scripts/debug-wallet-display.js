const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 DEBUGGING WALLET DISPLAY ISSUE\n');
  
  const userId = '69996e3ab3895e34697953a8'; // admin@church.org
  
  // Get wallet with transactions
  const wallet = await prisma.clientWallet.findUnique({
    where: { userId: userId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  
  console.log('📊 WALLET TABLE DATA:');
  console.log('─'.repeat(70));
  console.log(`  balance: $${wallet.balance.toFixed(2)}`);
  console.log(`  totalPaid: $${wallet.totalPaid.toFixed(2)}`);
  console.log(`  totalSpent: $${wallet.totalSpent.toFixed(2)}`);
  console.log(`  creditsRemaining: $${wallet.creditsRemaining.toFixed(2)}`);
  
  // Calculate from transactions
  console.log('\n\n💳 CALCULATED FROM WALLET TRANSACTIONS:');
  console.log('─'.repeat(70));
  
  const transactions = wallet.transactions || [];
  const totalPaid = transactions
    .filter(t => t.type === 'CREDIT')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalSpent = transactions
    .filter(t => t.type === 'DEBIT')
    .reduce((sum, t) => sum + t.amount, 0);
  
  console.log(`  Total CREDIT transactions: $${totalPaid.toFixed(2)}`);
  console.log(`  Total DEBIT transactions: $${totalSpent.toFixed(2)}`);
  console.log(`  Expected balance: $${(totalPaid - totalSpent).toFixed(2)}`);
  
  // Get ledger balance
  console.log('\n\n📒 LEDGER BALANCE:');
  console.log('─'.repeat(70));
  
  const ledgerEntries = await prisma.financialLedger.findMany({
    where: { userId: userId },
    orderBy: { createdAt: 'desc' }
  });
  
  let ledgerBalance = 0;
  for (const entry of ledgerEntries) {
    if (entry.creditAccount.includes(userId)) {
      ledgerBalance += entry.amount;
    } else if (entry.debitAccount.includes(userId)) {
      ledgerBalance -= entry.amount;
    }
  }
  
  console.log(`  Ledger balance: $${ledgerBalance.toFixed(2)}`);
  
  // Check what the API would return
  console.log('\n\n🔌 WHAT THE API RETURNS:');
  console.log('─'.repeat(70));
  console.log('  Based on /api/client/wallet route.ts logic:');
  console.log(`    balance: $${wallet.balance.toFixed(2)} (from wallet.balance)`);
  console.log(`    totalPaid: $${totalPaid.toFixed(2)} (calculated from CREDIT txns)`);
  console.log(`    totalSpent: $${totalSpent.toFixed(2)} (calculated from DEBIT txns)`);
  console.log(`    creditsRemaining: $${wallet.balance.toFixed(2)} (from wallet.balance)`);
  
  // Show what the UI displays
  console.log('\n\n🖥️  WHAT THE UI DISPLAYS:');
  console.log('─'.repeat(70));
  console.log(`  "Total Balance": $${totalPaid.toFixed(2)} (shows totalPaid)`);
  console.log(`  "Total Spent": $${totalSpent.toFixed(2)} (shows totalSpent)`);
  console.log(`  "Balance Remaining": $${wallet.balance.toFixed(2)} (shows creditsRemaining)`);
  
  // Identify the confusion
  console.log('\n\n⚠️  THE CONFUSION:');
  console.log('─'.repeat(70));
  console.log('  The UI shows:');
  console.log(`    - "Total Balance" = $${totalPaid.toFixed(2)} (total credits ADDED)`);
  console.log(`    - "Balance Remaining" = $${wallet.balance.toFixed(2)} (actual balance)`);
  console.log('');
  console.log('  This is confusing because:');
  console.log('    - "Total Balance" sounds like current balance, but it\'s total added');
  console.log('    - "Balance Remaining" is the actual current balance');
  console.log('');
  console.log('  The math doesn\'t add up because:');
  console.log(`    - Total Added ($${totalPaid.toFixed(2)}) - Total Spent ($${totalSpent.toFixed(2)}) = $${(totalPaid - totalSpent).toFixed(2)}`);
  console.log(`    - But "Balance Remaining" shows $${wallet.balance.toFixed(2)}`);
  console.log(`    - Difference: $${(wallet.balance - (totalPaid - totalSpent)).toFixed(2)}`);
  
  // Check for unpaid bookings
  console.log('\n\n📅 UNPAID BOOKINGS:');
  console.log('─'.repeat(70));
  
  const unpaidBookings = await prisma.booking.findMany({
    where: {
      userId: userId,
      status: 'CONFIRMED',
      isPaid: false
    }
  });
  
  const unpaidTotal = unpaidBookings.reduce((sum, b) => sum + b.price, 0);
  console.log(`  Found ${unpaidBookings.length} unpaid CONFIRMED bookings`);
  console.log(`  Total unpaid: $${unpaidTotal.toFixed(2)}`);
  
  if (unpaidBookings.length > 0) {
    console.log('\n  These bookings should be deducted from wallet:');
    for (const booking of unpaidBookings) {
      console.log(`    - $${booking.price} on ${new Date(booking.startTime).toLocaleString()}`);
    }
    console.log(`\n  After deducting unpaid bookings:`);
    console.log(`    Balance would be: $${(wallet.balance - unpaidTotal).toFixed(2)}`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
