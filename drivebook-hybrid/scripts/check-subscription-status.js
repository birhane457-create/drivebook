/**
 * Check Subscription Status for User
 * 
 * Usage: node scripts/check-subscription-status.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSubscriptionStatus() {
  try {
    console.log('\n🔍 Checking Subscription Status...\n');

    const email = 'birhane457@gmail.com';

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        instructor: {
          include: {
            subscriptions: {
              where: { status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] } },
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    });

    if (!user || !user.instructor) {
      console.log('❌ User or instructor not found\n');
      return;
    }

    const instructor = user.instructor;

    console.log('👤 User:', email);
    console.log('📊 Instructor Status:\n');
    console.log(`  Subscription Tier: ${instructor.subscriptionTier}`);
    console.log(`  Subscription Status: ${instructor.subscriptionStatus}`);
    console.log(`  Commission Rate: ${instructor.commissionRate}%`);
    console.log(`  New Student Bonus: ${instructor.newStudentBonus}%`);
    console.log(`  Stripe Customer ID: ${instructor.stripeCustomerId || 'Not set'}`);
    
    if (instructor.trialEndsAt) {
      const daysLeft = Math.ceil((new Date(instructor.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24));
      console.log(`  Trial Ends: ${new Date(instructor.trialEndsAt).toLocaleDateString()} (${daysLeft} days left)`);
    }

    console.log('\n📋 Subscriptions:\n');
    
    if (instructor.subscriptions.length === 0) {
      console.log('  No active subscriptions found\n');
    } else {
      instructor.subscriptions.forEach((sub, index) => {
        console.log(`  Subscription ${index + 1}:`);
        console.log(`    ID: ${sub.id}`);
        console.log(`    Tier: ${sub.tier}`);
        console.log(`    Status: ${sub.status}`);
        console.log(`    Monthly Amount: $${sub.monthlyAmount}`);
        console.log(`    Billing Cycle: ${sub.billingCycle}`);
        console.log(`    Stripe Subscription ID: ${sub.stripeSubscriptionId || 'Not set'}`);
        console.log(`    Stripe Customer ID: ${sub.stripeCustomerId || 'Not set'}`);
        console.log(`    Period: ${new Date(sub.currentPeriodStart).toLocaleDateString()} - ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`);
        console.log('');
      });
    }

    console.log('=' .repeat(60));
    console.log('\n✅ Status Check Complete\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSubscriptionStatus();
