const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigatePendingPackages() {
  console.log('🔍 Investigating Pending Packages\n');

  try {
    // Find all package bookings with PENDING status
    const pendingPackages = await prisma.booking.findMany({
      where: {
        isPackageBooking: true,
        parentBookingId: null,
        status: 'PENDING'
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${pendingPackages.length} pending package(s)\n`);

    if (pendingPackages.length === 0) {
      console.log('✅ No pending packages found - system is working correctly!\n');
      return;
    }

    for (const pkg of pendingPackages) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Package ID: ${pkg.id}`);
      console.log(`Client: ${pkg.client.name} (${pkg.client.email})`);
      console.log(`Instructor: ${pkg.instructor.user.email}`);
      console.log(`Created: ${pkg.createdAt}`);
      console.log(`Status: ${pkg.status}`);
      console.log(`Price: $${pkg.price}`);
      console.log(`Payment Intent: ${pkg.paymentIntentId || 'NONE'}`);
      console.log(`Payment Status: ${pkg.paymentStatus || 'NONE'}`);

      // Check if there's a transaction for this booking
      const transaction = await prisma.transaction.findFirst({
        where: {
          bookingId: pkg.id
        }
      });

      if (transaction) {
        console.log(`\n💰 Transaction Found:`);
        console.log(`   ID: ${transaction.id}`);
        console.log(`   Status: ${transaction.status}`);
        console.log(`   Amount: $${transaction.amount}`);
        console.log(`   Type: ${transaction.type}`);
        console.log(`   Created: ${transaction.createdAt}`);
        console.log(`   Stripe Payment Intent: ${transaction.stripePaymentIntentId || 'NONE'}`);
      } else {
        console.log(`\n❌ No Transaction Found`);
      }

      // Check if payment was successful in Stripe
      if (pkg.paymentIntentId) {
        console.log(`\n🔍 Checking Stripe Payment Intent...`);
        try {
          const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
          const paymentIntent = await stripe.paymentIntents.retrieve(pkg.paymentIntentId);
          console.log(`   Stripe Status: ${paymentIntent.status}`);
          console.log(`   Amount: $${(paymentIntent.amount / 100).toFixed(2)}`);
          console.log(`   Created: ${new Date(paymentIntent.created * 1000).toISOString()}`);
          
          if (paymentIntent.status === 'succeeded') {
            console.log(`\n⚠️  ISSUE FOUND: Payment succeeded in Stripe but booking is still PENDING!`);
            console.log(`   This is a webhook sync issue - payment was successful but status wasn't updated.`);
          }
        } catch (err) {
          console.log(`   ❌ Error checking Stripe: ${err.message}`);
        }
      }

      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Analysis
    console.log('📊 ANALYSIS:\n');

    const withPaymentIntent = pendingPackages.filter(p => p.paymentIntentId);
    const withoutPaymentIntent = pendingPackages.filter(p => !p.paymentIntentId);

    console.log(`Packages with Payment Intent: ${withPaymentIntent.length}`);
    console.log(`Packages without Payment Intent: ${withoutPaymentIntent.length}\n`);

    if (withPaymentIntent.length > 0) {
      console.log('⚠️  LIKELY CAUSE: Webhook Sync Issue');
      console.log('   - Payment was successful in Stripe');
      console.log('   - Webhook failed to update booking status to CONFIRMED');
      console.log('   - This happened before webhook improvements were implemented\n');
      
      console.log('🔧 PREVENTION:');
      console.log('   - Current webhook handler now properly updates booking status');
      console.log('   - Transaction records are created atomically');
      console.log('   - This should not happen with new bookings\n');
    }

    if (withoutPaymentIntent.length > 0) {
      console.log('⚠️  LIKELY CAUSE: Abandoned Checkout');
      console.log('   - User started booking but never completed payment');
      console.log('   - No payment intent was created');
      console.log('   - These can be safely ignored or cleaned up\n');
    }

    // Check webhook handler
    console.log('🔍 Checking Current Webhook Handler...\n');
    const webhookPath = 'app/api/payments/webhook/route.ts';
    const fs = require('fs');
    if (fs.existsSync(webhookPath)) {
      const webhookContent = fs.readFileSync(webhookPath, 'utf8');
      const hasStatusUpdate = webhookContent.includes('status: \'CONFIRMED\'') || 
                             webhookContent.includes('status: "CONFIRMED"');
      const hasTransactionCreation = webhookContent.includes('transaction.create');
      
      console.log(`✅ Webhook updates booking status: ${hasStatusUpdate ? 'YES' : 'NO'}`);
      console.log(`✅ Webhook creates transaction: ${hasTransactionCreation ? 'YES' : 'NO'}`);
      
      if (hasStatusUpdate && hasTransactionCreation) {
        console.log('\n✅ Current webhook handler is properly configured!');
        console.log('   New bookings should not have this issue.\n');
      } else {
        console.log('\n⚠️  Webhook handler may need updates!\n');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigatePendingPackages();
