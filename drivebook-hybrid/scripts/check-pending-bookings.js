const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPendingBookings() {
  console.log('🔍 Checking Pending Bookings\n');

  try {
    const user = await prisma.user.findUnique({
      where: { email: 'birhane457@gmail.com' },
      include: { instructor: true }
    });

    if (!user || !user.instructor) {
      console.log('❌ User not found');
      return;
    }

    console.log(`Instructor: ${user.email}\n`);

    // Get all bookings by status
    const bookingsByStatus = await prisma.booking.groupBy({
      by: ['status'],
      where: {
        instructorId: user.instructor.id
      },
      _count: true
    });

    console.log('📊 Bookings by Status:\n');
    bookingsByStatus.forEach(group => {
      console.log(`   ${group.status}: ${group._count}`);
    });

    // Get pending bookings details
    const pendingBookings = await prisma.booking.findMany({
      where: {
        instructorId: user.instructor.id,
        status: 'PENDING'
      },
      include: {
        client: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log(`\n📋 Pending Bookings (showing first 10):\n`);

    for (const booking of pendingBookings) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`ID: ${booking.id}`);
      console.log(`Client: ${booking.client.name}`);
      console.log(`Created: ${booking.createdAt}`);
      console.log(`Start Time: ${booking.startTime}`);
      console.log(`Price: $${booking.price}`);
      console.log(`Payment Intent: ${booking.paymentIntentId || 'NONE'}`);
      console.log(`Payment Status: ${booking.paymentStatus || 'NONE'}`);
      console.log(`Is Package Booking: ${booking.isPackageBooking}`);
      console.log(`Parent Booking: ${booking.parentBookingId || 'NONE'}`);

      // Check transaction
      const transaction = await prisma.transaction.findFirst({
        where: { bookingId: booking.id }
      });

      if (transaction) {
        console.log(`Transaction: ${transaction.status} - $${transaction.amount}`);
      } else {
        console.log(`Transaction: NONE`);
      }

      // If has payment intent, check Stripe
      if (booking.paymentIntentId && process.env.STRIPE_SECRET_KEY) {
        try {
          const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
          const paymentIntent = await stripe.paymentIntents.retrieve(booking.paymentIntentId);
          console.log(`Stripe Status: ${paymentIntent.status}`);
          
          if (paymentIntent.status === 'succeeded') {
            console.log(`⚠️  ISSUE: Payment succeeded but booking is PENDING!`);
          }
        } catch (err) {
          console.log(`Stripe Check Failed: ${err.message}`);
        }
      }
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Analysis
    console.log('📊 ANALYSIS:\n');

    const withPayment = pendingBookings.filter(b => b.paymentIntentId);
    const withoutPayment = pendingBookings.filter(b => !b.paymentIntentId);
    const fromPackages = pendingBookings.filter(b => b.parentBookingId);
    const standalone = pendingBookings.filter(b => !b.parentBookingId && !b.isPackageBooking);

    console.log(`Total Pending: ${pendingBookings.length}`);
    console.log(`With Payment Intent: ${withPayment.length}`);
    console.log(`Without Payment Intent: ${withoutPayment.length}`);
    console.log(`From Packages: ${fromPackages.length}`);
    console.log(`Standalone: ${standalone.length}\n`);

    if (fromPackages.length > 0) {
      console.log('ℹ️  Package Bookings:');
      console.log('   - These are scheduled lessons from purchased packages');
      console.log('   - They stay PENDING until the lesson time');
      console.log('   - They become CONFIRMED when client confirms attendance');
      console.log('   - This is NORMAL behavior\n');
    }

    if (withPayment.length > 0 && standalone.length > 0) {
      console.log('⚠️  Standalone Bookings with Payment:');
      console.log('   - These should have been CONFIRMED after payment');
      console.log('   - Likely webhook sync issue from before improvements');
      console.log('   - Check Stripe to verify payment status\n');
    }

    if (withoutPayment.length > 0 && standalone.length > 0) {
      console.log('ℹ️  Standalone Bookings without Payment:');
      console.log('   - User started booking but never paid');
      console.log('   - These are abandoned checkouts');
      console.log('   - Can be cleaned up after 24 hours\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPendingBookings();
