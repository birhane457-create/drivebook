const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkInstructorWorkingHours() {
  try {
    const instructors = await prisma.instructor.findMany({
      select: {
        id: true,
        name: true,
        workingHours: true,
        hourlyRate: true,
        user: {
          select: {
            email: true
          }
        }
      }
    });

    console.log('=== INSTRUCTORS AND WORKING HOURS ===\n');
    
    for (const instructor of instructors) {
      console.log(`Instructor: ${instructor.name} (${instructor.user.email})`);
      console.log(`ID: ${instructor.id}`);
      console.log(`Hourly Rate: $${instructor.hourlyRate}`);
      console.log(`Working Hours:`, JSON.stringify(instructor.workingHours, null, 2));
      console.log('---\n');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkInstructorWorkingHours();
