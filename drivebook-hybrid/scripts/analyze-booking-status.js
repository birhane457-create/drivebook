const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeBookingStatus() {
  try {
    console.log('Analyzing booking status for admin@church.org...\n');

    const user = await prisma.user.findUnique({
      where: { email: 'admin@church.org' },
      include: {
        clients: true,
        wallet: true
      }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    const clientIds = user.clients.map(c => c.id);

    // Get all bookings
    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { userId: user.id },
          { clientId: { in: clientIds } }
        ]
      },
      include: {
        instructor: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📊 Total bookings: ${bookings.length}\n`);

    // Group by status
    const byStatus = {};
    bookings.forEach(b => {
      if (!byStatus[b.status]) byStatus[b.status] = [];
      byStatus[b.status].push(b);
    });

    console.log('📋 Bookings by status:');
    Object.keys(byStatus).forEach(status => {
      console.log(`   ${status}: ${byStatus[status].length}`);
    });

    console.log('\n💳 Payment status:');
    const paid = bookings.filter(b => b.isPaid);
    const unpaid = bookings.filter(b => !b.isPaid);
    console.log(`   Paid: ${paid.length}`);
    console.log(`   Unpaid: ${unpaid.length}`);

    console.log('\n📦 Package bookings:');
    const packageBookings = bookings.filter(b => b.isPackageBooking);
    const childBookings = bookings.filter(b => b.parentBookingId);
    const regularBookings = bookings.filter(b => !b.isPackageBooking && !b.parentBookingId);
    console.log(`   Package (parent): ${packageBookings.length}`);
    console.log(`   Child (from package): ${childBookings.length}`);
    console.log(`   Regular: ${regularBookings.length}`);

    // Analyze each booking
    console.log('\n📝 Detailed booking analysis:\n');
    bookings.forEach((b, i) => {
      console.log(`${i + 1}. Booking ID: ${b.id.substring(0, 8)}...`);
      console.log(`   Instructor: ${b.instructor.name}`);
      console.log(`   Status: ${b.status}`);
      console.log(`   isPaid: ${b.isPaid}`);
      console.log(`   Price: $${b.price}`);
      console.log(`   Created: ${b.createdAt.toISOString()}`);
      console.log(`   Start: ${b.startTime.toISOString()}`);
      console.log(`   Is Package: ${b.isPackageBooking}`);
      console.log(`   Parent Booking: ${b.parentBookingId || 'None'}`);
      console.log(`   Payment Intent: ${b.paymentIntentId || 'None'}`);
      
      // Explain status
      if (b.status === 'PENDING' && !b.isPaid) {
        console.log(`   ⚠️  REASON: Created but payment never completed`);
      } else if (b.status === 'PENDING' && b.isPaid) {
        console.log(`   ⚠️  ANOMALY: Paid but still PENDING (should be CONFIRMED)`);
      } else if (b.status === 'CONFIRMED' && b.isPaid) {
        console.log(`   ✅ NORMAL: Paid and confirmed, waiting for lesson date`);
      } else if (b.status === 'CONFIRMED' && !b.isPaid && b.parentBookingId) {
        console.log(`   ✅ NORMAL: Child booking from package (no direct payment)`);
      } else if (b.status === 'COMPLETED') {
        console.log(`   ✅ NORMAL: Lesson completed`);
      }
      console.log('');
    });

    // Check wallet
    if (user.wallet) {
      console.log('\n💰 Wallet Analysis:');
      console.log(`   Total Paid: $${user.wallet.totalPaid.toFixed(2)}`);
      console.log(`   Total Spent: $${user.wallet.totalSpent.toFixed(2)}`);
      console.log(`   Credits Remaining: $${user.wallet.creditsRemaining.toFixed(2)}`);
      
      // Calculate what SHOULD be spent
      const paidBookingsTotal = bookings
        .filter(b => b.isPaid && b.status !== 'CANCELLED')
        .reduce((sum, b) => sum + b.price, 0);
      
      console.log(`\n   Calculated from paid bookings: $${paidBookingsTotal.toFixed(2)}`);
      
      if (Math.abs(user.wallet.totalSpent - paidBookingsTotal) > 0.01) {
        console.log(`   ⚠️  Mismatch: Wallet shows $${user.wallet.totalSpent.toFixed(2)} but bookings total $${paidBookingsTotal.toFixed(2)}`);
      }
    }

    // Check transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        bookingId: { in: bookings.map(b => b.id) }
      }
    });

    console.log(`\n💳 Transactions: ${transactions.length}`);
    transactions.forEach((t, i) => {
      console.log(`\n${i + 1}. Transaction ID: ${t.id.substring(0, 8)}...`);
      console.log(`   Booking ID: ${t.bookingId.substring(0, 8)}...`);
      console.log(`   Amount: $${t.amount}`);
      console.log(`   Status: ${t.status}`);
      console.log(`   Payment Intent: ${t.stripePaymentIntentId || 'None'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeBookingStatus();
