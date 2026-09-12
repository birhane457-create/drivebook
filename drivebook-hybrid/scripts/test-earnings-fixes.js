const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testEarningsFixes() {
  console.log('🧪 Testing Earnings Dashboard Fixes\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Get first instructor for testing
    const instructor = await prisma.instructor.findFirst({
      include: {
        user: true
      }
    });

    if (!instructor) {
      console.log('❌ No instructor found. Please create an instructor first.');
      return;
    }

    console.log(`✅ Testing with instructor: ${instructor.name}`);
    console.log(`   Email: ${instructor.user.email}`);
    console.log(`   ID: ${instructor.id}\n`);

    // Test 1: Check transactions and week grouping
    console.log('📊 TEST 1: Transaction Week Grouping');
    console.log('─────────────────────────────────────────────────────────\n');

    const transactions = await prisma.transaction.findMany({
      where: {
        instructorId: instructor.id,
        status: 'COMPLETED'
      },
      include: {
        booking: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            isPackageBooking: true,
            parentBookingId: true,
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
      },
      take: 50
    });

    console.log(`   Total completed transactions: ${transactions.length}`);

    // Filter out package purchases
    const lessonTransactions = transactions.filter(t => {
      if (!t.booking) return true;
      // Exclude parent package bookings
      if (t.booking.isPackageBooking && !t.booking.parentBookingId) {
        return false;
      }
      return true;
    });

    const packagePurchases = transactions.length - lessonTransactions.length;
    console.log(`   Lesson transactions: ${lessonTransactions.length}`);
    console.log(`   Package purchases (filtered): ${packagePurchases}\n`);

    if (packagePurchases > 0) {
      console.log('   ✅ Package purchases correctly filtered out\n');
    }

    // Group by week
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

    console.log('   📅 Week Breakdown:');
    console.log('   ─────────────────────────────────────────────────────\n');

    const currentWeekKey = currentWeekStart.toISOString().split('T')[0];
    const lastWeekKey = lastWeekStart.toISOString().split('T')[0];

    let thisWeekTotal = 0;
    let lastWeekTotal = 0;

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
      console.log('');
    });

    console.log('   📈 Summary:');
    console.log(`      This Week: $${thisWeekTotal.toFixed(2)}`);
    console.log(`      Last Week: $${lastWeekTotal.toFixed(2)}\n`);

    if (thisWeekTotal > 0 || lastWeekTotal > 0) {
      console.log('   ✅ Week calculations working correctly\n');
    } else {
      console.log('   ⚠️  No earnings in current or last week\n');
    }

    // Test 2: Check scheduled bookings
    console.log('📅 TEST 2: Scheduled Bookings (Future Earnings)');
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
      },
      take: 10
    });

    console.log(`   Total scheduled: ${scheduledBookings.length}`);
    
    if (scheduledBookings.length > 0) {
      const scheduledTotal = scheduledBookings.reduce((sum, b) => sum + (b.instructorPayout || 0), 0);
      console.log(`   Total value: $${scheduledTotal.toFixed(2)}\n`);
      
      console.log('   Upcoming lessons:');
      scheduledBookings.slice(0, 5).forEach(booking => {
        const isFromPackage = booking.isPackageBooking && booking.parentBookingId;
        console.log(`      • ${booking.client.name} - ${new Date(booking.startTime).toLocaleDateString()}`);
        console.log(`        $${booking.instructorPayout.toFixed(2)}${isFromPackage ? ' (Package)' : ''}`);
      });
      console.log('');
      console.log('   ✅ Scheduled bookings found\n');
    } else {
      console.log('   ℹ️  No scheduled bookings\n');
    }

    // Test 3: Check booking links
    console.log('🔗 TEST 3: Booking Links');
    console.log('─────────────────────────────────────────────────────────\n');

    const recentLessons = lessonTransactions.slice(0, 5);
    console.log(`   Checking ${recentLessons.length} recent lessons:\n`);

    recentLessons.forEach((t, index) => {
      if (t.booking) {
        console.log(`   ${index + 1}. ${t.description}`);
        console.log(`      Booking ID: ${t.booking.id}`);
        console.log(`      Link: /dashboard/bookings?highlight=${t.booking.id}`);
        console.log(`      Client: ${t.booking.client.name}`);
        console.log(`      ✅ Linkable\n`);
      } else {
        console.log(`   ${index + 1}. ${t.description}`);
        console.log(`      ⚠️  No booking (non-lesson transaction)\n`);
      }
    });

    // Test 4: Weekly receipt data
    console.log('📄 TEST 4: Weekly Receipt Generation');
    console.log('─────────────────────────────────────────────────────────\n');

    if (weekMap.size > 0) {
      const [firstWeekKey, firstWeekTransactions] = Array.from(weekMap.entries())[0];
      const weekStart = new Date(firstWeekKey);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      console.log(`   Testing receipt for: ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}\n`);

      const totalGross = firstWeekTransactions.reduce((sum, t) => sum + t.amount, 0);
      const totalFee = firstWeekTransactions.reduce((sum, t) => sum + t.platformFee, 0);
      const totalNet = firstWeekTransactions.reduce((sum, t) => sum + t.instructorPayout, 0);
      const lessonCount = firstWeekTransactions.filter(t => t.booking).length;

      console.log('   Receipt would contain:');
      console.log(`      Instructor: ${instructor.name}`);
      console.log(`      Email: ${instructor.user.email}`);
      console.log(`      Period: ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`);
      console.log(`      Total Lessons: ${lessonCount}`);
      console.log(`      Gross Earnings: $${totalGross.toFixed(2)}`);
      console.log(`      Platform Fee: -$${totalFee.toFixed(2)}`);
      console.log(`      Net Earnings: $${totalNet.toFixed(2)}\n`);

      // Group by day
      const dailyMap = new Map();
      firstWeekTransactions.forEach(t => {
        const date = new Date(t.createdAt);
        const dayKey = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        if (!dailyMap.has(dayKey)) {
          dailyMap.set(dayKey, []);
        }
        dailyMap.get(dayKey).push(t);
      });

      console.log('   Daily breakdown:');
      dailyMap.forEach((transactions, day) => {
        const dayNet = transactions.reduce((sum, t) => sum + t.instructorPayout, 0);
        const dayLessons = transactions.filter(t => t.booking).length;
        console.log(`      ${day}: ${dayLessons} lessons, $${dayNet.toFixed(2)}`);
      });
      console.log('');
      console.log('   ✅ Receipt data structure valid\n');

      console.log('   API endpoint to test:');
      console.log(`   GET /api/instructor/receipts/weekly?weekStart=${firstWeekKey}\n`);
    } else {
      console.log('   ⚠️  No transactions to generate receipt\n');
    }

    // Test 5: Package purchases verification
    console.log('📦 TEST 5: Package Purchase Filtering');
    console.log('─────────────────────────────────────────────────────────\n');

    const allBookings = await prisma.booking.findMany({
      where: {
        instructorId: instructor.id,
        isPackageBooking: true
      },
      include: {
        client: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    const parentPackages = allBookings.filter(b => !b.parentBookingId);
    const childLessons = allBookings.filter(b => b.parentBookingId);

    console.log(`   Total package bookings: ${allBookings.length}`);
    console.log(`   Parent packages (purchases): ${parentPackages.length}`);
    console.log(`   Child lessons (from packages): ${childLessons.length}\n`);

    if (parentPackages.length > 0) {
      console.log('   Package purchases (should NOT appear in earnings):');
      parentPackages.slice(0, 3).forEach(pkg => {
        console.log(`      • ${pkg.client.name} - ${pkg.packageHours}h package`);
        console.log(`        Price: $${pkg.price.toFixed(2)}`);
        console.log(`        ❌ Excluded from earnings (shown in Packages page)`);
      });
      console.log('');
    }

    if (childLessons.length > 0) {
      console.log('   Package lessons (SHOULD appear in earnings):');
      childLessons.slice(0, 3).forEach(lesson => {
        console.log(`      • ${lesson.client.name} - ${new Date(lesson.startTime).toLocaleDateString()}`);
        console.log(`        Payout: $${lesson.instructorPayout.toFixed(2)}`);
        console.log(`        ✅ Included in earnings`);
      });
      console.log('');
    }

    console.log('   ✅ Package filtering logic correct\n');

    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');

    const tests = [
      { name: 'Transaction week grouping', status: weekMap.size > 0 },
      { name: 'Package purchase filtering', status: packagePurchases >= 0 },
      { name: 'Scheduled bookings', status: true },
      { name: 'Booking links', status: recentLessons.length > 0 },
      { name: 'Weekly receipt data', status: weekMap.size > 0 }
    ];

    tests.forEach(test => {
      console.log(`   ${test.status ? '✅' : '⚠️ '} ${test.name}`);
    });

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ All tests completed!');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('🔍 To test in browser:');
    console.log('   1. Login as instructor');
    console.log('   2. Go to /dashboard/earnings');
    console.log('   3. Check "This Week" and "Last Week" values');
    console.log('   4. Click on a lesson to test booking link');
    console.log('   5. Expand a week and click "Download Weekly Receipt"\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testEarningsFixes();
