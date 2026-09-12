const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testBirhaneEarnings() {
  console.log('🧪 Testing Earnings for birhane457@gmail.com\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Find instructor by email
    const user = await prisma.user.findUnique({
      where: { email: 'birhane457@gmail.com' },
      include: {
        instructor: true
      }
    });

    if (!user) {
      console.log('❌ User not found with email: birhane457@gmail.com');
      console.log('   Please check if the email is correct.\n');
      return;
    }

    if (!user.instructor) {
      console.log('❌ User found but has no instructor profile');
      console.log(`   User ID: ${user.id}`);
      console.log(`   Role: ${user.role}\n`);
      return;
    }

    const instructor = user.instructor;
    console.log(`✅ Found instructor: ${instructor.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Instructor ID: ${instructor.id}`);
    console.log(`   User ID: ${user.id}\n`);

    // Get all transactions
    console.log('📊 TRANSACTION ANALYSIS');
    console.log('─────────────────────────────────────────────────────────\n');

    const allTransactions = await prisma.transaction.findMany({
      where: {
        instructorId: instructor.id
      },
      include: {
        booking: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            isPackageBooking: true,
            parentBookingId: true,
            packageHours: true,
            client: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`   Total transactions: ${allTransactions.length}\n`);

    // Categorize transactions
    const completed = allTransactions.filter(t => t.status === 'COMPLETED');
    const pending = allTransactions.filter(t => t.status === 'PENDING');
    const packagePurchases = completed.filter(t => 
      t.booking?.isPackageBooking && !t.booking?.parentBookingId
    );
    const lessonTransactions = completed.filter(t => {
      if (!t.booking) return true;
      return !(t.booking.isPackageBooking && !t.booking.parentBookingId);
    });

    console.log('   Status Breakdown:');
    console.log(`      Completed: ${completed.length}`);
    console.log(`      Pending: ${pending.length}`);
    console.log(`      Package purchases: ${packagePurchases.length}`);
    console.log(`      Actual lessons: ${lessonTransactions.length}\n`);

    if (packagePurchases.length > 0) {
      console.log('   📦 Package Purchases (excluded from earnings):');
      packagePurchases.forEach(t => {
        console.log(`      • ${t.booking.client.name} - ${t.booking.packageHours}h package`);
        console.log(`        Amount: $${t.amount.toFixed(2)} | Date: ${new Date(t.createdAt).toLocaleDateString()}`);
      });
      console.log('');
    }

    // Week grouping
    console.log('📅 WEEKLY EARNINGS BREAKDOWN');
    console.log('─────────────────────────────────────────────────────────\n');

    const getWeekStart = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(d.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);
      return weekStart;
    };

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const currentWeekStart = getWeekStart(now);
    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const weekMap = new Map();
    lessonTransactions.forEach(t => {
      const date = new Date(t.createdAt);
      date.setHours(0, 0, 0, 0);
      const weekStart = getWeekStart(date);
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey).push(t);
    });

    const currentWeekKey = currentWeekStart.toISOString().split('T')[0];
    const lastWeekKey = lastWeekStart.toISOString().split('T')[0];

    console.log(`   Current week starts: ${currentWeekStart.toLocaleDateString()}`);
    console.log(`   Last week starts: ${lastWeekStart.toLocaleDateString()}\n`);

    let thisWeekTotal = 0;
    let lastWeekTotal = 0;
    let thisMonthTotal = 0;

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    weekMap.forEach((transactions, weekKey) => {
      const weekStart = new Date(weekKey);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const totalNet = transactions.reduce((sum, t) => sum + t.instructorPayout, 0);
      const totalGross = transactions.reduce((sum, t) => sum + t.amount, 0);
      const lessonCount = transactions.filter(t => t.booking).length;

      const isCurrentWeek = weekKey === currentWeekKey;
      const isLastWeek = weekKey === lastWeekKey;

      if (isCurrentWeek) {
        thisWeekTotal = totalNet;
        console.log(`   🟢 THIS WEEK (${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()})`);
      } else if (isLastWeek) {
        lastWeekTotal = totalNet;
        console.log(`   🔵 LAST WEEK (${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()})`);
      } else {
        console.log(`   ⚪ ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`);
      }

      console.log(`      Lessons: ${lessonCount}`);
      console.log(`      Gross: $${totalGross.toFixed(2)}`);
      console.log(`      Net: $${totalNet.toFixed(2)}`);
      
      // Show individual transactions
      if (transactions.length <= 5) {
        console.log('      Transactions:');
        transactions.forEach(t => {
          const date = new Date(t.createdAt).toLocaleDateString();
          const client = t.booking?.client.name || 'N/A';
          console.log(`         • ${date} - ${client} - $${t.instructorPayout.toFixed(2)}`);
        });
      }
      console.log('');

      // Calculate this month
      if (weekStart >= startOfMonth) {
        thisMonthTotal += totalNet;
      }
    });

    console.log('   📈 Summary:');
    console.log(`      This Week: $${thisWeekTotal.toFixed(2)}`);
    console.log(`      Last Week: $${lastWeekTotal.toFixed(2)}`);
    console.log(`      This Month: $${thisMonthTotal.toFixed(2)}\n`);

    // Scheduled bookings
    console.log('📅 SCHEDULED BOOKINGS (Future Earnings)');
    console.log('─────────────────────────────────────────────────────────\n');

    const scheduledBookings = await prisma.booking.findMany({
      where: {
        instructorId: instructor.id,
        status: 'CONFIRMED',
        startTime: { gte: now }
      },
      include: {
        client: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    console.log(`   Total scheduled: ${scheduledBookings.length}`);
    
    if (scheduledBookings.length > 0) {
      const scheduledTotal = scheduledBookings.reduce((sum, b) => sum + (b.instructorPayout || 0), 0);
      console.log(`   Total value: $${scheduledTotal.toFixed(2)}\n`);
      
      console.log('   Upcoming lessons:');
      scheduledBookings.forEach(booking => {
        const isFromPackage = booking.isPackageBooking && booking.parentBookingId;
        const date = new Date(booking.startTime).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        console.log(`      • ${booking.client.name} - ${date}`);
        console.log(`        $${booking.instructorPayout.toFixed(2)}${isFromPackage ? ' (Package)' : ''}`);
      });
      console.log('');
    } else {
      console.log('   ℹ️  No scheduled bookings\n');
    }

    // Test API response format
    console.log('🔍 API RESPONSE SIMULATION');
    console.log('─────────────────────────────────────────────────────────\n');

    const apiResponse = {
      totalEarnings: lessonTransactions.reduce((sum, t) => sum + t.instructorPayout, 0),
      pendingPayouts: pending.reduce((sum, t) => sum + t.instructorPayout, 0),
      thisWeekEarnings: thisWeekTotal,
      lastWeekEarnings: lastWeekTotal,
      thisMonthEarnings: thisMonthTotal,
      scheduledTotal: scheduledBookings.reduce((sum, b) => sum + (b.instructorPayout || 0), 0),
      scheduledCount: scheduledBookings.length,
      transactionCount: lessonTransactions.length
    };

    console.log('   GET /api/instructor/earnings would return:');
    console.log(JSON.stringify(apiResponse, null, 2));
    console.log('');

    // Weekly receipt test
    if (weekMap.size > 0) {
      console.log('📄 WEEKLY RECEIPT TEST');
      console.log('─────────────────────────────────────────────────────────\n');

      const [firstWeekKey] = Array.from(weekMap.keys());
      console.log(`   Test receipt API endpoint:`);
      console.log(`   GET /api/instructor/receipts/weekly?weekStart=${firstWeekKey}\n`);
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Analysis Complete!');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('🌐 To test in browser:');
    console.log(`   1. Login with: ${user.email}`);
    console.log('   2. Go to: /dashboard/earnings');
    console.log('   3. Verify the following:');
    console.log(`      - This Week shows: $${thisWeekTotal.toFixed(2)}`);
    console.log(`      - Last Week shows: $${lastWeekTotal.toFixed(2)}`);
    console.log(`      - This Month shows: $${thisMonthTotal.toFixed(2)}`);
    console.log(`      - Scheduled shows: $${apiResponse.scheduledTotal.toFixed(2)}`);
    console.log('   4. Click on a lesson to test booking link');
    console.log('   5. Expand a week and click "Download Weekly Receipt"\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testBirhaneEarnings();
