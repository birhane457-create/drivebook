const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkInstructorSession() {
  try {
    // Find all instructor users
    const instructors = await prisma.user.findMany({
      where: {
        role: 'INSTRUCTOR'
      },
      select: {
        id: true,
        email: true,
        role: true,
        instructorId: true,
        instructor: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log('\n=== INSTRUCTOR USERS ===\n');
    instructors.forEach(user => {
      console.log(`Email: ${user.email}`);
      console.log(`User ID: ${user.id}`);
      console.log(`Role: ${user.role}`);
      console.log(`InstructorId field: ${user.instructorId || 'NULL'}`);
      console.log(`Instructor record:`, user.instructor || 'NULL');
      console.log('---');
    });

    if (instructors.length === 0) {
      console.log('No instructor users found!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkInstructorSession();
