const { PrismaClient } = require('@prisma/client');
const Stripe = require('stripe');

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function syncStripeCustomer() {
  try {
    console.log('\n🔍 Searching for Stripe customer...\n');

    const email = 'birhane457@gmail.com';

    // Search for customer in Stripe by email
    const customers = await stripe.customers.list({
      email: email,
      limit: 1
    });

    if (customers.data.length === 0) {
      console.log('❌ No Stripe customer found for', email);
      console.log('   You need to complete the checkout process first.');
      return;
    }

    const customer = customers.data[0];
    console.log('✅ Found Stripe customer:', customer.id);
    console.log('   Email:', customer.email);
    console.log('   Created:', new Date(customer.created * 1000).toLocaleString());

    // Get subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 10
    });

    console.log('\n📋 Subscriptions:', subscriptions.data.length);
    subscriptions.data.forEach((sub, i) => {
      console.log(`\n   Subscription ${i + 1}:`);
      console.log('   ID:', sub.id);
      console.log('   Status:', sub.status);
      console.log('   Plan:', sub.items.data[0]?.price?.id);
    });

    // Update instructor with customer ID
    const user = await prisma.user.findUnique({
      where: { email },
      include: { instructor: true }
    });

    if (!user?.instructor) {
      console.log('\n❌ Instructor not found in database');
      return;
    }

    console.log('\n🔄 Updating instructor with customer ID...');

    await prisma.instructor.update({
      where: { id: user.instructor.id },
      data: { stripeCustomerId: customer.id }
    });

    // Update subscription records
    await prisma.subscription.updateMany({
      where: { instructorId: user.instructor.id },
      data: { stripeCustomerId: customer.id }
    });

    console.log('✅ Customer ID synced successfully!');
    console.log('\n📊 Updated Records:');
    console.log('   Instructor ID:', user.instructor.id);
    console.log('   Stripe Customer ID:', customer.id);
    console.log('\n✨ You can now access the billing portal!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

syncStripeCustomer();
