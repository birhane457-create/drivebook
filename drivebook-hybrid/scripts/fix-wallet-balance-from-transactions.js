const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing Wallet Balances from Transactions\n');
  
  const wallets = await prisma.clientWallet.findMany({
    include: {
      user: { select: { id: true, email: true } },
      transactions: true
    }
  });
  
  console.log(`Found ${wallets.length} wallets\n`);
  
  for (const wallet of wallets) {
    console.log(`\nWallet: ${wallet.id}`);
    console.log(`User: ${wallet.user.email}`);
    console.log(`Current Balance: $${wallet.balance.toFixed(2)}`);
    
    // Calculate correct balance from transactions
    const credits = await prisma.walletTransaction.aggregate({
      where: { 
        walletId: wallet.id,
        type: 'CREDIT'
      },
      _sum: { amount: true }
    });
    
    const debits = await prisma.walletTransaction.aggregate({
      where: { 
        walletId: wallet.id,
        type: 'DEBIT'
      },
      _sum: { amount: true }
    });
    
    const totalCredits = credits._sum.amount || 0;
    const totalDebits = debits._sum.amount || 0;
    const correctBalance = totalCredits - totalDebits;
    
    console.log(`Calculated Balance: $${correctBalance.toFixed(2)}`);
    console.log(`  Credits: $${totalCredits.toFixed(2)}`);
    console.log(`  Debits: $${totalDebits.toFixed(2)}`);
    
    const difference = Math.abs(wallet.balance - correctBalance);
    
    if (difference > 0.01) {
      console.log(`❌ Mismatch: $${difference.toFixed(2)}`);
      console.log(`Updating wallet balance...`);
      
      await prisma.clientWallet.update({
        where: { id: wallet.id },
        data: { balance: correctBalance }
      });
      
      console.log(`✅ Updated to $${correctBalance.toFixed(2)}`);
    } else {
      console.log(`✅ Balance is correct`);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ Wallet balance fix complete');
  
  await prisma.$disconnect();
}

main().catch(console.error);
