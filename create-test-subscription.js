const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestSubscription() {
  try {
    console.log('Creating test subscription for instructor...\n');
    
    // Get the instructor
    const instructor = await prisma.instructor.findFirst({
      where: { subscriptionTier: 'BASIC' }
    });
    
    if (!instructor) {
      console.log('No instructor found');
      return;
    }
    
    // Create subscription record
    const subscription = await prisma.subscription.create({
      data: {
        instructorId: instructor.id,
        tier: 'BASIC',
        status: 'TRIAL',
        billingCycle: 'monthly',
        monthlyAmount: 29, // Correct price for BASIC
        currentPeriodStart: new Date(),
        currentPeriodEnd: instructor.trialEndsAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      }
    });
    
    console.log('✅ Created subscription:', subscription);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestSubscription();
