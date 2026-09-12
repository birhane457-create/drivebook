const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkChairmanBooking() {
  console.log('🔍 Checking chairman@erotc.org Booking & Wallet\n');

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: 'chairman@erotc.org' },
      include: {
        bookings: {
          include: {
            instructor: {
              include: {
                user: true
              }
            },
            client: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      console.log('❌ User not found: chairman@erotc.org\n');
      return;
    }

    console.log('👤 User Found:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Created: ${user.createdAt.toLocaleString()}\n`);

    // Check bookings
    console.log(`📅 Bookings: ${user.bookings.length}\n`);

    if (user.bookings.length > 0) {
      for (const booking of user.bookings) {
        console.log(`\n📋 Booking: ${booking.id}`);
        console.log(`   Instructor: ${booking.instructor?.name || 'N/A'}`);
        console.log(`   Instructor Email: ${booking.instructor?.user?.email || 'N/A'}`);
        console.log(`   Status: ${booking.status}`);
        console.log(`   Price: $${booking.price}`);
        console.log(`   Start: ${booking.startTime.toLocaleString()}`);
        console.log(`   End: ${booking.endTime.toLocaleString()}`);
        console.log(`   Duration: ${((booking.endTime - booking.startTime) / (1000 * 60 * 60)).toFixed(2)} hours`);
        console.log(`   Is Package: ${booking.isPackageBooking}`);
        console.log(`   Package Hours: ${booking.packageHours || 'N/A'}`);
        console.log(`   Package Status: ${booking.packageStatus || 'N/A'}`);
        console.log(`   Parent Booking: ${booking.parentBookingId || 'None'}`);
        console.log(`   Pickup: ${booking.pickupAddress || 'N/A'}`);
        console.log(`   Created: ${booking.createdAt.toLocaleString()}`);
        console.log(`   Payment Intent: ${booking.paymentIntentId || 'None'}`);
        console.log(`   Paid At: ${booking.paidAt ? booking.paidAt.toLocaleString() : 'Not paid'}`);
      }
    } else {
      console.log('   No bookings found');
    }

    // Check wallet
    console.log('\n\n💰 Wallet Information:\n');
    const wallet = await prisma.clientWallet.findFirst({
      where: { userId: user.id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (wallet) {
      console.log(`   Wallet ID: ${wallet.id}`);
      console.log(`   Balance: $${wallet.balance}`);
      console.log(`   Credits Remaining: $${wallet.creditsRemaining}`);
      console.log(`   Total Added: $${wallet.totalPaid}`);
      console.log(`   Total Spent: $${wallet.totalSpent}`);
      console.log(`   Created: ${wallet.createdAt.toLocaleString()}`);
      console.log(`   Updated: ${wallet.updatedAt.toLocaleString()}\n`);

      if (wallet.transactions.length > 0) {
        console.log(`   Recent Transactions (${wallet.transactions.length}):\n`);
        for (const tx of wallet.transactions) {
          console.log(`   ${tx.type.padEnd(15)} | $${tx.amount.toString().padEnd(10)} | ${tx.description}`);
          console.log(`      Status: ${tx.status} | ${tx.createdAt.toLocaleString()}`);
          if (tx.bookingId) {
            console.log(`      Booking: ${tx.bookingId}`);
          }
          console.log('');
        }
      } else {
        console.log('   No transactions found');
      }
    } else {
      console.log('   ❌ No wallet found for this user');
    }

    // Check client records
    console.log('\n\n👥 Client Records:\n');
    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { userId: user.id },
          { email: user.email }
        ]
      },
      include: {
        instructor: {
          include: {
            user: true
          }
        }
      }
    });

    if (clients.length > 0) {
      for (const client of clients) {
        console.log(`   Client ID: ${client.id}`);
        console.log(`   Name: ${client.name}`);
        console.log(`   Email: ${client.email}`);
        console.log(`   Phone: ${client.phone}`);
        console.log(`   Instructor: ${client.instructor?.name || 'N/A'}`);
        console.log(`   Instructor Email: ${client.instructor?.user?.email || 'N/A'}`);
        console.log(`   Created: ${client.createdAt.toLocaleString()}\n`);
      }
    } else {
      console.log('   No client records found');
    }

    // Check transactions
    console.log('\n\n💳 Transaction Records:\n');
    const transactions = await prisma.transaction.findMany({
      where: {
        booking: {
          userId: user.id
        }
      },
      include: {
        booking: true,
        instructor: {
          include: {
            user: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (transactions.length > 0) {
      for (const tx of transactions) {
        console.log(`   Transaction: ${tx.id}`);
        console.log(`   Type: ${tx.type}`);
        console.log(`   Amount: $${tx.amount}`);
        console.log(`   Platform Fee: $${tx.platformFee}`);
        console.log(`   Instructor Payout: $${tx.instructorPayout}`);
        console.log(`   Status: ${tx.status}`);
        console.log(`   Booking: ${tx.bookingId}`);
        console.log(`   Instructor: ${tx.instructor?.name || 'N/A'}`);
        console.log(`   Description: ${tx.description}`);
        console.log(`   Created: ${tx.createdAt.toLocaleString()}\n`);
      }
    } else {
      console.log('   No transaction records found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkChairmanBooking();
