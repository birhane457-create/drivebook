const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function resetPassword() {
  try {
    const email = 'birhane457@gmail.com'; // Change this to the instructor email
    const newPassword = 'password123'; // Change this to your desired password
    
    console.log(`\nResetting password for: ${email}`);
    console.log(`New password: ${newPassword}\n`);
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const user = await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    });
    
    console.log('✓ Password reset successfully!');
    console.log(`\nYou can now login with:`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${newPassword}\n`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
