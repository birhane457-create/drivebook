const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateSubscriptionTiers() {
  try {
    console.log('Starting subscription tier migration...');

    // Update all instructors with 'basic' tier to 'PRO'
    const result = await prisma.$runCommandRaw({
      update: 'Instructor',
      updates: [
        {
          q: { subscriptionTier: 'basic' },
          u: { 
            $set: { 
              subscriptionTier: 'PRO',
              subscriptionStatus: 'TRIAL',
              commissionRate: 12.0,
              newStudentBonus: 8.0
            } 
          },
          multi: true
        }
      ]
    });

    console.log('Migration result:', result);

    // Verify the migration
    const instructors = await prisma.instructor.findMany({
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        commissionRate: true,
      }
    });

    console.log('\nInstructors after migration:');
    instructors.forEach(instructor => {
      console.log(`- ${instructor.name}: ${instructor.subscriptionTier} (${instructor.commissionRate}% commission)`);
    });

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateSubscriptionTiers();
