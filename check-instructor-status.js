const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkInstructorStatus() {
  try {
    const total = await prisma.instructor.count();
    console.log('Total instructors:', total);
    
    const active = await prisma.instructor.count({
      where: { isActive: true }
    });
    console.log('Active instructors:', active);
    
    const approved = await prisma.instructor.count({
      where: { approvalStatus: 'APPROVED' }
    });
    console.log('Approved instructors:', approved);
    
    const activeAndApproved = await prisma.instructor.count({
      where: {
        isActive: true,
        approvalStatus: 'APPROVED'
      }
    });
    console.log('Active AND Approved instructors:', activeAndApproved);
    
    console.log('\nAll instructors status:');
    const all = await prisma.instructor.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        approvalStatus: true
      }
    });
    
    all.forEach(i => {
      console.log(`- ${i.name}: Active=${i.isActive}, Status=${i.approvalStatus}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkInstructorStatus();
