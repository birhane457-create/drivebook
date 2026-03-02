const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupDuplicateCredits() {
  try {
    console.log('🧹 CLEANING UP DUPLICATE MANUAL CREDITS\n');
    
    // Get the user
    const user = await prisma.user.findUnique({
      where: { email: 'admin@church.org' }
    });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    // Get wallet
    const wallet = await prisma.clientWallet.findUnique({
      where: { userId: user.id },
      include: {
        transactions: {
          where: {
            amount: 35,
            type: 'CREDIT'
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (!wallet) {
      console.log('❌ Wallet not found');
      return;
    }
    
    console.log(`Found ${wallet.transactions.length} manual credit transactions:`);
    wallet.transactions.forEach((t, i) => {
      console.log(`  ${i + 1}. $${t.amount} - ${t.description} - ${t.createdAt.toLocaleString()}`);
    });
    
    if (wallet.transactions.length <= 1) {
      console.log('\n✅ No duplicates to remove');
      return;
    }
    
    // Keep the one with the longest/best description (the detailed one)
    const sorted = [...wallet.transactions].sort((a, b) => b.description.length - a.description.length);
    const toKeep = sorted[0];
    const toRemove = wallet.transactions.filter(t => t.id !== toKeep.id);
    
    console.log(`\n📌 Keeping: $${toKeep.amount} - "${toKeep.description}"`);
    console.log(`🗑️  Removing ${toRemove.length} duplicate(s):`);
    
    let totalToRefund = 0;
    for (const t of toRemove) {
      console.log(`  - $${t.amount} - "${t.description}"`);
      totalToRefund += t.amount;
    }
    
    // Delete duplicate transactions
    await prisma.walletTransaction.deleteMany({
      where: {
        id: { in: toRemove.map(t => t.id) }
      }
    });
    
    // Adjust wallet balance
    await prisma.clientWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: totalToRefund }
      }
    });
    
    console.log(`\n✅ Removed ${toRemove.length} duplicate transaction(s)`);
    console.log(`✅ Adjusted wallet balance by -$${totalToRefund}`);
    
    // Show final state
    const updatedWallet = await prisma.clientWallet.findUnique({
      where: { id: wallet.id }
    });
    
    console.log(`\n📊 Final wallet balance: $${updatedWallet.balance.toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicateCredits();
