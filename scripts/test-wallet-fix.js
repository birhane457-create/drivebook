const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testWalletFix() {
  try {
    console.log('Testing wallet fix for admin@church.org...\n');

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: 'admin@church.org' },
      include: {
        clients: true,
        wallet: true
      }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:', user.id);
    console.log('📋 Client records:', user.clients.length);
    user.clients.forEach((client, i) => {
      console.log(`   ${i + 1}. Client ID: ${client.id}, Instructor: ${client.instructorId}`);
    });

    const clientIds = user.clients.map(c => c.id);

    // Query bookings by userId only (old way)
    const bookingsByUserId = await prisma.booking.findMany({
      where: {
        userId: user.id,
        isPaid: true
      }
    });

    console.log('\n📊 Bookings by userId only (OLD WAY):', bookingsByUserId.length);

    // Query bookings by both userId and clientId (new way)
    const bookingsByBoth = await prisma.booking.findMany({
      where: {
        OR: [
          { userId: user.id },
          { clientId: { in: clientIds } }
        ]
      },
      include: {
        instructor: {
          select: {
            name: true
          }
        }
      }
    });

    console.log('📊 Bookings by userId OR clientId (NEW WAY - ALL):', bookingsByBoth.length);

    // Now filter by isPaid
    const paidBookings = bookingsByBoth.filter(b => b.isPaid);
    console.log('📊 Paid bookings:', paidBookings.length);

    if (bookingsByBoth.length > 0) {
      console.log('\n📝 Booking details:');
      let totalSpent = 0;
      let totalHours = 0;

      bookingsByBoth.forEach((booking, i) => {
        const hours = booking.duration || 
          (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / (1000 * 60 * 60);
        
        totalSpent += booking.price;
        totalHours += hours;

        console.log(`   ${i + 1}. ${booking.instructor.name} - $${booking.price} - ${hours}h - ${booking.status}`);
        console.log(`      Date: ${booking.startTime.toISOString()}`);
        console.log(`      ClientId: ${booking.clientId}`);
        console.log(`      UserId: ${booking.userId || 'null'}`);
      });

      console.log('\n💰 Totals:');
      console.log(`   Total Spent: $${totalSpent.toFixed(2)}`);
      console.log(`   Total Hours: ${totalHours.toFixed(1)}h`);
    }

    // Check wallet
    if (user.wallet) {
      console.log('\n💳 Wallet:');
      console.log(`   Total Paid: $${user.wallet.totalPaid.toFixed(2)}`);
      console.log(`   Total Spent (stored): $${user.wallet.totalSpent.toFixed(2)}`);
      console.log(`   Credits Remaining (stored): $${user.wallet.creditsRemaining.toFixed(2)}`);
      
      const actualSpent = bookingsByBoth.reduce((sum, b) => sum + b.price, 0);
      const actualRemaining = user.wallet.totalPaid - actualSpent;
      
      console.log(`\n   Actual Spent (calculated): $${actualSpent.toFixed(2)}`);
      console.log(`   Actual Remaining (calculated): $${actualRemaining.toFixed(2)}`);
      
      if (Math.abs(user.wallet.totalSpent - actualSpent) > 0.01) {
        console.log('\n⚠️  MISMATCH DETECTED! Wallet needs to be updated.');
      } else {
        console.log('\n✅ Wallet is accurate!');
      }
    } else {
      console.log('\n❌ No wallet found for user');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testWalletFix();
