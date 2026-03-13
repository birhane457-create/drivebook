const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function resetAllPasswords() {
  try {
    const newPassword = 'password123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    console.log('\nResetting passwords for all users...\n');
    
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true
      }
    });
    
    for (const user of users) {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });
      
      console.log(`✓ Reset password for ${user.role}: ${user.email}`);
    }
    
    console.log(`\n✓ All passwords reset to: ${newPassword}\n`);
    console.log('You can now login with any account using password: password123\n');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAllPasswords();
