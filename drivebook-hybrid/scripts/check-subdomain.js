const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSubdomains() {
  try {
    console.log('🔍 Checking configured subdomains...\n');

    const instructors = await prisma.instructor.findMany({
      where: {
        customDomain: { not: null }
      },
      select: {
        id: true,
        name: true,
        customDomain: true,
        subscriptionTier: true,
        user: {
          select: {
            email: true
          }
        }
      }
    });

    if (instructors.length === 0) {
      console.log('❌ No subdomains configured yet.\n');
      console.log('To configure a subdomain:');
      console.log('1. Login as PRO/BUSINESS instructor');
      console.log('2. Go to /dashboard/branding');
      console.log('3. Enter desired subdomain');
      console.log('4. Click "Save Branding Settings"\n');
      return;
    }

    console.log(`✅ Found ${instructors.length} configured subdomain(s):\n`);

    instructors.forEach((instructor, index) => {
      console.log(`${index + 1}. ${instructor.name}`);
      console.log(`   Email: ${instructor.user.email}`);
      console.log(`   Tier: ${instructor.subscriptionTier}`);
      console.log(`   Subdomain: ${instructor.customDomain}`);
      console.log(`   Local URL: http://${instructor.customDomain}.localhost:3000`);
      console.log(`   Production URL: https://${instructor.customDomain}.drivebook.com`);
      console.log(`   Instructor ID: ${instructor.id}`);
      console.log('');
    });

    console.log('📝 To test locally, add to your hosts file:');
    console.log('   Windows: C:\\Windows\\System32\\drivers\\etc\\hosts');
    console.log('   Mac/Linux: /etc/hosts\n');
    
    instructors.forEach(instructor => {
      console.log(`   127.0.0.1 ${instructor.customDomain}.localhost`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSubdomains();
