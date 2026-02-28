/**
 * Count bookings across ALL Debesay instructor accounts
 * The UI might be aggregating from multiple accounts
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function consolidateDebesayBookings() {
  console.log('🔍 Checking ALL Debesay Instructor Accounts\n');

  try {
    // Find ALL instructors with Debesay in name
    const instructors = await prisma.instructor.findMany({
      where: {
        OR: [
          { name: { contains: 'Debesay', mode: 'insensitive' } },
          { name: { contains: 'DEBESAY', mode: 'insensitive' } },
        ],
      },
      include: {
        user: { select: { email: true } },
      },
    });

    console.log(`Found ${instructors.length} Debesay instructor accounts:\n`);

    let grandTotal = 0;

    for (const instructor of instructors) {
      const bookings = await prisma.booking.findMany({
        where: { instructorId: instructor.id },
      });

      console.log(`📋 ${instructor.name}`);
      console.log(`   Email: ${instructor.user.email}`);
      console.log(`   Bookings: ${bookings.length}`);
      console.log(`   Stored totalBookings: ${instructor.totalBookings}`);
      
      if (instructor.totalBookings !== bookings.length) {
        console.log(`   ⚠️  MISMATCH - Updating...`);
        await prisma.instructor.update({
          where: { id: instructor.id },
          data: { totalBookings: bookings.length },
        });
        console.log(`   ✅ Updated to ${bookings.length}`);
      } else {
        console.log(`   ✅ Correct`);
      }
      
      console.log('');
      grandTotal += bookings.length;
    }

    console.log(`\n📊 GRAND TOTAL ACROSS ALL ACCOUNTS: ${grandTotal} bookings`);
    console.log('');

    // If UI shows 32, let's find where they are
    if (grandTotal !== 32) {
      console.log(`⚠️  UI shows 32 bookings, but database has ${grandTotal}`);
      console.log(`   Difference: ${32 - grandTotal} bookings`);
      console.log('');
      console.log('Possible reasons:');
      console.log('   1. Bookings in a different instructor account');
      console.log('   2. Deleted bookings still cached in UI');
      console.log('   3. Package booking children not being counted');
      console.log('   4. Browser cache issue');
    } else {
      console.log('✅ Database matches UI count!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

consolidateDebesayBookings();
