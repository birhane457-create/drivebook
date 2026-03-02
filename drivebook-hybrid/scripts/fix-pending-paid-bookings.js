const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPendingPaidBookings() {
  console.log('🔧 Fixing Pending Bookings with Successful Payments\n');

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.log('❌ STRIPE_SECRET_KEY not found in environment');
      return;
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    // Get all pending bookings with payment intents
    const pendingBookings = await prisma.booking.findMany({
      where: {
        status: 'PENDING',
        paymentIntentId: { not: null }
      },
      include: {
        client: {
          select: {
            name: true,
            email: true
          }
        },
        instructor: {
          select: {
            user: {
              select: {
                email: true
              }
            }
          }
        }
      }
    });

    console.log(`Found ${pendingBookings.length} pending bookings with payment intents\n`);

    let fixed = 0;
    let alreadyFailed = 0;
    let errors = 0;

    for (const booking of pendingBookings) {
      console.log(`\nChecking booking ${booking.id}...`);
      console.log(`  Client: ${booking.client.name}`);
      console.log(`  Amount: $${booking.price}`);
      console.log(`  Payment Intent: ${booking.paymentIntentId}`);

      try {
        // Check Stripe payment status
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.paymentIntentId);
        console.log(`  Stripe Status: ${paymentIntent.status}`);

        if (paymentIntent.status === 'succeeded') {
          console.log(`  ✅ Payment succeeded - updating booking...`);

          // Update booking status
          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              status: 'CONFIRMED',
              isPaid: true,
              paidAt: new Date(),
              paymentCaptured: true,
              paymentCapturedAt: new Date()
            }
          });

          // Update transaction if exists
          const transaction = await prisma.transaction.findFirst({
            where: { bookingId: booking.id }
          });

          if (transaction && transaction.status === 'PENDING') {
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: 'COMPLETED' }
            });
            console.log(`  ✅ Transaction updated to COMPLETED`);
          }

          // Check/create ledger entry
          const ledgerEntry = await prisma.financialLedger.findFirst({
            where: { bookingId: booking.id }
          });

          if (!ledgerEntry) {
            await prisma.financialLedger.create({
              data: {
                type: 'BOOKING_PAYMENT',
                amount: booking.price,
                platformFee: booking.platformFee || 0,
                instructorPayout: booking.instructorPayout || 0,
                bookingId: booking.id,
                clientId: booking.clientId,
                instructorId: booking.instructorId,
                status: 'COMPLETED',
                description: `Booking payment - ${booking.client.name}`,
                metadata: {
                  paymentIntentId: booking.paymentIntentId,
                  fixedFromPending: true,
                  fixedAt: new Date().toISOString()
                }
              }
            });
            console.log(`  ✅ Ledger entry created`);
          }

          fixed++;
          console.log(`  ✅ FIXED`);

        } else if (paymentIntent.status === 'requires_payment_method' || 
                   paymentIntent.status === 'canceled') {
          console.log(`  ℹ️  Payment failed/canceled - leaving as PENDING`);
          alreadyFailed++;
        } else {
          console.log(`  ⚠️  Unexpected status: ${paymentIntent.status}`);
        }

      } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
        errors++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📊 SUMMARY:\n');
    console.log(`Total Checked: ${pendingBookings.length}`);
    console.log(`Fixed: ${fixed}`);
    console.log(`Failed Payments (left as PENDING): ${alreadyFailed}`);
    console.log(`Errors: ${errors}\n`);

    if (fixed > 0) {
      console.log('✅ Successfully fixed pending bookings with successful payments!');
      console.log('   These bookings are now CONFIRMED and will show in earnings.\n');
    }

    if (alreadyFailed > 0) {
      console.log(`ℹ️  ${alreadyFailed} bookings have failed/canceled payments.`);
      console.log('   These can be cleaned up or left as abandoned checkouts.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPendingPaidBookings();
