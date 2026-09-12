const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function linkChairmanBookings() {
  console.log('🔗 Linking chairman@erotc.org Bookings to User Account\n');

  try {
    const user = await prisma.user.findUnique({
      where: { email: 'chairman@erotc.org' }
    });

    if (!user) {
      console.log('❌ User not found\n');
      return;
    }

    console.log(`👤 User: ${user.email} (${user.id})\n`);

    // Find all bookings for this user's client records
    const bookings = await prisma.booking.findMany({
      where: {
        clientId: { in: ['69987b174adba4fc848be379', '699eff972868f9a184260731'] }
      },
      include: {
        client: true,
        instructor: {
          include: {
            user: true
          }
        }
      }
    });

    console.log(`📅 Found ${bookings.length} booking(s)\n`);

    for (const booking of bookings) {
      console.log(`📋 Booking: ${booking.id}`);
      console.log(`   Client: ${booking.client?.name}`);
      console.log(`   Instructor: ${booking.instructor?.name}`);
      console.log(`   Status: ${booking.status}`);
      console.log(`   Price: $${booking.price}`);
      console.log(`   Current User ID: ${booking.userId || 'null'}`);

      if (!booking.userId) {
        console.log(`   🔄 Linking to user ${user.id}...`);
        await prisma.booking.update({
          where: { id: booking.id },
          data: { userId: user.id }
        });
        console.log(`   ✅ Linked!\n`);
      } else {
        console.log(`   ✅ Already linked\n`);
      }
    }

    // Verify
    const userBookings = await prisma.booking.findMany({
      where: { userId: user.id },
      include: {
        instructor: {
          include: {
            user: true
          }
        }
      }
    });

    console.log('═'.repeat(60));
    console.log('\n📊 FINAL STATE:\n');
    console.log(`👤 User: ${user.email}`);
    console.log(`📅 Bookings linked to user: ${userBookings.length}\n`);

    for (const booking of userBookings) {
      console.log(`   ${booking.status.padEnd(10)} | $${booking.price.toString().padEnd(8)} | ${booking.startTime.toLocaleDateString()} | ${booking.instructor?.name}`);
    }

    // Check wallet
    const wallet = await prisma.clientWallet.findFirst({
      where: { userId: user.id }
    });

    if (wallet) {
      console.log(`\n💰 Wallet:`);
      console.log(`   Credits Remaining: $${wallet.creditsRemaining.toFixed(2)}`);
      console.log(`   Total Added: $${wallet.totalPaid.toFixed(2)}`);
      console.log(`   Total Spent: $${wallet.totalSpent.toFixed(2)}`);
    }

    console.log('\n✅ All bookings linked successfully!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

linkChairmanBookings();
