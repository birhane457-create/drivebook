const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncStripePayments() {
  try {
    console.log('Syncing Stripe payments for admin@church.org...\n');

    // These are the payment intents from Stripe that succeeded
    const succeededPayments = [
      { pi: 'pi_3T3BeoPFqwsHwRMq06QTJhE7', amount: 888.89, date: '2026-02-21T16:35' },
      { pi: 'pi_3T3BnpPFqwsHwRMq2i0NgDNG', amount: 888.89, date: '2026-02-21T16:44' },
      { pi: 'pi_3T3CGgPFqwsHwRMq0ogOa3Ho', amount: 606.06, date: '2026-02-21T17:14' },
      { pi: 'pi_3T3CXLPFqwsHwRMq25dugmBr', amount: 606.06, date: '2026-02-21T17:31' }
    ];

    console.log(`Processing ${succeededPayments.length} successful payments...\n`);

    for (const payment of succeededPayments) {
      console.log(`\nProcessing payment: ${payment.pi}`);
      console.log(`Amount: $${payment.amount}`);

      // Find booking with this payment intent
      const booking = await prisma.booking.findFirst({
        where: {
          paymentIntentId: payment.pi
        },
        include: {
          instructor: {
            select: {
              name: true
            }
          },
          client: true
        }
      });

      if (!booking) {
        console.log(`❌ No booking found for payment intent ${payment.pi}`);
        continue;
      }

      console.log(`✅ Found booking: ${booking.id}`);
      console.log(`   Current status: ${booking.status}`);
      console.log(`   Current isPaid: ${booking.isPaid}`);

      if (booking.isPaid && booking.status === 'CONFIRMED') {
        console.log(`   ✓ Already synced, skipping`);
        continue;
      }

      // Update booking to CONFIRMED and isPaid
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          isPaid: true,
          paidAt: new Date(payment.date),
          status: 'CONFIRMED',
          paymentCaptured: true,
          paymentCapturedAt: new Date(payment.date)
        }
      });

      console.log(`   ✅ Updated booking to CONFIRMED and isPaid=true`);

      // Update transaction to COMPLETED
      const transaction = await prisma.transaction.findFirst({
        where: {
          bookingId: booking.id
        }
      });

      if (transaction) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(payment.date),
            stripePaymentIntentId: payment.pi
          }
        });
        console.log(`   ✅ Updated transaction to COMPLETED`);
      }

      // Update wallet
      const user = await prisma.user.findUnique({
        where: { email: 'admin@church.org' },
        include: { wallet: true }
      });

      if (user && user.wallet) {
        await prisma.clientWallet.update({
          where: { id: user.wallet.id },
          data: {
            totalSpent: { increment: booking.price },
            creditsRemaining: { decrement: booking.price }
          }
        });
        console.log(`   ✅ Updated wallet (spent: +$${booking.price})`);
      }
    }

    console.log('\n\n📊 Final Summary:');
    
    const user = await prisma.user.findUnique({
      where: { email: 'admin@church.org' },
      include: {
        wallet: true,
        clients: true
      }
    });

    const clientIds = user.clients.map(c => c.id);

    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { userId: user.id },
          { clientId: { in: clientIds } }
        ]
      }
    });

    const confirmedBookings = bookings.filter(b => b.status === 'CONFIRMED');
    const paidBookings = bookings.filter(b => b.isPaid);

    console.log(`\nBookings:`);
    console.log(`   Total: ${bookings.length}`);
    console.log(`   CONFIRMED: ${confirmedBookings.length}`);
    console.log(`   Paid: ${paidBookings.length}`);

    if (user.wallet) {
      console.log(`\nWallet:`);
      console.log(`   Total Paid: $${user.wallet.totalPaid.toFixed(2)}`);
      console.log(`   Total Spent: $${user.wallet.totalSpent.toFixed(2)}`);
      console.log(`   Credits Remaining: $${user.wallet.creditsRemaining.toFixed(2)}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncStripePayments();
