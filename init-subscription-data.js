const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function initSubscriptionData() {
  try {
    console.log('Initializing subscription data for existing instructors...\n');
    
    // //Set trial end date to 14 days from now for all instructors
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14);
    
    const result = await prisma.instructor.updateMany({
      data: {
        subscriptionTier: 'BASIC',
        subscriptionStatus: 'TRIAL',
        trialEndsAt: trialEndDate,
        maxInstructors: 1,
        brandedBookingPage: false
      }
    });
    
    console.log(`✅ Updated ${result.count} instructors with subscription data`);
    console.log(`Trial end date set to: ${trialEndDate.toLocaleDateString()}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initSubscriptionData();
