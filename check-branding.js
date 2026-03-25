const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('\n🔍 Checking instructor with customDomain = "sssssss"\n');

  const instructor = await prisma.instructor.findFirst({
    where: { customDomain: 'sssssss' },
  });

  if (!instructor) {
    console.log('❌ No instructor found with customDomain = "sssssss"');
    console.log('\n🔍 Listing all instructors with their customDomain and branding:\n');
    const all = await prisma.instructor.findMany({
      select: {
        id: true,
        name: true,
        customDomain: true,
        subscriptionTier: true,
        brandColorPrimary: true,
        brandColorSecondary: true,
        brandLogo: true,
        showBrandingOnBookingPage: true,
      },
    });
    all.forEach(i => {
      console.log(`  ${i.name} | tier=${i.subscriptionTier} | domain=${i.customDomain ?? 'null'} | primary=${i.brandColorPrimary ?? 'null'} | secondary=${i.brandColorSecondary ?? 'null'} | showBranding=${i.showBrandingOnBookingPage}`);
    });
    return;
  }

  console.log('✅ Found instructor:');
  console.log(`  id:                     ${instructor.id}`);
  console.log(`  name:                   ${instructor.name}`);
  console.log(`  subscriptionTier:       ${instructor.subscriptionTier}`);
  console.log(`  customDomain:           ${instructor.customDomain}`);
  console.log(`  brandColorPrimary:      ${instructor.brandColorPrimary ?? 'null (not set)'}`);
  console.log(`  brandColorSecondary:    ${instructor.brandColorSecondary ?? 'null (not set)'}`);
  console.log(`  brandLogo:              ${instructor.brandLogo ?? 'null (not set)'}`);
  console.log(`  showBrandingOnBookingPage: ${instructor.showBrandingOnBookingPage}`);
}

check().catch(console.error).finally(() => prisma.$disconnect());
