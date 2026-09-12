const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function enableBranding() {
  console.log('🎨 Enabling Branding for Test\n');

  try {
    // Find the instructor with ID 69901e9c97d4ad25232db3b5
    const instructorId = '69901e9c97d4ad25232db3b5';

    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
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

    if (!instructor) {
      console.log('❌ Instructor not found');
      return;
    }

    console.log('📋 Current Settings:');
    console.log(`   Name: ${instructor.name}`);
    console.log(`   Tier: ${instructor.subscriptionTier}`);
    console.log(`   Branding Enabled: ${instructor.showBrandingOnBookingPage}`);
    console.log(`   Logo: ${instructor.brandLogo || 'Not set'}`);
    console.log(`   Primary Color: ${instructor.brandColorPrimary || 'Not set'}`);
    console.log(`   Secondary Color: ${instructor.brandColorSecondary || 'Not set'}`);
    console.log(`   Subdomain: ${instructor.customDomain || 'Not set'}`);

    // Update to enable branding with test colors
    const updated = await prisma.instructor.update({
      where: { id: instructorId },
      data: {
        showBrandingOnBookingPage: true,
        brandColorPrimary: '#8B5CF6', // Purple
        brandColorSecondary: '#F59E0B', // Orange
        customDomain: 'debesay'
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

    console.log('\n✅ Branding Enabled!\n');
    console.log('📋 New Settings:');
    console.log(`   Name: ${updated.name}`);
    console.log(`   Tier: ${updated.subscriptionTier}`);
    console.log(`   Branding Enabled: ${updated.showBrandingOnBookingPage}`);
    console.log(`   Logo: ${updated.brandLogo || 'Not set'}`);
    console.log(`   Primary Color: ${updated.brandColorPrimary}`);
    console.log(`   Secondary Color: ${updated.brandColorSecondary}`);
    console.log(`   Subdomain: ${updated.customDomain}`);

    console.log('\n📍 Test URLs:');
    console.log(`   Booking Page: http://localhost:3000/book/${updated.id}`);
    console.log(`   Branding Settings: http://localhost:3000/dashboard/branding`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

enableBranding();
