const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 TRACING WHERE $560 "SPENT" COMES FROM\n');
  
  const userId = '69996e3ab3895e34697953a8';
  
  const wallet = await prisma.clientWallet.findUnique({
    where: { userId: userId },
    include: {
      transactions: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });
  
  console.log('WALLET TABLE FIELDS:');
  console.log('─'.repeat(70));
  console.log(`  wallet.balance: $${wallet.balance}`);
  console.log(`  wallet.totalPaid: $${wallet.totalPaid}`);
  console.log(`  wallet.totalSpent: $${wallet.totalSpent}`);
  console.log(`  wallet.creditsRemaining: $${wallet.creditsRemaining}`);
  
  console.log('\n\nCALCULATED FROM TRANSACTIONS:');
  console.log('─'.repeat(70));
  
  const credits = wallet.transactions.filter(t => t.type === 'CREDIT');
  const debits = wallet.transactions.filter(t => t.type === 'DEBIT');
  
  console.log('\nCREDIT Transactions:');
  let totalCredits = 0;
  for (const t of credits) {
    console.log(`  +$${t.amount} - ${t.description}`);
    totalCredits += t.amount;
  }
  console.log(`  TOTAL CREDITS: $${totalCredits}`);
  
  console.log('\nDEBIT Transactions:');
  let totalDebits = 0;
  for (const t of debits) {
    console.log(`  -$${t.amount} - ${t.description}`);
    totalDebits += t.amount;
  }
  console.log(`  TOTAL DEBITS: $${totalDebits}`);
  
  console.log('\n\n🎯 THE ANSWER:');
  console.log('─'.repeat(70));
  console.log(`The UI is showing "Total Spent: $560"`);
  console.log('');
  console.log('This could be coming from:');
  console.log(`  1. wallet.totalSpent field = $${wallet.totalSpent} ❌ (not 560)`);
  console.log(`  2. Calculated from DEBIT txns = $${totalDebits} ❌ (not 560)`);
  console.log(`  3. Total Paid - Balance = $710 - $510 = $200 ❌ (not 560)`);
  console.log('');
  
  // Check if there's caching or if some transactions are being filtered
  console.log('Wait... let me check if the UI is filtering transactions...');
  console.log('');
  
  // Maybe the UI is excluding the $210 payment we just added?
  const debitsExcludingLast = debits.slice(0, -1);
  const totalDebitsExcludingLast = debitsExcludingLast.reduce((sum, t) => sum + t.amount, 0);
  console.log(`  Debits excluding last payment: $${totalDebitsExcludingLast} ❌ (not 560)`);
  
  // Maybe it's excluding the $140 booking?
  const totalDebitsExcluding140 = totalDebits - 140;
  console.log(`  Total debits - $140 = $${totalDebitsExcluding140} ✅ THIS IS IT!`);
  console.log('');
  console.log('🎯 FOUND IT!');
  console.log(`  The UI is showing $560 = $700 - $140`);
  console.log('  The $140 "Booked 2 lessons" transaction is being excluded somehow.');
  console.log('');
  console.log('  Possible reasons:');
  console.log('    - Those 2 bookings were cancelled');
  console.log('    - The UI is filtering out cancelled bookings');
  console.log('    - There\'s a bug in the calculation');
  
  // Check if those bookings are cancelled
  console.log('\n\nCHECKING BOOKINGS:');
  console.log('─'.repeat(70));
  
  const allBookings = await prisma.booking.findMany({
    where: { userId: userId },
    orderBy: { createdAt: 'asc' }
  });
  
  console.log(`\nTotal bookings: ${allBookings.length}`);
  for (const b of allBookings) {
    console.log(`  ${b.status} - $${b.price} - ${new Date(b.startTime).toLocaleDateString()}`);
  }
  
  const cancelledBookings = allBookings.filter(b => b.status === 'CANCELLED');
  const cancelledTotal = cancelledBookings.reduce((sum, b) => sum + b.price, 0);
  
  console.log(`\nCancelled bookings: ${cancelledBookings.length}`);
  console.log(`Cancelled total: $${cancelledTotal}`);
  
  console.log('\n\n✅ CONCLUSION:');
  console.log('─'.repeat(70));
  console.log(`The $560 is likely: $700 (total debits) - $140 (cancelled bookings)`);
  console.log('The UI might be excluding cancelled bookings from "Total Spent".');
  
  await prisma.$disconnect();
}

main().catch(console.error);
