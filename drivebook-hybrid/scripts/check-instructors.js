const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkInstructors() {
  try {
    const instructors = await prisma.instructor.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        approvalStatus: true
      }
    });

    console.log('\n=== Instructors in Database ===\n');
    instructors.forEach(instructor => {
      console.log(`Name: ${instructor.name}`);
      console.log(`Active: ${instructor.isActive}`);
      console.log(`Status: ${instructor.approvalStatus}`);
      console.log('---');
    });

    console.log(`\nTotal: ${instructors.length} instructors`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkInstructors();
