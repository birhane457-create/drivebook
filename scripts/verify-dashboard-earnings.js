const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyDashboardEarnings() {
  console.log('📊 Verifying Dashboard Earnings\n');

  try {
    const instructorEmail = 'birhane457@gmail.com';
    
    // Get instructor
    const user = await prisma.user.findUnique({
      where: { email: instructorEmail },
      select: {
        instructor: {
          select: { id: true }
        }
      }
    });

    if (!user?.instructor?.id) {
      console.log('❌ Instructor not found');
      return;
    }

    const instructorId = user.instructor.id;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    console.log(`Instructor ID: ${instructorId}`);
    console.log(`Month: ${startOfMonth.toLocaleDateString()} - ${endOfMonth.toLocaleDateString()}\n`);

    // Check bookings by status
    const bookingsByStatus = await prisma.booking.groupBy({
      by: ['status'],
      where: {
        instructorId: instructorId,
        startTime: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      _count: true,
      _sum: {
        price: true
      }
    });

    console.log('📋 Bookings by Status (This Month):');
    bookingsByStatus.forEach(group => {
      console.log(`  ${group.status}: ${group._count} bookings, $${group._sum.price?.toFixed(2) || 0}`);
    });

    // Dashboard calculation (COMPLETED only)
    const dashboardRevenue = await prisma.booking.aggregate({
      where: {
        instructorId: instructorId,
        status: 'COMPLETED',
        startTime: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      _sum: {
        price: true
      }
    });

    console.log(`\n💰 Dashboard "This Month": $${dashboardRevenue._sum.price || 0}`);

    // CONFIRMED bookings (paid but not completed)
    const confirmedRevenue = await prisma.booking.aggregate({
      where: {
        instructorId: instructorId,
        status: 'CONFIRMED',
        startTime: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      _sum: {
        price: true
      }
    });

    console.log(`💳 CONFIRMED (Paid, Not Yet Completed): $${confirmedRevenue._sum.price || 0}`);

    // Total paid (COMPLETED + CONFIRMED)
    const totalPaid = (dashboardRevenue._sum.price || 0) + (confirmedRevenue._sum.price || 0);
    console.log(`✅ Total Paid This Month: $${totalPaid.toFixed(2)}`);

    // Check transactions
    console.log('\n📊 Transaction Data:');
    const transactions = await prisma.transaction.aggregate({
      where: {
        instructorId: instructorId,
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth
        },
        status: 'COMPLETED'
      },
      _sum: {
        amount: true,
        platformFee: true,
        instructorPayout: true
      }
    });

    console.log(`  Gross Revenue: $${transactions._sum.amount?.toFixed(2) || 0}`);
    console.log(`  Platform Fee: $${transactions._sum.platformFee?.toFixed(2) || 0}`);
    console.log(`  Instructor Payout: $${transactions._sum.instructorPayout?.toFixed(2) || 0}`);

    // List all bookings this month
    console.log('\n📝 All Bookings This Month:');
    const allBookings = await prisma.booking.findMany({
      where: {
        instructorId: instructorId,
        startTime: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      select: {
        id: true,
        status: true,
        price: true,
        isPaid: true,
        startTime: true,
        client: {
          select: { name: true }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    allBookings.forEach(booking => {
      console.log(`  ${booking.status.padEnd(10)} | $${booking.price.toString().padEnd(8)} | Paid: ${booking.isPaid ? 'Yes' : 'No '} | ${booking.client.name} | ${booking.startTime.toLocaleDateString()}`);
    });

    console.log(`\n📊 Total: ${allBookings.length} bookings`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDashboardEarnings();
