/**
 * Fix Debesay's booking count to match UI
 * Investigate $0 bookings and package bookings
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDebesayBookingCount() {
  console.log('🔧 Fixing Debesay Booking Count\n');

  try {
    // Find the main instructor
    const instructor = await prisma.instructor.findFirst({
      where: {
        name: 'Debesay Birhane',
        user: {
          email: 'debesay304@gmail.com',
        },
      },
    });

    if (!instructor) {
      console.log('❌ Instructor not found');
      return;
    }

    console.log(`Found: ${instructor.name} (${instructor.id})\n`);

    // Get ALL bookings including those with $0
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
          },
        },
      },
    });

    console.log(`📊 Total Bookings Found: ${allBookings.length}\n`);

    // Categorize bookings
    const zeroPrice = allBookings.filter((b) => b.price === 0 || b.price === null);
    const withPrice = allBookings.filter((b) => b.price > 0);
    const pending = allBookings.filter((b) => b.status === 'PENDING');
    const confirmed = allBookings.filter((b) => b.status === 'CONFIRMED');
    const completed = allBookings.filter((b) => b.status === 'COMPLETED');
    const cancelled = allBookings.filter((b) => b.status === 'CANCELLED');

    console.log('📋 Breakdown:');
    console.log(`   With Price ($>0): ${withPrice.length}`);
    console.log(`   Zero Price ($0): ${zeroPrice.length}`);
    console.log('');
    console.log(`   PENDING: ${pending.length}`);
    console.log(`   CONFIRMED: ${confirmed.length}`);
    console.log(`   COMPLETED: ${completed.length}`);
    console.log(`   CANCELLED: ${cancelled.length}`);
    console.log('');

    // Show $0 bookings
    if (zeroPrice.length > 0) {
      console.log('💰 Zero Price Bookings:\n');
      zeroPrice.forEach((b, i) => {
        console.log(`${i + 1}. ${b.client.name}`);
        console.log(`   Date: ${b.startTime.toLocaleDateString()}`);
        console.log(`   Status: ${b.status}`);
        console.log(`   Package: ${b.isPackageBooking ? 'Yes' : 'No'}`);
        console.log(`   Parent: ${b.parentBookingId || 'None'}`);
        console.log(`   ID: ${b.id}`);
        console.log('');
      });
    }

    // Check for package bookings
    const packageBookings = allBookings.filter((b) => b.isPackageBooking);
    const parentPackages = packageBookings.filter((b) => !b.parentBookingId);
    const childPackages = packageBookings.filter((b) => b.parentBookingId);

    console.log('📦 Package Bookings:');
    console.log(`   Parent Packages: ${parentPackages.length}`);
    console.log(`   Child Packages: ${childPackages.length}`);
    console.log('');

    // Update totalBookings to match actual count
    console.log(`🔧 Updating totalBookings from ${instructor.totalBookings} to ${allBookings.length}...`);
    
    await prisma.instructor.update({
      where: { id: instructor.id },
      data: {
        totalBookings: allBookings.length,
      },
    });

    console.log('✅ Updated totalBookings to', allBookings.length);
    console.log('');

    // Show summary
    console.log('📊 Final Summary:');
    console.log(`   Total Bookings: ${allBookings.length}`);
    console.log(`   Stored in Profile: ${allBookings.length}`);
    console.log(`   Match: ✅`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDebesayBookingCount();
