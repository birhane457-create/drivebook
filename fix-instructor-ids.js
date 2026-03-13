const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixInstructorIds() {
  try {
    console.log('Finding instructor users with missing instructorId...\n');
    
    const instructors = await prisma.user.findMany({
      where: {
        role: 'INSTRUCTOR'
      },
      include: {
        instructor: true
      }
    });

    console.log(`Found ${instructors.length} instructor users to fix\n`);

    for (const user of instructors) {
      if (user.instructor && !user.instructorId) {
        console.log(`Fixing user ${user.email}...`);
        console.log(`  Setting instructorId to: ${user.instructor.id}`);
        
        await prisma.user.update({
          where: { id: user.id },
          data: { instructorId: user.instructor.id }
        });
        
        console.log(`  ✓ Fixed!\n`);
      } else if (user.instructorId) {
        console.log(`✓ User ${user.email} already has instructorId\n`);
      } else {
        console.log(`⚠️  User ${user.email} has no instructor record!\n`);
      }
    }

    console.log('=== VERIFICATION ===\n');
    const fixed = await prisma.user.findMany({
      where: {
        role: 'INSTRUCTOR'
      },
      select: {
        email: true,
        instructorId: true
      }
    });

    fixed.forEach(user => {
      console.log(`${user.email}: ${user.instructorId ? '✓ Has instructorId' : '✗ Missing instructorId'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixInstructorIds();
