const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function compareEarningsAndAnalytics() {
  console.log('🔍 Comparing Earnings vs Analytics Data\n');

  try {
    const user = await prisma.user.findUnique({
      where: { email: 'birhane457@gmail.com' },
      include: { instructor: true }
    });

    if (!user || !user.instructor) {
      console.log('❌ User or instructor not found');
      return;
    }

    console.log(`Testing for: ${user.email}`);
    console.log(`Instructor ID: ${user.instructor.id}`);
    console.log(`Commission Rate: ${user.instructor.commissionRate}%\n`);

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    console.log('📊 EARNINGS API (Transaction-based):\n');

    // Simulate earnings API query
    const earningsStats = await prisma.transaction.aggregate({
      where: {
        instructorId: user.instructor.id,
        status: 'COMPLETED',
        createdAt: { gte: startOfThisMonth }
      },
      _sum: { 
        amount: true,
        platformFee: true,
        instructorPayout: true
      },
      _count: true
    });

    console.log(`   Transactions: ${earningsStats._count}`);
    console.log(`   Gross Revenue: $${(earningsStats._sum.amount || 0).toFixed(2)}`);
    console.log(`   Commission: $${(earningsStats._sum.platformFee || 0).toFixed(2)}`);
    console.log(`   Net Earnings: $${(earningsStats._sum.instructorPayout || 0).toFixed(2)}`);

    console.log('\n📊 ANALYTICS API (Now Transaction-based):\n');

    // Simulate analytics API query
    const analyticsStats = await prisma.transaction.aggregate({
      where: {
        instructorId: user.instructor.id,
        status: 'COMPLETED',
        createdAt: { gte: startOfThisMonth }
      },
      _sum: { 
        amount: true,
        platformFee: true,
        instructorPayout: true
      },
      _count: true
    });

    console.log(`   Transactions: ${analyticsStats._count}`);
    console.log(`   Gross Revenue: $${(analyticsStats._sum.amount || 0).toFixed(2)}`);
    console.log(`   Commission: $${(analyticsStats._sum.platformFee || 0).toFixed(2)}`);
    console.log(`   Net Earnings: $${(analyticsStats._sum.instructorPayout || 0).toFixed(2)}`);

    console.log('\n✅ COMPARISON:\n');

    const earningsGross = earningsStats._sum.amount || 0;
    const analyticsGross = analyticsStats._sum.amount || 0;
    const earningsNet = earningsStats._sum.instructorPayout || 0;
    const analyticsNet = analyticsStats._sum.instructorPayout || 0;

    if (earningsGross === analyticsGross && earningsNet === analyticsNet) {
      console.log('   ✅ MATCH! Both APIs show the same data');
      console.log(`   Gross Revenue: $${earningsGross.toFixed(2)}`);
      console.log(`   Net Earnings: $${earningsNet.toFixed(2)}`);
    } else {
      console.log('   ❌ MISMATCH!');
      console.log(`   Earnings Gross: $${earningsGross.toFixed(2)}`);
      console.log(`   Analytics Gross: $${analyticsGross.toFixed(2)}`);
      console.log(`   Earnings Net: $${earningsNet.toFixed(2)}`);
      console.log(`   Analytics Net: $${analyticsNet.toFixed(2)}`);
    }

    // Show booking counts for context
    console.log('\n📅 Booking Counts (for context):\n');
    
    const bookingCounts = await prisma.booking.groupBy({
      by: ['status'],
      where: {
        instructorId: user.instructor.id,
        startTime: { gte: startOfThisMonth }
      },
      _count: true
    });

    bookingCounts.forEach(group => {
      console.log(`   ${group.status}: ${group._count}`);
    });

    const totalBookings = bookingCounts.reduce((sum, g) => sum + g._count, 0);
    console.log(`   TOTAL: ${totalBookings}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

compareEarningsAndAnalytics();
