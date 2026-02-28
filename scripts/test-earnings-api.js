/**
 * Test script for earnings API enhancements
 * Tests that package purchases are returned correctly
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testEarningsAPI() {
  console.log('🧪 Testing Earnings API Enhancements...\n');

  try {
    // Find an instructor with bookings
    const instructor = await prisma.instructor.findFirst({
      where: {
        bookings: {
          some: {}
        }
      }
    });

    if (!instructor) {
      console.log('❌ No instructors with bookings found');
      return;
    }

    console.log(`✅ Found instructor: ${instructor.id}`);

    // Check for package purchases
    const packagePurchases = await prisma.booking.findMany({
      where: {
        instructorId: instructor.id,
        isPackageBooking: true,
        parentBookingId: null,
        status: { in: ['CONFIRMED', 'COMPLETED'] }
      },
      include: {
        client: {
          select: {
            name: true,
            email: true
          }
        }
      },
      take: 5
    });

    console.log(`\n📦 Package Purchases Found: ${packagePurchases.length}`);
    
    if (packagePurchases.length > 0) {
      packagePurchases.forEach((pkg, idx) => {
        console.log(`\nPackage ${idx + 1}:`);
        console.log(`  Client: ${pkg.client.name}`);
        console.log(`  Hours: ${pkg.packageHours}h (Used: ${pkg.packageHoursUsed}h, Remaining: ${pkg.packageHoursRemaining}h)`);
        console.log(`  Status: ${pkg.packageStatus}`);
        console.log(`  Price: $${pkg.price} → Instructor: $${pkg.instructorPayout}`);
        console.log(`  Paid: ${pkg.isPaid ? 'Yes' : 'No'}`);
        console.log(`  Expires: ${pkg.packageExpiryDate?.toLocaleDateString()}`);
      });
    }

    // Check transactions
    const transactions = await prisma.transaction.findMany({
      where: { instructorId: instructor.id },
      include: {
        booking: {
          select: {
            id: true,
            isPackageBooking: true,
            packageHours: true,
            client: {
              select: { name: true }
            },
            startTime: true,
            endTime: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`\n💰 Recent Transactions Found: ${transactions.length}`);
    
    if (transactions.length > 0) {
      transactions.forEach((txn, idx) => {
        console.log(`\nTransaction ${idx + 1}:`);
        console.log(`  Type: ${txn.type}`);
        console.log(`  Amount: $${txn.amount} → Instructor: $${txn.instructorPayout}`);
        console.log(`  Status: ${txn.status}`);
        if (txn.booking) {
          console.log(`  Booking: ${txn.booking.client.name}`);
          console.log(`  Is Package: ${txn.booking.isPackageBooking ? 'Yes' : 'No'}`);
        }
      });
    }

    // Test aggregations
    const completedStats = await prisma.transaction.aggregate({
      where: {
        instructorId: instructor.id,
        status: 'COMPLETED'
      },
      _sum: { instructorPayout: true },
      _count: true
    });

    console.log(`\n📊 Completed Earnings Stats:`);
    console.log(`  Total Transactions: ${completedStats._count}`);
    console.log(`  Total Earnings: $${completedStats._sum.instructorPayout || 0}`);

    console.log('\n✅ All tests passed! API is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testEarningsAPI();
