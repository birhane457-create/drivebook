const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPackagePurchases() {
  console.log('🔍 Checking Package Purchases vs Regular Bookings\n');

  try {
    // Get one of the pending bookings to examine
    const booking = await prisma.booking.findUnique({
      where: { id: '6999e95fdb3e928e24943e03' }
    });

    console.log('📦 Sample Booking Details:\n');
    console.log(`ID: ${booking.id}`);
    console.log(`Is Package Booking: ${booking.isPackageBooking}`);
    console.log(`Parent Booking ID: ${booking.parentBookingId}`);
    console.log(`Package Hours: ${booking.packageHours}`);
    console.log(`Package Hours Used: ${booking.packageHoursUsed}`);
    console.log(`Package Hours Remaining: ${booking.packageHoursRemaining}`);
    console.log(`Start Time: ${booking.startTime}`);
    console.log(`End Time: ${booking.endTime}`);
    console.log(`Duration: ${booking.duration}`);
    console.log(`Status: ${booking.status}`);
    console.log(`Price: $${booking.price}\n`);

    // Check all pending bookings
    const pendingBookings = await prisma.booking.findMany({
      where: {
        status: 'PENDING',
        isPackageBooking: true,
        parentBookingId: null
      }
    });

    console.log(`\n📊 Found ${pendingBookings.length} pending PACKAGE PURCHASES\n`);

    if (pendingBookings.length > 0) {
      console.log('⚠️  ISSUE IDENTIFIED:\n');
      console.log('These are PACKAGE PURCHASES (parent bookings), not actual lesson bookings.');
      console.log('They should be CONFIRMED after payment, not PENDING.\n');
      
      console.log('Why they show same start/end time:');
      console.log('- Start/End time = Purchase time (not lesson time)');
      console.log('- Duration = 0 or package hours (not actual lesson duration)');
      console.log('- These are "container" bookings that hold the package hours');
      console.log('- Actual lessons are created as child bookings later\n');
      
      console.log('Current System Behavior:');
      console.log('✅ New package purchases should be CONFIRMED after payment');
      console.log('✅ Child bookings (actual lessons) are created when client schedules');
      console.log('❌ These old purchases stayed PENDING due to webhook issue\n');
    }

    // Check if there are child bookings
    const childBookings = await prisma.booking.findMany({
      where: {
        parentBookingId: { in: pendingBookings.map(p => p.id) }
      }
    });

    console.log(`Child bookings from these packages: ${childBookings.length}\n`);

    if (childBookings.length > 0) {
      console.log('ℹ️  These packages have scheduled lessons (child bookings).');
      console.log('   The package purchase should be CONFIRMED so hours can be used.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPackagePurchases();
