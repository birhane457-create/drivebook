/**
 * Make Existing User an Admin
 * 
 * This script converts an existing user account to SUPER_ADMIN
 * 
 * Run with: node scripts/make-user-admin.js your-email@example.com
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function makeAdmin() {
  const email = process.argv[2];

  if (!email) {
    console.error('❌ Please provide an email address');
    console.log('\nUsage: node scripts/make-user-admin.js your-email@example.com');
    process.exit(1);
  }

  try {
    console.log(`🔍 Looking for user: ${email}...`);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { instructor: true },
    });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      console.log('\nMake sure the email is correct and the user exists.');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email}`);
    console.log(`   Current role: ${user.role}`);

    // Update to SUPER_ADMIN
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: 'SUPER_ADMIN' },
    });

    console.log('\n✅ User updated successfully!');
    console.log(`\n📧 Email: ${updatedUser.email}`);
    console.log(`🔑 Role: ${updatedUser.role}`);
    console.log(`\n🚀 You can now login and access the admin dashboard:`);
    console.log(`   1. Go to: http://localhost:3000/login`);
    console.log(`   2. Login with: ${email}`);
    console.log(`   3. Access admin: http://localhost:3000/admin`);
    
    if (user.instructor) {
      console.log(`\n💡 Note: This user also has an instructor account.`);
      console.log(`   - Admin dashboard: /admin`);
      console.log(`   - Instructor dashboard: /dashboard`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

makeAdmin();
