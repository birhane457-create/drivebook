/**
 * Investigate why some bookings have $0 price and PENDING status
 * These are likely package booking slots that weren't properly set up
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigateZeroPriceBookings() {
  console.log('🔍 Investigating $0 PENDING Bookings\n');

  try {
    // Find the instructor with 32 bookings (birhane457@gmail.com)
    const instructor = await prisma.instructor.findFirst({
      where: {
        user: {
          email: 'birhane457@gmail.com',
        },
      },
    });

    if (!instructor) {
      console.log('❌ Instructor not found');
      return;
    }

    console.log(`Found: ${instructor.name}`);
    console.log(`Email: birhane457@gmail.com`);
    console.log(`ID: ${instructor.id}\n`);

    // Get all bookings
    const allBookings = await prisma.booking.findMany({
      where: {
        instructorId: instructor.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        client: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    console.log(`📊 Total Bookings: ${allBookings.length}\n`);

    // Find $0 bookings
    const zeroPrice = allBookings.filter((b) => b.price === 0 || b.price === null);
    const pending = allBookings.filter((b) => b.status === 'PENDING');
    const zeroPending = allBookings.filter(
      (b) => (b.price === 0 || b.price === null) && b.status === 'PENDING'
    );

    console.log('📋 Breakdown:');
    console.log(`   Zero Price ($0): ${zeroPrice.length}`);
    console.log(`   PENDING Status: ${pending.length}`);
    console.log(`   Zero + PENDING: ${zeroPending.length}`);
    console.log('');

    // Analyze zero price bookings
    if (zeroPrice.length > 0) {
      console.log('💰 Zero Price Bookings Analysis:\n');

      zeroPrice.forEach((b, i) => {
        console.log(`${i + 1}. Booking ID: ${b.id.slice(0, 12)}...`);
        console.log(`   Client: ${b.client.name}`);
        console.log(`   Date: ${b.startTime.toLocaleDateString()} ${b.startTime.toLocaleTimeString()}`);
        console.log(`   Status: ${b.status}`);
        console.log(`   Price: $${b.price || 0}`);
        console.log(`   Is Package: ${b.isPackageBooking}`);
        console.log(`   Parent ID: ${b.parentBookingId || 'None'}`);
        console.log(`   Package Hours: ${b.packageHours || 0}`);
        console.log(`   Package Status: ${b.packageStatus || 'N/A'}`);
        console.log(`   Is Paid: ${b.isPaid}`);
        console.log(`   Created: ${b.createdAt.toLocaleDateString()}`);
        console.log('');
      });

      // Check if these are package booking children
      const packageChildren = zeroPrice.filter((b) => b.parentBookingId);
      const packageParents = zeroPrice.filter((b) => b.isPackageBooking && !b.parentBookingId);

      console.log('📦 Package Analysis:');
      console.log(`   Package Children (should have parent): ${packageChildren.length}`);
      console.log(`   Package Parents (main booking): ${packageParents.length}`);
      console.log(`   Neither (single bookings with $0): ${zeroPrice.length - packageChildren.length - packageParents.length}`);
      console.log('');

      // These are likely incomplete package bookings
      if (zeroPrice.length > 0 && packageChildren.length === 0 && packageParents.length === 0) {
        console.log('⚠️  ISSUE IDENTIFIED:');
        console.log('   These bookings have $0 price but are NOT marked as package bookings.');
        console.log('   This happens when:');
        console.log('   1. Package booking flow was started but not completed');
        console.log('   2. Booking was created without payment');
        console.log('   3. Test bookings that weren\'t cleaned up');
        console.log('   4. Scheduled package hours that haven\'t been paid yet');
        console.log('');
        console.log('💡 RECOMMENDATION:');
        console.log('   These bookings should either:');
        console.log('   - Be deleted if they\'re incomplete/test bookings');
        console.log('   - Have a price assigned if they\'re valid');
        console.log('   - Be marked as package children if part of a package');
        console.log('');
      }
    }

    // Check for any parent packages
    const parentPackages = allBookings.filter((b) => b.isPackageBooking && !b.parentBookingId);
    if (parentPackages.length > 0) {
      console.log('📦 Parent Package Bookings:\n');
      for (const pkg of parentPackages) {
        const children = allBookings.filter((b) => b.parentBookingId === pkg.id);
        console.log(`Package: ${pkg.id.slice(0, 12)}...`);
        console.log(`  Client: ${pkg.client.name}`);
        console.log(`  Price: $${pkg.price}`);
        console.log(`  Package Hours: ${pkg.packageHours}`);
        console.log(`  Child Bookings: ${children.length}`);
        console.log(`  Status: ${pkg.status}`);
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateZeroPriceBookings();
