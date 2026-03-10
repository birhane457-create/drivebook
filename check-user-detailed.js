const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserDetailed() {
  const email = 'debesay3047@gmail.com';
  
  console.log(`\n🔍 Checking user: ${email}\n`);
  
  // 1. Find user
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      clients: {
        include: {
          bookings: {
            orderBy: { createdAt: 'desc' }
          },
          instructor: {
            select: { name: true }
          }
        }
      },
      wallet: {
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' }
          }
        }
      }
    }
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log('✅ USER FOUND');
  console.log(`   ID: ${user.id}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Email Verified: ${user.emailVerified}`);
  console.log(`   Created: ${user.createdAt}`);

  // 2. Check clients
  console.log(`\n📋 CLIENTS (${user.clients.length})`);
  user.clients.forEach((client, idx) => {
    console.log(`\n   Client ${idx + 1}:`);
    console.log(`   - ID: ${client.id}`);
    console.log(`   - Name: ${client.name}`);
    console.log(`   - Instructor: ${client.instructor?.name || 'N/A'}`);
    console.log(`   - Bookings: ${client.bookings.length}`);
  });

  // 3. Check all bookings
  const allBookings = user.clients.flatMap(c => c.bookings);
  console.log(`\n📅 ALL BOOKINGS (${allBookings.length})`);
  allBookings.forEach((booking, idx) => {
    console.log(`\n   Booking ${idx + 1}:`);
    console.log(`   - ID: ${booking.id}`);
    console.log(`   - Client ID: ${booking.clientId || '❌ NULL'}`);
    console.log(`   - Status: ${booking.status}`);
    console.log(`   - Type: ${booking.bookingType}`);
    console.log(`   - Guest Checkout: ${booking.isGuestCheckout}`);
    console.log(`   - Date: ${booking.date}`);
    console.log(`   - Start: ${booking.startTime}`);
    console.log(`   - End: ${booking.endTime}`);
    console.log(`   - Amount: $${booking.amount}`);
    console.log(`   - Created: ${booking.createdAt}`);
  });

  // 4. Check wallet
  console.log(`\n💰 WALLET`);
  if (user.wallet) {
    console.log(`   - Wallet ID: ${user.wallet.id}`);
    console.log(`   - User ID: ${user.wallet.userId}`);
    console.log(`   - Transactions: ${user.wallet.transactions.length}`);
    
    // Calculate balance from transactions
    let totalPaid = 0;
    let totalSpent = 0;
    
    user.wallet.transactions.forEach(tx => {
      if (tx.status === 'CONFIRMED') {
        if (tx.type === 'CREDIT' || tx.type === 'ADMIN_CREDIT') {
          totalPaid += tx.amount;
        } else if (tx.type === 'DEBIT' || tx.type === 'BOOKING_CHARGE') {
          totalSpent += tx.amount;
        }
      }
    });
    
    const balance = totalPaid - totalSpent;
    
    console.log(`\n   💵 CALCULATED BALANCE:`);
    console.log(`   - Total Paid: $${totalPaid.toFixed(2)}`);
    console.log(`   - Total Spent: $${totalSpent.toFixed(2)}`);
    console.log(`   - Balance: $${balance.toFixed(2)}`);
    
    console.log(`\n   📊 TRANSACTIONS (${user.wallet.transactions.length})`);
    user.wallet.transactions.forEach((tx, idx) => {
      console.log(`\n   Transaction ${idx + 1}:`);
      console.log(`   - ID: ${tx.id}`);
      console.log(`   - Type: ${tx.type}`);
      console.log(`   - Amount: $${tx.amount}`);
      console.log(`   - Status: ${tx.status}`);
      console.log(`   - Booking ID: ${tx.bookingId || 'N/A'}`);
      console.log(`   - Description: ${tx.description || 'N/A'}`);
      console.log(`   - Created: ${tx.createdAt}`);
    });
  } else {
    console.log('   ❌ No wallet found');
  }

  // 5. Check for orphaned bookings (bookings with this email but no clientId)
  const orphanedBookings = await prisma.booking.findMany({
    where: {
      clientEmail: email,
      clientId: null
    }
  });

  console.log(`\n🔍 ORPHANED BOOKINGS (clientId=null): ${orphanedBookings.length}`);
  if (orphanedBookings.length > 0) {
    orphanedBookings.forEach((booking, idx) => {
      console.log(`\n   Orphaned Booking ${idx + 1}:`);
      console.log(`   - ID: ${booking.id}`);
      console.log(`   - Status: ${booking.status}`);
      console.log(`   - Amount: $${booking.amount}`);
      console.log(`   - Created: ${booking.createdAt}`);
    });
  }

  console.log('\n✅ Check complete\n');
}

checkUserDetailed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
