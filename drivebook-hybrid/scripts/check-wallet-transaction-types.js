const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTransactionTypes() {
  console.log('🔍 Checking Wallet Transaction Types\n');

  try {
    const user = await prisma.user.findUnique({
      where: { email: 'chairman@erotc.org' }
    });

    if (!user) {
      console.log('❌ User not found\n');
      return;
    }

    const wallet = await prisma.clientWallet.findUnique({
      where: { userId: user.id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!wallet) {
      console.log('❌ Wallet not found\n');
      return;
    }

    console.log(`💰 Wallet: ${wallet.id}`);
    console.log(`   Balance: $${wallet.balance}`);
    console.log(`   Credits Remaining: $${wallet.creditsRemaining}`);
    console.log(`   Total Added: $${wallet.totalPaid}`);
    console.log(`   Total Spent: $${wallet.totalSpent}\n`);

    console.log(`📋 Transactions: ${wallet.transactions.length}\n`);

    for (const tx of wallet.transactions) {
      console.log(`   ID: ${tx.id}`);
      console.log(`   Type: "${tx.type}" (${typeof tx.type})`);
      console.log(`   Amount: $${tx.amount}`);
      console.log(`   Description: ${tx.description}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Created: ${tx.createdAt.toLocaleString()}\n`);
    }

    // Test the API filter logic
    console.log('\n🧪 Testing API Filter Logic:\n');

    const totalPaid = wallet.transactions
      .filter(t => {
        const matches = t.type === 'CREDIT';
        console.log(`   Transaction ${t.id.substring(0, 8)}...`);
        console.log(`      Type: "${t.type}"`);
        console.log(`      Matches 'CREDIT': ${matches}`);
        console.log(`      Amount: $${t.amount}\n`);
        return matches;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    console.log(`   Total Paid (uppercase 'CREDIT'): $${totalPaid}\n`);

    const totalPaidLowercase = wallet.transactions
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);

    console.log(`   Total Paid (lowercase 'credit'): $${totalPaidLowercase}\n`);

    const totalPaidCaseInsensitive = wallet.transactions
      .filter(t => t.type.toUpperCase() === 'CREDIT')
      .reduce((sum, t) => sum + t.amount, 0);

    console.log(`   Total Paid (case-insensitive): $${totalPaidCaseInsensitive}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTransactionTypes();
