/**
 * Reset Admin Password
 * 
 * This script resets the password for an existing user
 * 
 * Run with: node scripts/reset-admin-password.js email@example.com newpassword
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function resetPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error('❌ Please provide email and new password');
    console.log('\nUsage: node scripts/reset-admin-password.js email@example.com newpassword');
    console.log('Example: node scripts/reset-admin-password.js admin@example.com Admin123!');
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error('❌ Password must be at least 8 characters');
    process.exit(1);
  }

  try {
    console.log(`🔍 Looking for user: ${email}...`);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      console.log('\nAvailable options:');
      console.log('1. Check the email spelling');
      console.log('2. Create new admin: npm run create:admin');
      console.log('3. List all users in Prisma Studio: npx prisma studio');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email}`);
    console.log(`   Current role: ${user.role}`);

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and ensure SUPER_ADMIN role
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { 
        password: hashedPassword,
        role: 'SUPER_ADMIN' // Also make sure they're admin
      },
    });

    console.log('\n✅ Password reset successfully!');
    console.log(`\n📧 Email: ${updatedUser.email}`);
    console.log(`🔑 New Password: ${newPassword}`);
    console.log(`👤 Role: ${updatedUser.role}`);
    console.log(`\n🚀 You can now login:`);
    console.log(`   1. Go to: http://localhost:3000/login`);
    console.log(`   2. Email: ${email}`);
    console.log(`   3. Password: ${newPassword}`);
    console.log(`   4. Access admin: http://localhost:3000/admin`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
