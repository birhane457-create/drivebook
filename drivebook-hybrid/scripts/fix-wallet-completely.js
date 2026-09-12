const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 COMPREHENSIVE WALLET FIX\n');
  
  const userId = '69996e3ab3895e34697953a8'; // admin@church.org
  
  // Step 1: Get current state
  console.log('Step 1: Analyzing current state...\n');
  
  const wallet = await prisma.clientWallet.findUnique({
    where: { userId: userId },
    include: {
      transactions: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });
  
  const transactions = wallet.transactions || [];
  const totalCredits = transactions
    .filter(t => t.type === 'CREDIT')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalDebits = transactions
    .filter(t => t.type === 'DEBIT')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const expectedBalance = totalCredits - totalDebits;
  
  console.log('Current Wallet State:');
  console.log(`  wallet.balance: $${wallet.balance.toFixed(2)}`);
  console.log(`  wallet.totalPaid: $${wallet.totalPaid.toFixed(2)} (stale)`);
  console.log(`  wallet.totalSpent: $${wallet.totalSpent.toFixed(2)} (stale)`);
  console.log(`  wallet.creditsRemaining: $${wallet.creditsRemaining.toFixed(2)} (stale)`);
  console.log('');
  console.log('Calculated from Transactions:');
  console.log(`  Total CREDIT: $${totalCredits.toFixed(2)}`);
  console.log(`  Total DEBIT: $${totalDebits.toFixed(2)}`);
  console.log(`  Expected Balance: $${expectedBalance.toFixed(2)}`);
  console.log('');
  console.log(`Discrepancy: $${(wallet.balance - expectedBalance).toFixed(2)}`);
  
  // Step 2: Check unpaid bookings
  console.log('\n\nStep 2: Checking unpaid bookings...\n');
  
  const unpaidBookings = await prisma.booking.findMany({
    where: {
      userId: userId,
      status: 'CONFIRMED',
      isPaid: false
    },
    orderBy: { startTime: 'asc' }
  });
  
  const unpaidTotal = unpaidBookings.reduce((sum, b) => sum + b.price, 0);
  
  console.log(`Found ${unpaidBookings.length} unpaid CONFIRMED bookings:`);
  for (const booking of unpaidBookings) {
    console.log(`  - $${booking.price} on ${new Date(booking.startTime).toLocaleString()}`);
  }
  console.log(`Total unpaid: $${unpaidTotal.toFixed(2)}`);
  
  // Step 3: Propose fix
  console.log('\n\n' + '═'.repeat(70));
  console.log('PROPOSED FIX:');
  console.log('═'.repeat(70));
  console.log('');
  console.log('The wallet.balance field was manually set to $720, but this doesn\'t');
  console.log('match the transaction history. Here are the options:');
  console.log('');
  console.log('OPTION A: Trust the $720 balance (what you manually set)');
  console.log(`  - Keep balance at $720`);
  console.log(`  - Deduct $${unpaidTotal.toFixed(2)} for unpaid bookings`);
  console.log(`  - Final balance: $${(720 - unpaidTotal).toFixed(2)}`);
  console.log(`  - Clean up stale fields (totalPaid, totalSpent, creditsRemaining)`);
  console.log('');
  console.log('OPTION B: Trust the transaction history');
  console.log(`  - Set balance to $${expectedBalance.toFixed(2)} (based on transactions)`);
  console.log(`  - Deduct $${unpaidTotal.toFixed(2)} for unpaid bookings`);
  console.log(`  - Final balance: $${(expectedBalance - unpaidTotal).toFixed(2)}`);
  console.log(`  - Clean up stale fields`);
  console.log('');
  console.log('RECOMMENDATION: Option A (trust the $720)');
  console.log('  The $500 you added went to wallet.balance but wasn\'t recorded');
  console.log('  in transactions. This is a dual-write failure.');
  console.log('');
  
  // Applying Option A:
  console.log('Applying Option A...\n');
  
  
  console.log('Applying Option A...\n');
  
  await prisma.$transaction(async (tx) => {
    // 1. Deduct unpaid bookings from wallet
    const newBalance = 720 - unpaidTotal;
    
    await tx.clientWallet.update({
      where: { userId: userId },
      data: {
        balance: newBalance,
        // Clean up stale fields - these will be calculated from transactions
        totalPaid: 0,
        totalSpent: 0,
        creditsRemaining: 0
      }
    });
    
    console.log(`  ✅ Updated wallet balance: $${newBalance.toFixed(2)}`);
    
    // 2. Create wallet transaction for unpaid bookings
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEBIT',
        amount: unpaidTotal,
        description: `Payment for ${unpaidBookings.length} confirmed booking(s)`,
        status: 'completed'
      }
    });
    
    console.log(`  ✅ Created wallet transaction: -$${unpaidTotal.toFixed(2)}`);
    
    // 3. Mark bookings as paid
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
      
      console.log(`  ✅ Marked booking ${booking.id} as paid`);
    }
    
    // 4. Create ledger entries
    const clientWalletAccount = `CLIENT_WALLET:${userId}`;
    const escrowAccount = 'PLATFORM_ESCROW';
    
    for (const booking of unpaidBookings) {
      await tx.financialLedger.create({
        data: {
          debitAccount: clientWalletAccount,
          creditAccount: escrowAccount,
          amount: booking.price,
          description: `Booking payment for ${booking.id}`,
          idempotencyKey: `booking-payment-${booking.id}-${Date.now()}`,
          bookingId: booking.id,
          userId: userId,
          instructorId: booking.instructorId,
          createdBy: 'SYSTEM'
        }
      });
      
      console.log(`  ✅ Created ledger entry for booking ${booking.id}`);
    }
  });
  
  console.log('\n✅ Fix applied successfully!');
  console.log('\nFinal state:');
  console.log(`  Wallet balance: $${(720 - unpaidTotal).toFixed(2)}`);
  console.log(`  All bookings marked as paid`);
  console.log(`  Ledger entries created`);
  console.log('\nRun scripts/financial-integrity-report.js to verify.\n');
  
  
  await prisma.$disconnect();
}

main().catch(console.error);
