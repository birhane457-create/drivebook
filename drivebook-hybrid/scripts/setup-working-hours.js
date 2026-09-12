const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupWorkingHours() {
  try {
    console.log('\n=== Setting Up Working Hours for Instructors ===\n');

    // Default working hours: Monday-Friday 9:00-17:00, Saturday 9:00-13:00
    const defaultWorkingHours = {
      monday: [{ start: "09:00", end: "17:00" }],
      tuesday: [{ start: "09:00", end: "17:00" }],
      wednesday: [{ start: "09:00", end: "17:00" }],
      thursday: [{ start: "09:00", end: "17:00" }],
      friday: [{ start: "09:00", end: "17:00" }],
      saturday: [{ start: "09:00", end: "13:00" }],
      sunday: []
    };

    // Get all active instructors
    const instructors = await prisma.instructor.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        workingHours: true
      }
    });

    console.log(`Found ${instructors.length} active instructors\n`);

    let updated = 0;
    for (const instructor of instructors) {
      // Check if working hours are empty or null
      if (!instructor.workingHours || Object.keys(instructor.workingHours).length === 0) {
        await prisma.instructor.update({
          where: { id: instructor.id },
          data: {
            workingHours: defaultWorkingHours
          }
        });
        console.log(`✅ Set working hours for: ${instructor.name}`);
        updated++;
      } else {
        console.log(`⏭️  ${instructor.name} already has working hours`);
      }
    }

    console.log(`\n✅ Updated ${updated} instructors with default working hours`);
    console.log('\nDefault schedule:');
    console.log('  Monday-Friday: 9:00 AM - 5:00 PM');
    console.log('  Saturday: 9:00 AM - 1:00 PM');
    console.log('  Sunday: Closed');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupWorkingHours();
