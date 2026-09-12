const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing Admin Wallet API Data\n');
  
  // Get all clients
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      userId: true,
      user: {
        select: {
          wallet: {
            select: {
              balance: true,
              transactions: {
                select: { amount: true, type: true }
              }
            }
          },
          bookings: {
            select: { id: true, status: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Found ${clients.length} clients\n`);
  
  for (const client of clients) {
    const wallet = client.user?.wallet;
    const transactions = wallet?.transactions || [];
    const bookings = client.user?.bookings || [];
    
    const totalPaid = transactions
      .filter(t => t.type === 'CREDIT')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalSpent = transactions
      .filter(t => t.type === 'DEBIT')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = wallet?.balance || 0;
    
    console.log(`Client: ${client.name} (${client.email})`);
    console.log(`  Client ID: ${client.id}`);
    console.log(`  User ID: ${client.userId || 'NULL'}`);
    console.log(`  Total Paid: $${totalPaid.toFixed(2)}`);
    console.log(`  Total Spent: $${totalSpent.toFixed(2)}`);
    console.log(`  Balance: $${balance.toFixed(2)}`);
    console.log(`  Bookings: ${bookings.length}`);
    console.log('');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
