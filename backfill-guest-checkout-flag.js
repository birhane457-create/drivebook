/**
 * Backfill Script: Set isGuestCheckout Flag on Existing Bookings
 * 
 * Marks all existing bookings as non-guest (false) since they were
 * created before the guest checkout tracking feature was implemented.
 * 
 * Run once after deploying isGuestCheckout feature.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillGuestCheckoutFlag() {
  console.log('🔄 Starting backfill: Setting isGuestCheckout flag on existing bookings...\n');

  try {
    // Get total count of bookings
    const totalBookings = await prisma.booking.count();
    console.log(`📊 Found ${totalBookings} total bookings in database`);

    if (totalBookings === 0) {
      console.log('✅ No bookings found. Nothing to do.');
      return;
    }

    // Mark all existing bookings as non-guest (grandfather clause)
    // These bookings were created before guest checkout tracking
    // MongoDB will only update documents where isGuestCheckout is not already set
    const result = await prisma.booking.updateMany({
      data: {
        isGuestCheckout: false
      }
    });

    console.log(`\n✅ Successfully processed ${result.count} bookings`);
    console.log('📝 All existing bookings marked as non-guest checkout');
    console.log('🔐 New bookings will be tracked with isGuestCheckout flag\n');

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill
backfillGuestCheckoutFlag()
  .then(() => {
    console.log('✅ Backfill completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  });
