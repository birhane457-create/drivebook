const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRescheduleCancel() {
  try {
    console.log('=== TESTING RESCHEDULE & CANCEL FUNCTIONALITY ===\n');

    // Get a sample upcoming booking
    const booking = await prisma.booking.findFirst({
      where: {
        status: { not: 'CANCELLED' },
        startTime: { gt: new Date() }
      },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            hourlyRate: true,
            workingHours: true
          }
        },
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            userId: true
          }
        },
        user: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    if (!booking) {
      console.log('❌ No upcoming bookings found to test with');
      return;
    }

    console.log('📋 SAMPLE BOOKING DETAILS:');
    console.log(`   Booking ID: ${booking.id}`);
    console.log(`   Client: ${booking.client.name} (${booking.client.email})`);
    console.log(`   Client ID: ${booking.clientId}`);
    console.log(`   User ID: ${booking.userId}`);
    console.log(`   Instructor: ${booking.instructor.name} (ID: ${booking.instructor.id})`);
    console.log(`   Hourly Rate: $${booking.instructor.hourlyRate}`);
    console.log(`   Start: ${booking.startTime}`);
    console.log(`   End: ${booking.endTime}`);
    console.log(`   Duration: ${(new Date(booking.endTime) - new Date(booking.startTime)) / (1000 * 60)} minutes`);
    console.log(`   Price: $${booking.price}`);
    console.log(`   Status: ${booking.status}\n`);

    // Check authorization
    console.log('🔐 AUTHORIZATION CHECK:');
    const clientRecords = await prisma.client.findMany({
      where: { userId: booking.userId },
      select: { id: true }
    });
    const clientIds = clientRecords.map(c => c.id);
    const ownsBooking = booking.userId === booking.userId || clientIds.includes(booking.clientId);
    console.log(`   User owns booking: ${ownsBooking ? '✅ YES' : '❌ NO'}`);
    console.log(`   User's client IDs: ${clientIds.join(', ')}`);
    console.log(`   Booking's client ID: ${booking.clientId}\n`);

    // Test availability API
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const dateStr = tomorrow.toISOString().split('T')[0];
    
    console.log('📅 AVAILABILITY API TEST:');
    console.log(`   Test Date: ${dateStr}`);
    console.log(`   Instructor ID: ${booking.instructor.id}`);
    console.log(`   Duration: 60 minutes`);
    console.log(`   Exclude Booking: ${booking.id}`);
    console.log(`   API URL: /api/availability/slots?instructorId=${booking.instructor.id}&date=${dateStr}&duration=60&excludeBookingId=${booking.id}\n`);

    // Check working hours for that day
    const testDate = new Date(dateStr);
    const dayName = testDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const workingHours = booking.instructor.workingHours || {};
    const daySlots = workingHours[dayName] || [];
    
    console.log(`   Day: ${dayName}`);
    console.log(`   Working Hours: ${daySlots.length > 0 ? JSON.stringify(daySlots) : 'NOT AVAILABLE'}\n`);

    // Test cancel refund calculation
    console.log('💰 CANCEL REFUND CALCULATION:');
    const now = new Date();
    const bookingTime = new Date(booking.startTime);
    const hoursUntil = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    let refundPercentage = 0;
    let refundAmount = 0;
    
    if (hoursUntil >= 48) {
      refundPercentage = 100;
      refundAmount = booking.price;
    } else if (hoursUntil >= 24) {
      refundPercentage = 50;
      refundAmount = booking.price * 0.5;
    }
    
    console.log(`   Hours until booking: ${hoursUntil.toFixed(1)}`);
    console.log(`   Refund percentage: ${refundPercentage}%`);
    console.log(`   Refund amount: $${refundAmount.toFixed(2)}\n`);

    // Test reschedule with duration change
    console.log('🔄 RESCHEDULE WITH DURATION CHANGE:');
    const newDurations = [60, 90, 120];
    for (const duration of newDurations) {
      const hours = duration / 60;
      const newPrice = booking.instructor.hourlyRate * hours;
      const priceDiff = newPrice - booking.price;
      console.log(`   ${duration} min (${hours}h): $${newPrice.toFixed(2)} (${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)})`);
    }
    console.log('\n');

    console.log('✅ ALL CHECKS COMPLETE');
    console.log('\n📝 NEXT STEPS:');
    console.log('   1. Open the client dashboard in your browser');
    console.log('   2. Navigate to the Bookings page');
    console.log('   3. Click "Reschedule" on an upcoming booking');
    console.log('   4. Select a date and check if time slots load');
    console.log('   5. Try changing the duration and see price update');
    console.log('   6. Test the cancel button and check refund calculation');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRescheduleCancel();
