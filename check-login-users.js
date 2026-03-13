const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('Checking instructor and admin users...\n');
    
    // Check instructor user
    const instructorUser = await prisma.user.findUnique({
      where: { email: 'birhane457@gmail.com' },
      include: { instructor: true }
    });
    
    console.log('INSTRUCTOR USER:');
    if (instructorUser) {
      console.log('- Email:', instructorUser.email);
      console.log('- Role:', instructorUser.role);
      console.log('- InstructorId:', instructorUser.instructorId);
      console.log('- Has Password:', !!instructorUser.password);
      console.log('- Password matches "password123":', await bcrypt.compare('password123', instructorUser.password || ''));
      console.log('- Instructor record:', instructorUser.instructor ? 'EXISTS' : 'MISSING');
      if (instructorUser.instructor) {
        console.log('  - Name:', instructorUser.instructor.name);
        console.log('  - Approval Status:', instructorUser.instructor.approvalStatus);
        console.log('  - Is Active:', instructorUser.instructor.isActive);
      }
    } else {
      console.log('NOT FOUND');
    }
    
    console.log('\n---\n');
    
    // Check admin user
    const adminUser = await prisma.user.findUnique({
      where: { email: 'debesay304@gmail.com' }
    });
    
    console.log('ADMIN USER:');
    if (adminUser) {
      console.log('- Email:', adminUser.email);
      console.log('- Role:', adminUser.role);
      console.log('- Has Password:', !!adminUser.password);
      console.log('- Password matches "password123":', await bcrypt.compare('password123', adminUser.password || ''));
    } else {
      console.log('NOT FOUND');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
