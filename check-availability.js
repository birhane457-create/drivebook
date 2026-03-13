const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAvailability() {
  try {
    const instructor = await prisma.instructor.findFirst({
      where: {
        name: { contains: 'Debesay' }
      }
    });

    if (!instructor) {
      console.log('No instructor found');
      return;
    }

    console.log('Instructor:', instructor.name);
    console.log('Instructor ID:', instructor.id);
    console.log('\nWorking Hours:', instructor.workingHours || 'NOT SET');
    console.log('Allowed Durations:', instructor.allowedDurations || 'NOT SET');
    console.log('Booking Buffer:', instructor.bookingBufferMinutes || 'NOT SET');

    if (!instructor.workingHours) {
      console.log('\n⚠️  No working hours configured! This is why no slots are available.');
      console.log('The instructor needs to set their availability in the dashboard.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAvailability();
