const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPaidBookings() {
  try {
    console.log('Fixing bookings with completed transactions...\n');

    // Find all completed transactions
    const completedTransactions = await prisma.transaction.findMany({
      where: {
        status: 'COMPLETED',
        stripePaymentIntentId: { not: null }
      },
      include: {
        booking: true
      }
    });

    console.log(`Found ${completedTransactions.length} completed transactions\n`);

    let fixed = 0;
    let alreadyPaid = 0;

    for (const transaction of completedTransactions) {
      if (!transaction.booking.isPaid) {
        console.log(`Fixing booking ${transaction.bookingId}...`);
        console.log(`  Amount: $${transaction.amount}`);
        console.log(`  Payment Intent: ${transaction.stripePaymentIntentId}`);
        
        await prisma.booking.update({
          where: { id: transaction.bookingId },
          data: {
            isPaid: true,
            paidAt: transaction.processedAt || transaction.createdAt,
            status: 'CONFIRMED',
            paymentCaptured: true,
            paymentCapturedAt: transaction.processedAt || transaction.createdAt,
            paymentIntentId: transaction.stripePaymentIntentId
          }
        });
        
        console.log(`  ✅ Fixed!\n`);
        fixed++;
      } else {
        alreadyPaid++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Fixed: ${fixed} bookings`);
    console.log(`   Already paid: ${alreadyPaid} bookings`);
    console.log(`   Total: ${completedTransactions.length} bookings`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPaidBookings();
