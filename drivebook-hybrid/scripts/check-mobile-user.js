const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'debesay304@gmail.com' },
      include: { 
        instructor: {
          select: {
            id: true,
            name: true,
            phone: true,
            approvalStatus: true,
          }
        }
      }
    });

    console.log('\n=== USER CHECK ===');
    console.log('User found:', !!user);
    
    if (user) {
      console.log('User ID:', user.id);
      console.log('Email:', user.email);
      console.log('Role:', user.role);
      console.log('Has instructor profile:', !!user.instructor);
      
      if (user.instructor) {
        console.log('\n=== INSTRUCTOR PROFILE ===');
        console.log('Instructor ID:', user.instructor.id);
        console.log('Name:', user.instructor.name);
        console.log('Phone:', user.instructor.phone);
        console.log('Approval Status:', user.instructor.approvalStatus);
      } else {
        console.log('\n❌ NO INSTRUCTOR PROFILE - This user cannot use the mobile app!');
        console.log('The mobile app is for instructors only.');
      }
    } else {
      console.log('❌ User not found with email: debesay304@gmail.com');
    }
    
    console.log('\n');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
