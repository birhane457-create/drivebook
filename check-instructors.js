const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkInstructors() {
  try {
    const count = await prisma.instructor.count();
    console.log('Total instructors:', count);
    
    if (count > 0) {
      const instructors = await prisma.instructor.findMany({
        select: {
          id: true,
          name: true,
          isActive: true,
          approvalStatus: true,
          serviceAreas: true,
          baseAddress: true
        }
      });
      console.log('\nInstructors:');
      instructors.forEach(i => {
        console.log(`- ${i.name} (${i.id})`);
        console.log(`  Active: ${i.isActive}, Status: ${i.approvalStatus}`);
        console.log(`  Service Areas: ${i.serviceAreas || 'Not set'}`);
        console.log(`  Base Address: ${i.baseAddress || 'Not set'}`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkInstructors();
