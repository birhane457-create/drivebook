/**
 * Backfill Script: Mark Existing Users as Verified
 * 
 * This is a "grandfather clause" - existing users are trusted
 * and marked as verified to avoid disrupting their experience.
 * 
 * Run once after deploying email verification feature.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillVerifiedUsers() {
  console.log('🔄 Starting backfill: Marking existing users as verified...\n');

  try {
    // Get count of unverified users
    const unverifiedCount = await prisma.user.count({
      where: { emailVerified: false }
    });

    console.log(`📊 Found ${unverifiedCount} unverified users`);

    if (unverifiedCount === 0) {
      console.log('✅ All users are already verified. Nothing to do.');
      return;
    }

    // Mark all existing users as verified (grandfather clause)
    const result = await prisma.user.updateMany({
      where: { emailVerified: false },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    console.log(`\n✅ Successfully verified ${result.count} users`);
    console.log('📧 These users will not receive verification emails');
    console.log('🔐 They can login immediately with their existing passwords\n');

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill
backfillVerifiedUsers()
  .then(() => {
    console.log('✅ Backfill completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  });
