const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function checkUserRole() {
  rl.question('Enter email address: ', async (email) => {
    try {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: {
          id: true,
          email: true,
          role: true,
          instructor: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      if (!user) {
        console.log('\n❌ User not found');
      } else {
        console.log('\n=== User Details ===');
        console.log('Email:', user.email);
        console.log('Role:', user.role);
        if (user.instructor) {
          console.log('Instructor Name:', user.instructor.name);
          console.log('Instructor ID:', user.instructor.id);
        }
        
        console.log('\n=== Access Rights ===');
        if (user.role === 'SUPER_ADMIN') {
          console.log('✅ Full admin access');
          console.log('✅ Can create other admins');
          console.log('✅ Access to /admin dashboard');
          console.log('✅ Access to /dashboard (if has instructor profile)');
        } else if (user.role === 'ADMIN') {
          console.log('✅ Admin access');
          console.log('❌ Cannot create other admins');
          console.log('✅ Access to /admin dashboard');
          console.log('✅ Access to /dashboard (if has instructor profile)');
        } else if (user.role === 'INSTRUCTOR') {
          console.log('✅ Instructor access');
          console.log('✅ Access to /dashboard');
          console.log('❌ No access to /admin');
        } else {
          console.log('✅ Client access');
          console.log('❌ No dashboard access');
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      await prisma.$disconnect();
      rl.close();
    }
  });
}

checkUserRole();
