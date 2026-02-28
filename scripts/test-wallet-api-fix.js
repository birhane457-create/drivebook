const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testWalletAPI() {
  try {
    console.log('🧪 TESTING WALLET API FIX\n');
    
    // Get user
    const user = await prisma.user.findUnique({
      where: { email: 'admin@church.org' }
    });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    // Get wallet with transactions
    const wallet = await prisma.clientWallet.findUnique({
      where: { userId: user.id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    console.log('📊 ALL TRANSACTIONS:');
    console.log('─'.repeat(70));
    wallet.transactions.forEach(t => {
      const sign = t.type === 'CREDIT' ? '+' : '-';
      console.log(`${sign}$${t.amount.toFixed(2)} | ${t.type} | ${t.description}`);
    });
    
    console.log('\n💰 FILTERING LOGIC:');
    console.log('─'.repeat(70));
    
    // Actual deposits (not refunds)
    const deposits = wallet.transactions.filter(t => 
      t.type === 'CREDIT' && (
        t.description?.includes('Initial wallet credit') ||
        t.description?.includes('Added') ||
        t.description?.includes('Payment') ||
        (t.description?.includes('credit') && 
         !t.description?.includes('reduction') && 
         !t.description?.includes('Refund') && 
         !t.description?.includes('cancelled'))
      )
    );
    
    console.log('\n✅ ACTUAL DEPOSITS (Credits Added):');
    deposits.forEach(t => {
      console.log(`  +$${t.amount.toFixed(2)} - ${t.description}`);
    });
    const totalDeposits = deposits.reduce((sum, t) => sum + t.amount, 0);
    console.log(`  TOTAL: $${totalDeposits.toFixed(2)}`);
    
    // Actual booking charges (not adjustments)
    const bookingCharges = wallet.transactions.filter(t => 
      t.type === 'DEBIT' && (
        t.description?.includes('Booked') ||
        t.description?.includes('Booking payment') ||
        (t.description?.includes('lesson') && !t.description?.includes('increase'))
      )
    );
    
    console.log('\n✅ ACTUAL BOOKING CHARGES (Net Booking Costs):');
    bookingCharges.forEach(t => {
      console.log(`  -$${t.amount.toFixed(2)} - ${t.description}`);
    });
    const totalCharges = bookingCharges.reduce((sum, t) => sum + t.amount, 0);
    console.log(`  TOTAL: $${totalCharges.toFixed(2)}`);
    
    console.log('\n📈 EXPECTED UI DISPLAY:');
    console.log('─'.repeat(70));
    console.log(`Total Credits Added: $${totalDeposits.toFixed(2)}`);
    console.log(`Net Booking Costs: $${totalCharges.toFixed(2)}`);
    console.log(`Current Balance: $${wallet.balance.toFixed(2)}`);
    
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testWalletAPI();
