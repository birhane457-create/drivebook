const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Investigating Client/User ID Mismatch\n');
  
  // Get the wallet with transactions
  const wallet = await prisma.clientWallet.findUnique({
    where: { userId: '69996e3ab3895e34697953a8' },
    include: {
      user: { select: { id: true, email: true, role: true } },
      transactions: true
    }
  });
  
  console.log('Wallet Owner:');
  console.log(`  User ID: ${wallet.userId}`);
  console.log(`  Email: ${wallet.user.email}`);
  console.log(`  Role: ${wallet.user.role}`);
  console.log(`  Wallet Balance: $${wallet.balance.toFixed(2)}`);
  console.log(`  Transactions: ${wallet.transactions.length}`);
  
  // Find bookings that debited this wallet
  const debitTransactions = wallet.transactions.filter(t => t.type === 'DEBIT');
  console.log(`\nDebit Transactions (${debitTransactions.length}):`);
  
  for (const tx of debitTransactions) {
    console.log(`\n  Transaction: ${tx.id}`);
    console.log(`  Amount: -$${tx.amount.toFixed(2)}`);
    console.log(`  Description: ${tx.description}`);
    console.log(`  Date: ${tx.createdAt.toISOString().split('T')[0]}`);
    
    // Try to find related booking
    if (tx.description.includes('Booked')) {
      // Search for bookings around this time
      const bookings = await prisma.booking.findMany({
        where: {
          createdAt: {
            gte: new Date(tx.createdAt.getTime() - 60000), // 1 min before
            lte: new Date(tx.createdAt.getTime() + 60000)  // 1 min after
          },
          price: tx.amount
        },
        include: {
          client: true
        }
      });
      
      if (bookings.length > 0) {
        console.log(`  Related Bookings Found: ${bookings.length}`);
        for (const booking of bookings) {
          console.log(`    Booking ID: ${booking.id}`);
          console.log(`    Client ID: ${booking.clientId}`);
          console.log(`    Client.userId: ${booking.client?.userId || 'NULL'}`);
          console.log(`    Booking.userId: ${booking.userId || 'NULL'}`);
          console.log(`    Price: $${booking.price}`);
        }
      } else {
        console.log(`  No matching bookings found`);
      }
    }
  }
  
  // Check if there's a Client record for this user
  const client = await prisma.client.findFirst({
    where: {
      OR: [
        { userId: wallet.userId },
        { id: '69956aa90d2414c99d15bb9e' } // The clientId used in bookings
      ]
    }
  });
  
  console.log(`\n\nClient Record Check:`);
  if (client) {
    console.log(`  Client ID: ${client.id}`);
    console.log(`  Client.userId: ${client.userId || 'NULL'}`);
    console.log(`  Client.instructorId: ${client.instructorId}`);
    console.log(`  Client.name: ${client.name}`);
    console.log(`  Client.email: ${client.email}`);
  } else {
    console.log(`  No client record found`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
