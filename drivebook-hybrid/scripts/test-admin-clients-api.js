const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAdminClientsAPI() {
  try {
    console.log('🧪 TESTING ADMIN CLIENTS API CALCULATION\n');
    
    // Simulate the API logic
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        userId: true,
        user: {
          select: {
            wallet: {
              select: {
                balance: true,
                transactions: {
                  select: { amount: true, type: true, description: true }
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

    // Find the test client
    const testClient = clients.find(c => c.email === 'admin@church.org');
    
    if (!testClient) {
      console.log('❌ Test client not found');
      return;
    }

    const wallet = testClient.user?.wallet;
    const transactions = wallet?.transactions || [];
    const bookings = testClient.user?.bookings || [];
    
    console.log(`📧 Client: ${testClient.email}`);
    console.log(`📋 Transactions: ${transactions.length}`);
    console.log(`📅 Bookings: ${bookings.length}\n`);
    
    // Calculate totalPaid (only actual money paid by user)
    const totalPaid = transactions
      .filter(t => 
        t.type === 'CREDIT' && 
        !t.description?.toLowerCase().includes('duration reduction') &&
        !t.description?.toLowerCase().includes('manual credit') &&
        !t.description?.toLowerCase().includes('refund') &&
        !t.description?.toLowerCase().includes('admin')
      )
      .reduce((sum, t) => sum + t.amount, 0);
    
    console.log('💰 Total Paid Calculation:');
    console.log('  Filtering CREDIT transactions...');
    console.log('  Excluding: duration reduction, manual credit, refund, admin');
    console.log(`  Result: $${totalPaid}\n`);
    
    // Calculate booking charges
    const bookingCharges = transactions
      .filter(t => 
        t.type === 'DEBIT' && 
        !t.description?.toLowerCase().includes('duration increase')
      )
      .reduce((sum, t) => sum + t.amount, 0);
    
    console.log('📊 Booking Charges:');
    console.log('  Filtering DEBIT transactions...');
    console.log('  Excluding: duration increase');
    console.log(`  Result: $${bookingCharges}\n`);
    
    // Calculate cancellation refunds
    const cancellationRefunds = transactions
      .filter(t => 
        t.type === 'CREDIT' && 
        (t.description?.toLowerCase().includes('refund') || 
         t.description?.toLowerCase().includes('cancel'))
      )
      .reduce((sum, t) => sum + t.amount, 0);
    
    console.log('🔄 Cancellation Refunds:');
    console.log('  Filtering CREDIT transactions...');
    console.log('  Including: refund, cancel');
    console.log(`  Result: $${cancellationRefunds}\n`);
    
    // Calculate net spent
    const totalSpent = bookingCharges - cancellationRefunds;
    
    console.log('📈 Net Booking Costs:');
    console.log(`  ${bookingCharges} (charges) - ${cancellationRefunds} (refunds) = $${totalSpent}\n`);
    
    const balance = wallet?.balance || 0;
    
    console.log('✅ FINAL API RESPONSE VALUES:');
    console.log(`  totalPaid: $${totalPaid}`);
    console.log(`  totalSpent: $${totalSpent}`);
    console.log(`  creditsRemaining: $${balance}`);
    console.log(`  bookingCount: ${bookings.length}\n`);
    
    console.log('🎯 EXPECTED VALUES:');
    console.log('  totalPaid: $500');
    console.log('  totalSpent: $105');
    console.log('  creditsRemaining: $395');
    console.log('  bookingCount: 2\n');
    
    const allMatch = 
      totalPaid === 500 &&
      totalSpent === 105 &&
      balance === 395 &&
      bookings.length === 2;
    
    console.log(allMatch ? '✅ ALL VALUES CORRECT!' : '❌ VALUES DO NOT MATCH!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAdminClientsAPI();
