const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWalletStatus() {
  const email = 'debesay3047@gmail.com';
  
  console.log(`\n🔍 Simulating /api/client/wallet/summary for: ${email}\n`);
  
  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      wallet: {
        include: {
          transactions: {
            where: { status: 'CONFIRMED' },
            orderBy: { createdAt: 'desc' }
          }
        }
      },
      clients: {
        include: {
          bookings: true
        }
      }
    }
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  // Calculate wallet balance from transactions
  let totalPaid = 0;
  let totalSpent = 0;
  let creditsRemaining = 0;

  if (user.wallet) {
    user.wallet.transactions.forEach(tx => {
      if (tx.type === 'CREDIT' || tx.type === 'ADMIN_CREDIT') {
        totalPaid += tx.amount;
      } else if (tx.type === 'DEBIT' || tx.type === 'BOOKING_CHARGE') {
        totalSpent += tx.amount;
      }
    });
    creditsRemaining = totalPaid - totalSpent;
  }

  console.log('💰 WALLET SUMMARY:');
  console.log(`   - Total Paid: $${totalPaid.toFixed(2)}`);
  console.log(`   - Total Spent: $${totalSpent.toFixed(2)}`);
  console.log(`   - Credits Remaining: $${creditsRemaining.toFixed(2)}`);

  // Get all bookings across all clients
  const allClientIds = user.clients.map(c => c.id);
  
  const bookings = await prisma.booking.findMany({
    where: {
      OR: [
        { clientId: { in: allClientIds } },
        { clientEmail: email }
      ]
    },
    include: {
      instructor: {
        select: { name: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Deduplicate bookings
  const uniqueBookings = Array.from(
    new Map(bookings.map(b => [b.id, b])).values()
  );

  console.log(`\n📅 BOOKINGS: ${uniqueBookings.length} total`);
  
  const statusCounts = {
    CONFIRMED: 0,
    PENDING_PAYMENT: 0,
    CANCELLED: 0,
    COMPLETED: 0
  };

  uniqueBookings.forEach(booking => {
    statusCounts[booking.status] = (statusCounts[booking.status] || 0) + 1;
  });

  console.log(`   - CONFIRMED: ${statusCounts.CONFIRMED}`);
  console.log(`   - PENDING_PAYMENT: ${statusCounts.PENDING_PAYMENT}`);
  console.log(`   - CANCELLED: ${statusCounts.CANCELLED}`);
  console.log(`   - COMPLETED: ${statusCounts.COMPLETED}`);

  console.log('\n📋 BOOKING DETAILS:');
  uniqueBookings.forEach((booking, idx) => {
    console.log(`\n   ${idx + 1}. ${booking.status} - $${booking.amount}`);
    console.log(`      Date: ${booking.date}`);
    console.log(`      Time: ${booking.startTime} - ${booking.endTime}`);
    console.log(`      Instructor: ${booking.instructor?.name || 'N/A'}`);
    console.log(`      Client ID: ${booking.clientId || '❌ NULL'}`);
    console.log(`      Guest Checkout: ${booking.isGuestCheckout}`);
  });

  console.log('\n✅ Wallet status check complete\n');
}

checkWalletStatus()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
