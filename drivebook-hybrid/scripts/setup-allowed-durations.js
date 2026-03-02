const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupAllowedDurations() {
  try {
    console.log('\n=== Setting Up Allowed Durations for Instructors ===\n');

    // Default: Allow 1-hour and 2-hour lessons
    const defaultDurations = [60, 120];

    // Get all active instructors
    const instructors = await prisma.instructor.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        allowedDurations: true
      }
    });

    console.log(`Found ${instructors.length} active instructors\n`);

    let updated = 0;
    for (const instructor of instructors) {
      // Check if allowedDurations is empty
      if (!instructor.allowedDurations || instructor.allowedDurations.length === 0) {
        await prisma.instructor.update({
          where: { id: instructor.id },
          data: {
            allowedDurations: defaultDurations
          }
        });
        console.log(`✅ Set allowed durations for: ${instructor.name}`);
        updated++;
      } else {
        console.log(`⏭️  ${instructor.name} already has allowed durations: ${instructor.allowedDurations.join(', ')} minutes`);
      }
    }

    console.log(`\n✅ Updated ${updated} instructors with default allowed durations`);
    console.log('\nDefault durations:');
    console.log('  - 1 hour (60 minutes)');
    console.log('  - 2 hours (120 minutes)');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupAllowedDurations();
