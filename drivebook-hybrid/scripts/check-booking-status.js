const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 CHECKING BOOKING STATUS\n');
  
  // Find the user
  const user = await prisma.user.findUnique({
    where: { email: 'admin@church.org' },
    include: { 
      wallet: true,
      bookings: {
        orderBy: { createdAt: 'desc' },
        take: 10
      }
    }
  });
  
  if (!user) {
    console.log('❌ User not found');
    return;
  }
  
  console.log(`User: ${user.email}`);
  console.log(`User ID: ${user.id}`);
  console.log(`Wallet Balance: $${user.wallet?.balance || 0}\n`);
  
  // Get wallet transactions
  const walletTxns = await prisma.walletTransaction.findMany({
    where: { walletId: user.wallet.id },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('💳 WALLET TRANSACTIONS:');
  console.log('─'.repeat(70));
  let totalCredits = 0;
  let totalDebits = 0;
  
  for (const txn of walletTxns) {
    const sign = txn.type === 'CREDIT' ? '+' : '-';
    console.log(`${sign}$${txn.amount.toFixed(2)} | ${txn.type} | ${txn.description}`);
    console.log(`  Created: ${new Date(txn.createdAt).toLocaleString()}`);
    
    if (txn.type === 'CREDIT') totalCredits += txn.amount;
    if (txn.type === 'DEBIT') totalDebits += txn.amount;
  }
  
  console.log(`\nTotal Credits: $${totalCredits.toFixed(2)}`);
  console.log(`Total Debits: $${totalDebits.toFixed(2)}`);
  console.log(`Expected Balance: $${(totalCredits - totalDebits).toFixed(2)}`);
  console.log(`Actual Balance: $${user.wallet.balance.toFixed(2)}`);
  
  // Get bookings
  console.log('\n\n📅 BOOKINGS:');
  console.log('─'.repeat(70));
  
  const bookings = user.bookings;
  
  if (bookings.length === 0) {
    console.log('No bookings found');
  } else {
    for (const booking of bookings) {
      console.log(`\nBooking ID: ${booking.id}`);
      console.log(`  Status: ${booking.status}`);
      console.log(`  Price: $${booking.price}`);
      console.log(`  Start: ${new Date(booking.startTime).toLocaleString()}`);
      console.log(`  End: ${new Date(booking.endTime).toLocaleString()}`);
      console.log(`  Is Paid: ${booking.isPaid}`);
      console.log(`  Payment Captured: ${booking.paymentCaptured}`);
      console.log(`  Created: ${new Date(booking.createdAt).toLocaleString()}`);
    }
  }
  
  // Check ledger
  console.log('\n\n📒 LEDGER ENTRIES:');
  console.log('─'.repeat(70));
  
  const ledgerEntries = await prisma.financialLedger.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' }
  });
  
  let ledgerBalance = 0;
  for (const entry of ledgerEntries) {
    if (entry.creditAccount.includes(user.id)) {
      ledgerBalance += entry.amount;
      console.log(`+$${entry.amount.toFixed(2)} | ${entry.description}`);
    } else if (entry.debitAccount.includes(user.id)) {
      ledgerBalance -= entry.amount;
      console.log(`-$${entry.amount.toFixed(2)} | ${entry.description}`);
    }
  }
  
  console.log(`\nLedger Balance: $${ledgerBalance.toFixed(2)}`);
  
  // Summary
  console.log('\n\n📊 SUMMARY:');
  console.log('─'.repeat(70));
  console.log(`Wallet Balance: $${user.wallet.balance.toFixed(2)}`);
  console.log(`Ledger Balance: $${ledgerBalance.toFixed(2)}`);
  console.log(`Total Bookings: ${bookings.length}`);
  console.log(`Pending Bookings: ${bookings.filter(b => b.status === 'PENDING').length}`);
  console.log(`Confirmed Bookings: ${bookings.filter(b => b.status === 'CONFIRMED').length}`);
  console.log(`Completed Bookings: ${bookings.filter(b => b.status === 'COMPLETED').length}`);
  
  const upcomingBookings = bookings.filter(b => 
    (b.status === 'PENDING' || b.status === 'CONFIRMED') && 
    new Date(b.startTime) > new Date()
  );
  
  console.log(`\nUpcoming Bookings: ${upcomingBookings.length}`);
  if (upcomingBookings.length > 0) {
    const upcomingTotal = upcomingBookings.reduce((sum, b) => sum + b.price, 0);
    console.log(`Upcoming Total: $${upcomingTotal.toFixed(2)}`);
    console.log(`\nIf these bookings are deducted:`);
    console.log(`  Remaining Balance: $${(user.wallet.balance - upcomingTotal).toFixed(2)}`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
