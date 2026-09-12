const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function approveAllInstructors() {
  try {
    console.log('\n=== Approving All Active Instructors ===\n');

    // Get all active instructors
    const instructors = await prisma.instructor.findMany({
      where: { isActive: true }
    });

    console.log(`Found ${instructors.length} active instructors`);

    // Update each one individually
    let approved = 0;
    for (const instructor of instructors) {
      if (instructor.approvalStatus === 'PENDING') {
        await prisma.instructor.update({
          where: { id: instructor.id },
          data: {
            approvalStatus: 'APPROVED',
            approvedAt: new Date()
          }
        });
        console.log(`✅ Approved: ${instructor.name}`);
        approved++;
      }
    }

    console.log(`\n✅ Total approved: ${approved} instructors`);

    // Show final status
    const updated = await prisma.instructor.findMany({
      where: { isActive: true },
      select: {
        name: true,
        approvalStatus: true
      }
    });

    console.log('\n=== Final Status ===\n');
    updated.forEach(instructor => {
      console.log(`${instructor.name} - ${instructor.approvalStatus}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

approveAllInstructors();
