const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugWeekCalculation() {
  console.log('🔍 Debugging Week Calculation Issue\n');
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
    console.log(`Testing for: ${user.instructor.name}\n`);

    // Get transactions
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

    console.log(`Total completed transactions: ${transactions.length}`);
    console.log(`Lesson transactions: ${lessonTransactions.length}\n`);

    // Simulate frontend logic EXACTLY
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

    console.log('📅 Date References:');
    console.log(`   Today: ${now.toISOString()}`);
    console.log(`   Current Week Start: ${currentWeekStart.toISOString()}`);
    console.log(`   Last Week Start: ${lastWeekStart.toISOString()}\n`);

    const currentWeekKey = currentWeekStart.toISOString().split('T')[0];
    const lastWeekKey = lastWeekStart.toISOString().split('T')[0];

    console.log('   Week Keys:');
    console.log(`   Current: ${currentWeekKey}`);
    console.log(`   Last: ${lastWeekKey}\n`);

    // Group transactions
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

    console.log('📊 Grouped Weeks:\n');
    weekMap.forEach((transactions, weekKey) => {
      const weekStart = new Date(weekKey);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const totalNet = transactions.reduce((sum, t) => sum + t.instructorPayout, 0);
      
      const weekStartKey = weekStart.toISOString().split('T')[0];
      const isCurrentWeek = weekStartKey === currentWeekKey;
      const isLastWeek = weekStartKey === lastWeekKey;

      console.log(`   Week Key: ${weekKey}`);
      console.log(`   Week Start: ${weekStart.toISOString()}`);
      console.log(`   Week Start Key: ${weekStartKey}`);
      console.log(`   Is Current Week: ${isCurrentWeek} (comparing ${weekStartKey} === ${currentWeekKey})`);
      console.log(`   Is Last Week: ${isLastWeek} (comparing ${weekStartKey} === ${lastWeekKey})`);
      console.log(`   Transactions: ${transactions.length}`);
      console.log(`   Total Net: $${totalNet.toFixed(2)}`);
      console.log('');
    });

    // Find weeks
    const weeks = [];
    weekMap.forEach((transactions, weekKey) => {
      const weekStart = new Date(weekKey);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const totalNet = transactions.reduce((sum, t) => sum + t.instructorPayout, 0);
      
      const weekStartKey = weekStart.toISOString().split('T')[0];
      const isCurrentWeek = weekStartKey === currentWeekKey;
      const isLastWeek = weekStartKey === lastWeekKey;

      weeks.push({
        weekKey,
        weekStartKey,
        isCurrentWeek,
        isLastWeek,
        totalNet,
        transactionCount: transactions.length
      });
    });

    const thisWeek = weeks.find(w => w.isCurrentWeek);
    const lastWeek = weeks.find(w => w.isLastWeek);

    console.log('🎯 Final Results:');
    console.log(`   This Week: ${thisWeek ? `$${thisWeek.totalNet.toFixed(2)}` : 'NOT FOUND'}`);
    console.log(`   Last Week: ${lastWeek ? `$${lastWeek.totalNet.toFixed(2)}` : 'NOT FOUND'}\n`);

    if (!lastWeek) {
      console.log('❌ PROBLEM: Last week not found in grouped weeks!');
      console.log('   This means the week key comparison is failing.\n');
      
      console.log('   Available week keys:');
      weeks.forEach(w => {
        console.log(`      ${w.weekKey} (${w.transactionCount} transactions, $${w.totalNet.toFixed(2)})`);
      });
      console.log('');
      console.log(`   Looking for: ${lastWeekKey}`);
      console.log('');
    }

    // Check transaction dates
    console.log('📋 Transaction Dates:');
    lessonTransactions.slice(0, 10).forEach(t => {
      const date = new Date(t.createdAt);
      const weekStart = getWeekStart(date);
      const weekKey = weekStart.toISOString().split('T')[0];
      console.log(`   ${date.toISOString()} -> Week: ${weekKey}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

debugWeekCalculation();
