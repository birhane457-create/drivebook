const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserBookings() {
  try {
    const email = 'admin@church.org';
    
    console.log(`\nChecking bookings for: ${email}\n`);
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        clients: true,
        bookings: {
          include: {
            instructor: {
              select: {
                name: true,
                hourlyRate: true
              }
            }
          },
          orderBy: { startTime: 'desc' }
        },
        wallet: true
      }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Created: ${user.createdAt}`);
    
    console.log(`\n📋 Client Records: ${user.clients.length}`);
    user.clients.forEach((client, i) => {
      console.log(`   ${i + 1}. Name: ${client.name}`);
      console.log(`      Phone: ${client.phone}`);
      console.log(`      Email: ${client.email}`);
    });

    console.log(`\n💰 Wallet:`);
    if (user.wallet) {
      console.log(`   Total Paid: $${user.wallet.totalPaid}`);
      console.log(`   Total Spent: $${user.wallet.totalSpent}`);
      console.log(`   Credits Remaining: $${user.wallet.creditsRemaining}`);
    } else {
      console.log('   No wallet found');
    }

    console.log(`\n📅 Bookings: ${user.bookings.length}`);
    if (user.bookings.length > 0) {
      user.bookings.forEach((booking, i) => {
        console.log(`\n   ${i + 1}. Booking ID: ${booking.id}`);
        console.log(`      Instructor: ${booking.instructor.name}`);
        console.log(`      Date: ${booking.startTime.toLocaleDateString()}`);
        console.log(`      Time: ${booking.startTime.toLocaleTimeString()} - ${booking.endTime.toLocaleTimeString()}`);
        console.log(`      Price: $${booking.price}`);
        console.log(`      Status: ${booking.status}`);
        console.log(`      Payment Status: ${booking.paymentStatus}`);
      });
    } else {
      console.log('   No bookings found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserBookings();
