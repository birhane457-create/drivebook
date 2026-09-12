/**
 * Create Admin User Script
 * 
 * Run with: node scripts/create-admin.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function createAdmin() {
  console.log('🔐 Admin User Creation\n');

  try {
    // Get admin details
    const email = await question('Admin email: ');
    const password = await question('Admin password (min 8 characters): ');
    const confirmPassword = await question('Confirm password: ');

    // Validate
    if (!email || !email.includes('@')) {
      console.error('❌ Invalid email address');
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('❌ Password must be at least 8 characters');
      process.exit(1);
    }

    if (password !== confirmPassword) {
      console.error('❌ Passwords do not match');
      process.exit(1);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.error('❌ User with this email already exists');
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
      },
    });

    console.log('\n✅ Admin user created successfully!');
    console.log(`\n📧 Email: ${email}`);
    console.log(`🔑 Role: SUPER_ADMIN`);
    console.log(`\n🚀 You can now login at: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login`);
    console.log(`📊 Admin dashboard: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin\n`);

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

createAdmin();
