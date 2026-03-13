const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setDefaultAvailability() {
  try {
    // Default working hours: Monday-Friday 9am-5pm, Saturday 9am-2pm
    const defaultWorkingHours = {
      monday: [{ start: '09:00', end: '17:00' }],
      tuesday: [{ start: '09:00', end: '17:00' }],
      wednesday: [{ start: '09:00', end: '17:00' }],
      thursday: [{ start: '09:00', end: '17:00' }],
      friday: [{ start: '09:00', end: '17:00' }],
      saturday: [{ start: '09:00', end: '14:00' }],
      sunday: [] // Not available on Sundays
    };

    const instructors = await prisma.instructor.findMany({
      where: {
        workingHours: null
      }
    });

    console.log(`Found ${instructors.length} instructors without working hours\n`);

    for (const instructor of instructors) {
      console.log(`Setting default availability for: ${instructor.name}`);
      
      await prisma.instructor.update({
        where: { id: instructor.id },
        data: {
          workingHours: defaultWorkingHours,
          allowedDurations: [60, 120], // 1 hour and 2 hour lessons
          bookingBufferMinutes: 15, // 15 min buffer between lessons
          enableTravelTime: true,
          travelTimeMinutes: 10 // 10 min travel time
        }
      });
      
      console.log(`  ✓ Set working hours: Mon-Fri 9am-5pm, Sat 9am-2pm`);
      console.log(`  ✓ Allowed durations: 60, 120 minutes`);
      console.log(`  ✓ Buffer time: 15 minutes`);
      console.log(`  ✓ Travel time: 10 minutes\n`);
    }

    console.log('Done! Instructors can now modify their availability in the dashboard.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setDefaultAvailability();
