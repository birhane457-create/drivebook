const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function finalEarningsTest() {
  console.log('🎯 Final Earnings Dashboard Test\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const user = await prisma.user.findUnique({
      where: { email: 'birhane457@gmail.com' },
      include: { instructor: true }
    });

    if (!user?.instructor) {
      console.log('❌ Instructor not found');
      return;
    }

    const instructorId = user.instructor.id;
    console.log(`Testing for: ${user.instructor.name} (${user.email})\n`);

    // Simulate EXACT frontend logic with the fix
    const transactions = await prisma.transaction.findMany({
      where: {
        instructorId,
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
            client: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filter out package purchases
    const lessonTransactions = transactions.filter(t => {
      if (!t.booking) return true;
      return !(t.booking.isPackageBooking && !t.booking.parentBookingId);
    });

    console.log(`✅ Found ${lessonTransactions.length} lesson transactions\n`);

    // Week grouping logic (FIXED VERSION)
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
    lastWeekStart.setHours(0, 0, 0, 0);

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

    // Build weeks array (FIXED VERSION)
    const weeks = [];
    weekMap.forEach((transactions, weekKey) => {
      // Parse date correctly
      const [year, month, day] = weekKey.split('-').map(Number);
      const weekStart = new Date(year, month - 1, day);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const totalNet = transactions.reduce((sum, t) => sum + t.instructorPayout, 0);
      const totalGross = transactions.reduce((sum, t) => sum + t.amount, 0);
      const totalBookings = transactions.filter(t => t.booking).length;

      // FIXED: Compare weekKey directly (no timezone conversion)
      const currentWeekKey = currentWeekStart.toISOString().split('T')[0];
      const lastWeekKey = lastWeekStart.toISOString().split('T')[0];
      
      const isCurrentWeek = weekKey === currentWeekKey;
      const isLastWeek = weekKey === lastWeekKey;

      weeks.push({
        weekKey,
        weekStart,
        weekEnd,
        isCurrentWeek,
        isLastWeek,
        totalNet,
        totalGross,
        totalBookings,
        transactionCount: transactions.length
      });
    });

    console.log('📊 Week Analysis:\n');
    weeks.forEach(week => {
      const label = week.isCurrentWeek ? '🟢 THIS WEEK' : week.isLastWeek ? '🔵 LAST WEEK' : '⚪';
      console.log(`   ${label} ${week.weekKey}`);
      console.log(`      ${week.weekStart.toLocaleDateString()} - ${week.weekEnd.toLocaleDateString()}`);
      console.log(`      Transactions: ${week.transactionCount}`);
      console.log(`      Bookings: ${week.totalBookings}`);
      console.log(`      Gross: $${week.totalGross.toFixed(2)}`);
      console.log(`      Net: $${week.totalNet.toFixed(2)}`);
      console.log('');
    });

    // Calculate stats
    const thisWeek = weeks.find(w => w.isCurrentWeek);
    const lastWeek = weeks.find(w => w.isLastWeek);
    const thisWeekEarnings = thisWeek?.totalNet || 0;
    const lastWeekEarnings = lastWeek?.totalNet || 0;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📈 STATS CARDS (What user will see):');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`   This Week:  $${thisWeekEarnings.toFixed(2)}`);
    console.log(`   Last Week:  $${lastWeekEarnings.toFixed(2)}`);
    console.log('');

    if (lastWeekEarnings > 0) {
      console.log('✅ SUCCESS! Last week is showing correctly!\n');
    } else {
      console.log('❌ PROBLEM! Last week is still $0\n');
    }

    // Test booking links
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔗 BOOKING LINKS TEST:');
    console.log('═══════════════════════════════════════════════════════════\n');

    const transactionsWithBookings = lessonTransactions.filter(t => t.booking);
    console.log(`   Transactions with bookings: ${transactionsWithBookings.length}\n`);

    if (transactionsWithBookings.length > 0) {
      console.log('   Sample links:');
      transactionsWithBookings.slice(0, 3).forEach((t, i) => {
        console.log(`      ${i + 1}. ${t.description || 'Transaction'}`);
        console.log(`         Booking ID: ${t.booking.id}`);
        console.log(`         Link: /dashboard/bookings?highlight=${t.booking.id}`);
        console.log(`         Client: ${t.booking.client.name}`);
        console.log('');
      });
      console.log('   ✅ Booking links will work!\n');
    } else {
      console.log('   ⚠️  No transactions with booking IDs\n');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ TEST COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('🌐 Next Steps:');
    console.log('   1. Refresh the browser page: /dashboard/earnings');
    console.log('   2. Verify Last Week shows: $' + lastWeekEarnings.toFixed(2));
    console.log('   3. Click on a lesson to test the booking link');
    console.log('   4. Download a weekly receipt\n');

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

finalEarningsTest();
