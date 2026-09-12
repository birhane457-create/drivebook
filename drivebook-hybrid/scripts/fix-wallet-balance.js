const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixWalletBalance() {
  try {
    console.log('Fixing wallet balance for admin@church.org...\n');

    const user = await prisma.user.findUnique({
      where: { email: 'admin@church.org' },
      include: {
        wallet: true,
        clients: true
      }
    });

    if (!user || !user.wallet) {
      console.log('❌ User or wallet not found');
      return;
    }

    const clientIds = user.clients.map(c => c.id);

    // Get all paid bookings
    const paidBookings = await prisma.booking.findMany({
      where: {
        OR: [
          { userId: user.id },
          { clientId: { in: clientIds } }
        ],
        isPaid: true
      }
    });

    const totalSpent = paidBookings.reduce((sum, b) => sum + b.price, 0);

    console.log(`📊 Paid bookings: ${paidBookings.length}`);
    console.log(`💰 Total spent: $${totalSpent.toFixed(2)}`);

    // According to Stripe, admin@church.org paid:
    // - $100 for wallet credits
    // - $888.89 x 2 = $1,777.78 for bookings
    // - $606.06 x 2 = $1,212.12 for bookings
    // Total = $2,989.90

    const actualTotalPaid = 100 + 888.89 + 888.89 + 606.06 + 606.06;
    console.log(`\n💳 Actual total paid (from Stripe): $${actualTotalPaid.toFixed(2)}`);

    // Update wallet to reflect reality
    await prisma.clientWallet.update({
      where: { id: user.wallet.id },
      data: {
        totalPaid: actualTotalPaid,
        totalSpent: totalSpent,
        creditsRemaining: actualTotalPaid - totalSpent
      }
    });

    console.log('\n✅ Wallet updated!');

    // Verify
    const updatedWallet = await prisma.clientWallet.findUnique({
      where: { id: user.wallet.id }
    });

    console.log('\n📊 Updated Wallet:');
    console.log(`   Total Paid: $${updatedWallet.totalPaid.toFixed(2)}`);
    console.log(`   Total Spent: $${updatedWallet.totalSpent.toFixed(2)}`);
    console.log(`   Credits Remaining: $${updatedWallet.creditsRemaining.toFixed(2)}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixWalletBalance();
