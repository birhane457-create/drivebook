// Run this to clear the broken logo path so it doesn't show a broken image
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const instructor = await prisma.instructor.findFirst({
    where: { customDomain: 'sssssss' },
    select: { id: true, name: true, brandLogo: true },
  });

  if (!instructor) { console.log('❌ Instructor not found'); return; }

  console.log(`Found: ${instructor.name}`);
  console.log(`Current brandLogo: ${instructor.brandLogo}`);

  if (instructor.brandLogo?.includes('null-')) {
    await prisma.instructor.update({
      where: { id: instructor.id },
      data: { brandLogo: null },
    });
    console.log('✅ Cleared broken logo path (had null- prefix)');
  } else {
    console.log('ℹ️  Logo path looks fine, no fix needed');
  }
}

fix().catch(console.error).finally(() => prisma.$disconnect());
