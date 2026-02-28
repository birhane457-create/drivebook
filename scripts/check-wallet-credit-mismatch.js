const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Investigating Wallet Credit Mismatch\n');
  
  // Get all wallets
  const wallets = await prisma.clientWallet.findMany({
    include: {
      user: { select: { id: true, email: true } },
      transactions: true
    }
  });
  
  console.log(`Found ${wallets.length} wallets\n`);
  
  for (const wallet of wallets) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Wallet for User ID: ${wallet.userId}`);
    console.log(`Email: ${wallet.user?.email || 'N/A'}`);
    console.log(`Wallet ID: ${wallet.id}`);
    console.log(`─`.repeat(60));
    
    // Wallet balance from Wallet table
    console.log(`\nWallet Table Balance: $${wallet.balance.toFixed(2)}`);
    
    // Calculate balance from WalletTransaction table
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
    const calculatedBalance = totalCredits - totalDebits;
    
    console.log(`\nWalletTransaction Calculations:`);
    console.log(`  Total Credits: $${totalCredits.toFixed(2)}`);
    console.log(`  Total Debits: $${totalDebits.toFixed(2)}`);
    console.log(`  Calculated Balance: $${calculatedBalance.toFixed(2)}`);
    
    // Check for mismatch
    const difference = Math.abs(wallet.balance - calculatedBalance);
    if (difference > 0.01) {
      console.log(`\n❌ MISMATCH DETECTED!`);
      console.log(`   Difference: $${difference.toFixed(2)}`);
    } else {
      console.log(`\n✅ Balance matches`);
    }
    
    // Show all transactions
    console.log(`\nAll Wallet Transactions (${wallet.transactions.length}):`);
    for (const tx of wallet.transactions) {
      const sign = tx.type === 'CREDIT' ? '+' : '-';
      console.log(`  ${tx.createdAt.toISOString().split('T')[0]} | ${tx.type.padEnd(6)} | ${sign}$${tx.amount.toFixed(2)} | ${tx.description || 'No description'}`);
    }
  }
  
  // Check ledger entries for wallet credits
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('LEDGER ENTRIES FOR WALLET CREDITS');
  console.log(`${'='.repeat(60)}\n`);
  
  const ledgerWalletEntries = await prisma.financialLedger.findMany({
    where: {
      OR: [
        { debitAccount: { contains: 'CLIENT_WALLET' } },
        { creditAccount: { contains: 'CLIENT_WALLET' } }
      ]
    },
    orderBy: { createdAt: 'asc' }
  });
  
  console.log(`Found ${ledgerWalletEntries.length} ledger entries involving CLIENT_WALLET\n`);
  
  // Group by account
  const accountBalances = new Map();
  
  for (const entry of ledgerWalletEntries) {
    console.log(`${entry.createdAt.toISOString().split('T')[0]} | ${entry.debitAccount.padEnd(40)} → ${entry.creditAccount.padEnd(40)} | $${entry.amount.toFixed(2)}`);
    console.log(`  Description: ${entry.description}`);
    console.log(`  Idempotency: ${entry.idempotencyKey}`);
    console.log('');
    
    // Calculate balances
    const debitBalance = accountBalances.get(entry.debitAccount) || 0;
    accountBalances.set(entry.debitAccount, debitBalance - entry.amount);
    
    const creditBalance = accountBalances.get(entry.creditAccount) || 0;
    accountBalances.set(entry.creditAccount, creditBalance + entry.amount);
  }
  
  console.log(`\nLedger Account Balances:`);
  for (const [account, balance] of accountBalances.entries()) {
    if (account.includes('CLIENT_WALLET')) {
      console.log(`  ${account}: $${balance.toFixed(2)}`);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
