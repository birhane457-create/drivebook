const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkInstructorUsers() {
  try {
    console.log('Checking instructor user accounts...\n');
    
    const instructors = await prisma.instructor.findMany();
    
    console.log(`Total instructors: ${instructors.length}\n`);
    
    for (const instructor of instructors) {
      console.log(`Instructor: ${instructor.name}`);
      console.log(`  ID: ${instructor.id}`);
      console.log(`  Email: ${instructor.email || 'Not set'}`);
      console.log(`  User ID: ${instructor.userId || 'Not linked'}`);
      
      if (instructor.userId) {
        const user = await prisma.user.findUnique({
          where: { id: instructor.userId }
        });
        
        if (user) {
          console.log(`  User Email: ${user.email}`);
          console.log(`  User Role: ${user.role}`);
          console.log(`  Has Password: ${user.password ? 'Yes' : 'No'}`);
          console.log(`  Email Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
        } else {
          console.log(`  ⚠️  User ID exists but user not found!`);
        }
      } else {
        console.log(`  ⚠️  No user account linked!`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkInstructorUsers();
