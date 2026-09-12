const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migratePreferredInstructor() {
  console.log('🔄 Migrating Preferred Instructor for Existing Clients\n');
  
  try {
    // Get all clients without preferredInstructorId
    const clients = await prisma.client.findMany({
      where: {
        preferredInstructorId: null
      },
      include: {
        instructor: { select: { name: true } }
      }
    });

    console.log(`Found ${clients.length} clients without preferred instructor\n`);

    let updated = 0;
    for (const client of clients) {
      // Set preferredInstructorId to their current instructorId
      await prisma.client.update({
        where: { id: client.id },
        data: {
          preferredInstructorId: client.instructorId
        }
      });

      console.log(`✓ ${client.name} → Preferred: ${client.instructor.name}`);
      updated++;
    }

    console.log(`\n✅ Updated ${updated} clients with preferred instructor`);

  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migratePreferredInstructor();
