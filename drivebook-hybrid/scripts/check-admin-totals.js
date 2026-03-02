const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdminTotals() {
  try {
    console.log('🔍 CHECKING ADMIN TOTALS CALCULATION\n');
    
    const user = await prisma.user.findUnique({
      where: { email: 'admin@church.org' },
      include: {
        wallet: {
          include: {
            transactions: {
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    });
    
    if (!user || !user.wallet) {
      console.log('❌ User or wallet not found');
      return;
    }
    
    console.log(`User: ${user.email}`);
    console.log(`Wallet Balance: $${user.wallet.balance}\n`);
    
    console.log('📋 ALL TRANSACTIONS:');
    user.wallet.transactions.forEach((t, i) => {
      console.log(`${i + 1}. ${t.type} - $${t.amount} - ${t.description}`);
    });
    
    console.log('\n💰 CALCULATION BREAKDOWN:');
    
    // All credits
    const allCredits = user.wallet.transactions
      .filter(t => t.type === 'CREDIT')
      .reduce((sum, t) => sum + t.amount, 0);
    console.log(`All CREDIT transactions: $${allCredits}`);
    
    // Credits excluding duration adjustments AND admin refunds
    const actualCredits = user.wallet.transactions
      .filter(t => 
        t.type === 'CREDIT' && 
        !t.description.toLowerCase().includes('duration reduction') &&
        !t.description.toLowerCase().includes('manual credit') &&
        !t.description.toLowerCase().includes('refund') &&
        !t.description.toLowerCase().includes('admin')
      )
      .reduce((sum, t) => sum + t.amount, 0);
    console.log(`Credits (actual money paid by user): $${actualCredits}`);
    
    // All debits
    const allDebits = user.wallet.transactions
      .filter(t => t.type === 'DEBIT')
      .reduce((sum, t) => sum + t.amount, 0);
    console.log(`All DEBIT transactions: $${allDebits}`);
    
    // Debits excluding duration adjustments
    const bookingCharges = user.wallet.transactions
      .filter(t => 
        t.type === 'DEBIT' && 
        !t.description.toLowerCase().includes('duration increase')
      )
      .reduce((sum, t) => sum + t.amount, 0);
    console.log(`Booking charges (excluding duration adjustments): $${bookingCharges}`);
    
    // Cancellation refunds
    const cancellationRefunds = user.wallet.transactions
      .filter(t => 
        t.type === 'CREDIT' && 
        (t.description.toLowerCase().includes('refund') || 
         t.description.toLowerCase().includes('cancel'))
      )
      .reduce((sum, t) => sum + t.amount, 0);
    console.log(`Cancellation refunds: $${cancellationRefunds}`);
    
    const netSpent = bookingCharges - cancellationRefunds;
    console.log(`Net booking costs: $${netSpent}`);
    
    console.log('\n✅ CORRECT DISPLAY:');
    console.log(`Total Credits Added: $${actualCredits} (money paid from bank)`);
    console.log(`Net Booking Costs: $${netSpent} (charges minus refunds)`);
    console.log(`Current Balance: $${user.wallet.balance}`);
    
    console.log('\n📊 BALANCE VERIFICATION:');
    console.log(`$${actualCredits} (paid) - $${netSpent} (net spent) = $${actualCredits - netSpent}`);
    console.log(`Expected: $${user.wallet.balance}`);
    console.log(`Match: ${actualCredits - netSpent === user.wallet.balance ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminTotals();
