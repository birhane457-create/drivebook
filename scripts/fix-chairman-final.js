const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixChairmanFinal() {
  console.log('🔧 Final Fix for chairman@erotc.org\n');

  try {
    const userId = '69987b114adba4fc848be378';

    // Link remaining booking to user
    const updated = await prisma.booking.updateMany({
      where: {
        client: {
          email: 'chairman@erotc.org'
        },
        userId: null
      },
      data: {
        userId: userId
      }
    });

    console.log(`✅ Linked ${updated.count} booking(s) to user account\n`);

    // Verify final state
    const user = await prisma.user.findUnique({
      where: { email: 'chairman@erotc.org' },
      include: {
        bookings: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    const wallet = await prisma.clientWallet.findFirst({
      where: { userId: userId }
    });

    console.log('📊 Final State:\n');
    console.log(`User: ${user.email}`);
    console.log(`Bookings visible to user: ${user.bookings.length}`);
    console.log(`Wallet credits: $${wallet.creditsRemaining}`);
    console.log(`Wallet total added: $${wallet.totalPaid}`);
    console.log(`Wallet total spent: $${wallet.totalSpent}\n`);

    if (user.bookings.length > 0) {
      console.log('Bookings:');
      for (const booking of user.bookings) {
        console.log(`  - ${booking.id}: $${booking.price}, ${booking.status}`);
      }
    }

    console.log('\n✅ Fix complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixChairmanFinal();
