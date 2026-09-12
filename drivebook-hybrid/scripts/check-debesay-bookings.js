/**
 * Check Debesay Birhane's booking counts
 * Verify that package bookings are counted correctly
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDebesayBookings() {
  console.log('🔍 Checking Debesay Birhane Bookings\n');

  try {
    // Find instructor by name
    const instructor = await prisma.instructor.findFirst({
      where: {
        name: {
          contains: 'Debesay',
          mode: 'insensitive',
        },
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!instructor) {
      console.log('❌ Instructor "Debesay Birhane" not found');
      return;
    }

    console.log('✅ Found Instructor:');
    console.log(`   Name: ${instructor.name}`);
    console.log(`   Email: ${instructor.user.email}`);
    console.log(`   ID: ${instructor.id}`);
    console.log(`   Total Bookings (stored): ${instructor.totalBookings}`);
    console.log('');

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

    console.log(`📊 Actual Booking Count: ${allBookings.length}\n`);

    // Categorize bookings
    const packageBookings = allBookings.filter((b) => b.isPackageBooking);
    const parentPackages = packageBookings.filter((b) => !b.parentBookingId);
    const childPackages = packageBookings.filter((b) => b.parentBookingId);
    const singleBookings = allBookings.filter((b) => !b.isPackageBooking);

    console.log('📦 Booking Breakdown:');
    console.log(`   Single Bookings: ${singleBookings.length}`);
    console.log(`   Package Bookings (Parent): ${parentPackages.length}`);
    console.log(`   Package Bookings (Child): ${childPackages.length}`);
    console.log(`   Total Package Bookings: ${packageBookings.length}`);
    console.log('');

    // Show package details
    if (parentPackages.length > 0) {
      console.log('📦 Package Booking Details:\n');
      for (const pkg of parentPackages) {
        const children = allBookings.filter((b) => b.parentBookingId === pkg.id);
        console.log(`Package: ${pkg.id.slice(0, 8)}...`);
        console.log(`  Client: ${pkg.client.name}`);
        console.log(`  Package Hours: ${pkg.packageHours || 0}`);
        console.log(`  Package Status: ${pkg.packageStatus}`);
        console.log(`  Price: $${pkg.price}`);
        console.log(`  Created: ${pkg.createdAt.toLocaleDateString()}`);
        console.log(`  Child Bookings: ${children.length}`);
        console.log(`  Status: ${pkg.status}`);
        console.log('');
      }
    }

    // Show status breakdown
    console.log('📈 Status Breakdown:');
    const statusCounts = {};
    allBookings.forEach((b) => {
      statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
    });
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    console.log('');

    // Check if totalBookings needs update
    if (instructor.totalBookings !== allBookings.length) {
      console.log('⚠️  MISMATCH DETECTED!');
      console.log(`   Stored totalBookings: ${instructor.totalBookings}`);
      console.log(`   Actual bookings: ${allBookings.length}`);
      console.log(`   Difference: ${allBookings.length - instructor.totalBookings}`);
      console.log('');

      // Offer to fix
      console.log('🔧 Updating totalBookings...');
      await prisma.instructor.update({
        where: { id: instructor.id },
        data: { totalBookings: allBookings.length },
      });
      console.log('✅ Updated totalBookings to', allBookings.length);
    } else {
      console.log('✅ totalBookings is correct!');
    }

    // Show recent bookings
    console.log('\n📅 Recent Bookings (last 10):');
    allBookings.slice(0, 10).forEach((booking, index) => {
      const type = booking.isPackageBooking
        ? booking.parentBookingId
          ? '  └─ Child'
          : '📦 Parent'
        : '📝 Single';
      console.log(
        `${index + 1}. ${type} | ${booking.client.name} | ${booking.startTime.toLocaleDateString()} | ${booking.status} | $${booking.price}`
      );
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDebesayBookings();
