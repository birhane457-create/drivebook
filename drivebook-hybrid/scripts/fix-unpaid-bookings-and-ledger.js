const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 FIXING UNPAID BOOKINGS AND LEDGER ISSUES\n');
  
  const userId = '69996e3ab3895e34697953a8'; // admin@church.org
  
  // Step 1: Find unpaid CONFIRMED bookings
  console.log('Step 1: Finding unpaid CONFIRMED bookings...');
  const unpaidBookings = await prisma.booking.findMany({
    where: {
      userId: userId,
      status: 'CONFIRMED',
      isPaid: false
    },
    orderBy: { createdAt: 'asc' }
  });
  
  console.log(`Found ${unpaidBookings.length} unpaid CONFIRMED bookings:`);
  let totalUnpaid = 0;
  for (const booking of unpaidBookings) {
    console.log(`  - ${booking.id}: $${booking.price} on ${new Date(booking.startTime).toLocaleString()}`);
    totalUnpaid += booking.price;
  }
  console.log(`  Total unpaid: $${totalUnpaid.toFixed(2)}\n`);
  
  // Step 2: Check current wallet balance
  console.log('Step 2: Checking current wallet balance...');
  const wallet = await prisma.clientWallet.findUnique({
    where: { userId: userId }
  });
  
  console.log(`  Current wallet balance: $${wallet.balance.toFixed(2)}`);
  console.log(`  After deducting unpaid bookings: $${(wallet.balance - totalUnpaid).toFixed(2)}\n`);
  
  if (wallet.balance < totalUnpaid) {
    console.log('❌ ERROR: Insufficient wallet balance to cover unpaid bookings!');
    console.log('   This indicates a serious bug in the booking flow.');
    console.log('   Bookings should not be CONFIRMED without payment.\n');
    return;
  }
  
  // Step 3: Check ledger for duplicate entries
  console.log('Step 3: Checking ledger for issues...');
  const ledgerEntries = await prisma.financialLedger.findMany({
    where: { userId: userId },
    orderBy: { createdAt: 'asc' }
  });
  
  console.log(`  Found ${ledgerEntries.length} ledger entries`);
  
  // Group by description to find duplicates
  const descriptionMap = new Map();
  for (const entry of ledgerEntries) {
    const key = `${entry.description}-${entry.amount}`;
    if (!descriptionMap.has(key)) {
      descriptionMap.set(key, []);
    }
    descriptionMap.get(key).push(entry);
  }
  
  console.log('\n  Checking for duplicates:');
  let hasDuplicates = false;
  for (const [key, entries] of descriptionMap.entries()) {
    if (entries.length > 1) {
      console.log(`    ⚠️  Found ${entries.length} entries for: ${key}`);
      hasDuplicates = true;
    }
  }
  
  if (!hasDuplicates) {
    console.log('    ✅ No obvious duplicates found');
  }
  
  // Calculate ledger balance
  let ledgerBalance = 0;
  for (const entry of ledgerEntries) {
    if (entry.creditAccount.includes(userId)) {
      ledgerBalance += entry.amount;
    } else if (entry.debitAccount.includes(userId)) {
      ledgerBalance -= entry.amount;
    }
  }
  
  console.log(`\n  Ledger balance: $${ledgerBalance.toFixed(2)}`);
  console.log(`  Wallet balance: $${wallet.balance.toFixed(2)}`);
  console.log(`  Difference: $${(ledgerBalance - wallet.balance).toFixed(2)}\n`);
  
  // Step 4: Ask for confirmation
  console.log('═'.repeat(70));
  console.log('PROPOSED FIX:');
  console.log('═'.repeat(70));
  console.log(`1. Deduct $${totalUnpaid.toFixed(2)} from wallet for ${unpaidBookings.length} unpaid bookings`);
  console.log(`2. Mark those bookings as isPaid: true`);
  console.log(`3. Create wallet transaction records`);
  console.log(`4. Create ledger entries for proper accounting`);
  console.log(`\nFinal wallet balance will be: $${(wallet.balance - totalUnpaid).toFixed(2)}`);
  console.log('\nTo apply this fix, uncomment the transaction code below and re-run.\n');
  
  // UNCOMMENT TO APPLY FIX:
  /*
  console.log('Applying fix...\n');
  
  await prisma.$transaction(async (tx) => {
    // Update wallet balance
    await tx.clientWallet.update({
      where: { userId: userId },
      data: {
        balance: { decrement: totalUnpaid }
      }
    });
    
    // Create wallet transaction
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEBIT',
        amount: totalUnpaid,
        description: `Retroactive payment for ${unpaidBookings.length} confirmed booking(s)`,
        status: 'completed'
      }
    });
    
    // Update each booking
    for (const booking of unpaidBookings) {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          isPaid: true,
          paidAt: new Date(),
          paymentCaptured: true,
          paymentCapturedAt: new Date()
        }
      });
      
      // Create ledger entry for each booking
      const clientWalletAccount = `CLIENT_WALLET:${userId}`;
      const escrowAccount = 'PLATFORM_ESCROW';
      
      await tx.financialLedger.create({
        data: {
          debitAccount: clientWalletAccount,
          creditAccount: escrowAccount,
          amount: booking.price,
          description: `Retroactive booking payment for booking ${booking.id}`,
          idempotencyKey: `retroactive-booking-${booking.id}-${Date.now()}`,
          bookingId: booking.id,
          userId: userId,
          instructorId: booking.instructorId,
          createdBy: 'SYSTEM'
        }
      });
      
      console.log(`  ✅ Fixed booking ${booking.id}`);
    }
  });
  
  console.log('\n✅ Fix applied successfully!');
  console.log('\nRun scripts/financial-integrity-report.js to verify.\n');
  */
  
  await prisma.$disconnect();
}

main().catch(console.error);
