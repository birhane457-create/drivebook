const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserPasswords() {
  try {
    console.log('\n=== Checking User Password Fields ===\n');
    
    // Check all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        password: true,
        instructorId: true
      }
    });

    console.log(`Found ${users.length} users\n`);

    users.forEach(user => {
      console.log(`Email: ${user.email}`);
      console.log(`Role: ${user.role}`);
      console.log(`Has Password: ${user.password ? 'YES' : 'NO'}`);
      console.log(`Password Length: ${user.password ? user.password.length : 0}`);
      console.log(`InstructorId: ${user.instructorId || 'NULL'}`);
      console.log('---');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserPasswords();
