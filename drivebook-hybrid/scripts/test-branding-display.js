const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testBrandingDisplay() {
  console.log('🎨 Testing Branding Display on Public Booking Page\n');

  try {
    // Find an instructor with branding enabled
    const instructors = await prisma.instructor.findMany({
      where: {
        OR: [
          { subscriptionTier: 'PRO' },
          { subscriptionTier: 'BUSINESS' }
        ]
      },
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        brandLogo: true,
        brandColorPrimary: true,
        brandColorSecondary: true,
        showBrandingOnBookingPage: true,
        customDomain: true
      }
    });

    if (instructors.length === 0) {
      console.log('❌ No PRO/BUSINESS instructors found');
      return;
    }

    console.log(`Found ${instructors.length} PRO/BUSINESS instructor(s):\n`);

    for (const instructor of instructors) {
      console.log(`📋 Instructor: ${instructor.name}`);
      console.log(`   Tier: ${instructor.subscriptionTier}`);
      console.log(`   Branding Enabled: ${instructor.showBrandingOnBookingPage ? '✅' : '❌'}`);
      console.log(`   Logo: ${instructor.brandLogo || 'Not set'}`);
      console.log(`   Primary Color: ${instructor.brandColorPrimary || 'Not set'}`);
      console.log(`   Secondary Color: ${instructor.brandColorSecondary || 'Not set'}`);
      console.log(`   Subdomain: ${instructor.customDomain || 'Not set'}`);
      
      // Check if branding will display
      const willDisplay = 
        instructor.showBrandingOnBookingPage &&
        (instructor.subscriptionTier === 'PRO' || instructor.subscriptionTier === 'BUSINESS');
      
      console.log(`   Will Display on Booking Page: ${willDisplay ? '✅ YES' : '❌ NO'}`);
      
      if (willDisplay) {
        console.log(`   📍 Booking URL: http://localhost:3000/book/${instructor.id}`);
        if (instructor.customDomain) {
          console.log(`   📍 Subdomain URL: https://${instructor.customDomain}.drivebook.com`);
        }
      }
      console.log('');
    }

    // Test email checking
    console.log('\n📧 Testing Email Duplicate Detection\n');
    
    const testEmails = [
      'test@example.com',
      'existing@example.com',
      'new@example.com'
    ];

    for (const email of testEmails) {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });
      
      console.log(`   ${email}: ${user ? '❌ EXISTS' : '✅ AVAILABLE'}`);
    }

    console.log('\n✅ Branding display test complete!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Visit booking page URL above');
    console.log('   2. Check if logo displays in header');
    console.log('   3. Verify brand colors on buttons and badges');
    console.log('   4. Click car image to test modal');
    console.log('   5. Test email duplicate detection in registration form');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBrandingDisplay();
