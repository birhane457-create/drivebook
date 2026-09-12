const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAvailability() {
  try {
    // Get a sample booking to test with
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
            hourlyRate: true
          }
        },
        client: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    if (!booking) {
      console.log('No upcoming bookings found');
      return;
    }

    console.log('=== SAMPLE BOOKING ===');
    console.log(`Booking ID: ${booking.id}`);
    console.log(`Client: ${booking.client.name} (${booking.client.email})`);
    console.log(`Instructor: ${booking.instructor.name} (ID: ${booking.instructor.id})`);
    console.log(`Hourly Rate: $${booking.instructor.hourlyRate}`);
    console.log(`Start Time: ${booking.startTime}`);
    console.log(`End Time: ${booking.endTime}`);
    console.log(`Duration: ${(new Date(booking.endTime) - new Date(booking.startTime)) / (1000 * 60)} minutes`);
    console.log(`Price: $${booking.price}`);
    console.log(`Status: ${booking.status}`);
    console.log('\n');

    // Test availability API parameters
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    
    console.log('=== TEST AVAILABILITY API ===');
    console.log(`URL: /api/availability/slots?instructorId=${booking.instructor.id}&date=${dateStr}&duration=60&excludeBookingId=${booking.id}`);
    console.log('\nYou can test this in your browser or with curl');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAvailability();
