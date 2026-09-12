const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAvailability() {
  try {
    // Get first active instructor
    const instructor = await prisma.instructor.findFirst({
      where: { 
        isActive: true,
        approvalStatus: 'APPROVED'
      },
      select: {
        id: true,
        name: true,
        workingHours: true,
        allowedDurations: true,
        bookingBufferMinutes: true,
        enableTravelTime: true,
        travelTimeMinutes: true
      }
    });

    if (!instructor) {
      console.log('No approved instructors found');
      return;
    }

    console.log('\n=== Instructor Details ===');
    console.log('Name:', instructor.name);
    console.log('ID:', instructor.id);
    console.log('Working Hours:', JSON.stringify(instructor.workingHours, null, 2));
    console.log('Allowed Durations:', instructor.allowedDurations);
    console.log('Buffer Minutes:', instructor.bookingBufferMinutes);
    console.log('Travel Time Enabled:', instructor.enableTravelTime);
    console.log('Travel Time Minutes:', instructor.travelTimeMinutes);

    // Test for today
    const today = new Date();
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()];
    
    console.log('\n=== Today ===');
    console.log('Date:', today.toDateString());
    console.log('Day:', dayName);
    
    if (instructor.workingHours && instructor.workingHours[dayName]) {
      console.log('Working hours for today:', instructor.workingHours[dayName]);
    } else {
      console.log('❌ No working hours configured for', dayName);
    }

    // Check for existing bookings
    const bookings = await prisma.booking.findMany({
      where: {
        instructorId: instructor.id,
        startTime: {
          gte: new Date(today.setHours(0, 0, 0, 0)),
          lt: new Date(today.setHours(23, 59, 59, 999))
        }
      },
      select: {
        startTime: true,
        endTime: true,
        status: true
      }
    });

    console.log('\n=== Bookings Today ===');
    if (bookings.length === 0) {
      console.log('No bookings for today');
    } else {
      bookings.forEach(booking => {
        console.log(`${booking.startTime.toLocaleTimeString()} - ${booking.endTime.toLocaleTimeString()} (${booking.status})`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAvailability();
