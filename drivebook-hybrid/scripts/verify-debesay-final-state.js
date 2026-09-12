const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyFinalState() {
  console.log('🔍 Verifying Debesay Birhane Final State\n');

  try {
    // Find the instructor
    const instructor = await prisma.instructor.findFirst({
      where: { 
        user: { email: 'birhane457@gmail.com' }
      },
      include: {
        user: true,
        bookings: {
          include: {
            client: true
          },
          orderBy: { startTime: 'asc' }
        }
      }
    });

    if (!instructor) {
      console.log('❌ Instructor not found\n');
      return;
    }

    console.log('👤 Instructor: Debesay Birhane');
    console.log(`   Email: ${instructor.user.email}`);
    console.log(`   Total Bookings: ${instructor.bookings.length}\n`);

    // Categorize bookings
    const categories = {
      completed: [],
      confirmed: [],
      pendingWithPrice: [],
      pendingZeroPrice: [],
      cancelled: []
    };

    for (const booking of instructor.bookings) {
      if (booking.status === 'COMPLETED') {
        categories.completed.push(booking);
      } else if (booking.status === 'CONFIRMED') {
        categories.confirmed.push(booking);
      } else if (booking.status === 'PENDING' && booking.price > 0) {
        categories.pendingWithPrice.push(booking);
      } else if (booking.status === 'PENDING' && booking.price === 0) {
        categories.pendingZeroPrice.push(booking);
      } else if (booking.status === 'CANCELLED') {
        categories.cancelled.push(booking);
      }
    }

    console.log('📊 Booking Breakdown:\n');
    console.log(`   ✅ COMPLETED: ${categories.completed.length}`);
    console.log(`   ✓  CONFIRMED: ${categories.confirmed.length}`);
    console.log(`   ⏳ PENDING (with price): ${categories.pendingWithPrice.length}`);
    console.log(`   📦 PENDING ($0 - package children): ${categories.pendingZeroPrice.length}`);
    console.log(`   ❌ CANCELLED: ${categories.cancelled.length}\n`);

    // Show zero price bookings details
    if (categories.pendingZeroPrice.length > 0) {
      console.log('📦 Zero Price PENDING Bookings (Package Children):\n');
      for (const booking of categories.pendingZeroPrice) {
        console.log(`   ${booking.id}`);
        console.log(`      Date: ${booking.startTime.toLocaleString()}`);
        console.log(`      Client: ${booking.client?.name}`);
        console.log(`      Parent: ${booking.parentBookingId || 'None'}`);
        
        if (booking.parentBookingId) {
          const parent = await prisma.booking.findUnique({
            where: { id: booking.parentBookingId }
          });
          if (parent) {
            console.log(`      Parent Price: $${parent.price}`);
            console.log(`      Parent Hours: ${parent.packageHours}`);
            console.log(`      Parent Status: ${parent.packageStatus}`);
          }
        }
        console.log('');
      }
    }

    // Calculate revenue
    const totalRevenue = instructor.bookings.reduce((sum, b) => sum + b.price, 0);
    const completedRevenue = categories.completed.reduce((sum, b) => sum + b.price, 0);
    const pendingRevenue = categories.pendingWithPrice.reduce((sum, b) => sum + b.price, 0);

    console.log('💰 Revenue Summary:\n');
    console.log(`   Total Revenue (all bookings): $${totalRevenue.toFixed(2)}`);
    console.log(`   Completed Revenue: $${completedRevenue.toFixed(2)}`);
    console.log(`   Pending Revenue: $${pendingRevenue.toFixed(2)}\n`);

    // Show recent bookings
    console.log('📅 Recent Bookings (last 5):\n');
    const recentBookings = instructor.bookings.slice(-5).reverse();
    for (const booking of recentBookings) {
      console.log(`   ${booking.status.padEnd(10)} | $${booking.price.toString().padEnd(8)} | ${booking.startTime.toLocaleDateString()}`);
    }
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyFinalState();
